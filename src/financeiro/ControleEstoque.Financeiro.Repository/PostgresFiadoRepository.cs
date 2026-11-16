using ControleEstoque.Financeiro.Domain;
using ControleEstoque.Shared.Results;
using Npgsql;

namespace ControleEstoque.Financeiro.Repository;

public sealed class PostgresFiadoRepository : IFiadoRepository
{
    private readonly NpgsqlDataSource dataSource;

    public PostgresFiadoRepository(NpgsqlDataSource dataSource) => this.dataSource = dataSource;

    public async Task<bool> ClienteExisteAsync(Guid clienteId, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(Sql.ClienteExiste, connection);
        command.Parameters.AddWithValue("clienteId", clienteId);
        return (bool?)await command.ExecuteScalarAsync(cancellationToken) == true;
    }

    public async Task<decimal> GetSaldoAsync(Guid clienteId, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        return await GetSaldoAsync(connection, null, clienteId, cancellationToken);
    }

    public async Task<ResultadoPagamentoFiado> PagarAsync(
        Guid clienteId, decimal valor, FormaPagamento forma, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);

        // Ordem das travas: caixa (FOR SHARE), cliente (FOR UPDATE) e vendas do cliente (FOR UPDATE).
        await using (var command = new NpgsqlCommand(Sql.TravaCaixaHoje, connection, transaction))
        {
            if ((string?)await command.ExecuteScalarAsync(cancellationToken) == nameof(StatusCaixa.FECHADO))
            {
                throw new ConflictException("CAIXA_FECHADO", "Não é possível lançar pagamento em caixa fechado.");
            }
        }

        await using (var command = new NpgsqlCommand(Sql.TravaCliente, connection, transaction))
        {
            command.Parameters.AddWithValue("clienteId", clienteId);
            if (await command.ExecuteScalarAsync(cancellationToken) is null)
            {
                throw new EntityNotFoundException("CLIENTE_NAO_ENCONTRADO", $"Cliente {clienteId} não encontrado.");
            }
        }

        var pendentes = new List<VendaPendente>();
        await using (var command = new NpgsqlCommand(Sql.TravaVendasPendentes, connection, transaction))
        {
            command.Parameters.AddWithValue("clienteId", clienteId);
            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            while (await reader.ReadAsync(cancellationToken))
            {
                pendentes.Add(new VendaPendente(
                    reader.GetGuid(0), reader.GetFieldValue<DateTimeOffset>(1),
                    reader.GetDecimal(2), reader.GetDecimal(3)));
            }
        }

        Guid lancamentoId;
        await using (var command = new NpgsqlCommand(Sql.InsertPagamento, connection, transaction))
        {
            command.Parameters.AddWithValue("clienteId", clienteId);
            command.Parameters.AddWithValue("valor", valor);
            command.Parameters.AddWithValue("observacao", $"Pagamento de fiado ({forma})");
            lancamentoId = (Guid)(await command.ExecuteScalarAsync(cancellationToken))!;
        }

        var distribuicao = FiadoFifo.Distribuir(valor, pendentes);
        foreach (var abatimento in distribuicao.Abatimentos)
        {
            await using (var command = new NpgsqlCommand(Sql.InsertPagamentoVenda, connection, transaction))
            {
                command.Parameters.AddWithValue("vendaId", abatimento.VendaId);
                command.Parameters.AddWithValue("forma", forma.ToString());
                command.Parameters.AddWithValue("valor", abatimento.ValorAbatido);
                command.Parameters.AddWithValue("lancamentoId", lancamentoId);
                await command.ExecuteNonQueryAsync(cancellationToken);
            }

            await using (var command = new NpgsqlCommand(Sql.UpdateStatusVenda, connection, transaction))
            {
                command.Parameters.AddWithValue("vendaId", abatimento.VendaId);
                command.Parameters.AddWithValue("status", abatimento.NovoStatus.ToString());
                await command.ExecuteNonQueryAsync(cancellationToken);
            }
        }

        var saldo = await GetSaldoAsync(connection, transaction, clienteId, cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return new ResultadoPagamentoFiado(
            saldo, distribuicao.Abatimentos, FiadoFifo.CreditoGerado(distribuicao.Sobra, 0m - saldo));
    }

    public async Task<IReadOnlyList<SaldoFiadoCliente>> ListSaldosDevedoresAsync(
        CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(Sql.ListSaldosDevedores, connection);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        var results = new List<SaldoFiadoCliente>();
        while (await reader.ReadAsync(cancellationToken))
        {
            results.Add(new SaldoFiadoCliente(
                reader.GetGuid(0), reader.GetString(1), reader.GetDecimal(2), reader.GetDecimal(3)));
        }

        return results;
    }

    private static async Task<decimal> GetSaldoAsync(
        NpgsqlConnection connection, NpgsqlTransaction? transaction, Guid clienteId,
        CancellationToken cancellationToken)
    {
        await using var command = new NpgsqlCommand(Sql.GetSaldo, connection, transaction);
        command.Parameters.AddWithValue("clienteId", clienteId);
        return (decimal?)await command.ExecuteScalarAsync(cancellationToken) ?? 0m;
    }

    private static class Sql
    {
        public const string ClienteExiste =
            "SELECT EXISTS (SELECT 1 FROM clientes WHERE id = @clienteId AND deleted_at IS NULL)";

        public const string TravaCaixaHoje =
            "SELECT status::text FROM caixas WHERE data = CURRENT_DATE AND deleted_at IS NULL FOR SHARE";

        public const string TravaCliente =
            "SELECT id FROM clientes WHERE id = @clienteId AND deleted_at IS NULL FOR UPDATE";

        public const string GetSaldo =
            "SELECT saldo_devedor FROM vw_saldo_fiado_cliente WHERE cliente_id = @clienteId";

        // Vendas do cliente ainda em aberto, da mais antiga para a mais nova; o pago inclui CREDITO_CLIENTE.
        public const string TravaVendasPendentes = """
            SELECT v.id, v.data, v.total_liquido,
                   COALESCE((SELECT SUM(p.valor) FROM venda_pagamentos p
                             WHERE p.venda_id = v.id AND p.deleted_at IS NULL), 0)
            FROM vendas v
            WHERE v.cliente_id = @clienteId AND v.deleted_at IS NULL
              AND v.status_pagamento IN ('PENDENTE', 'PARCIAL')
            ORDER BY v.data, v.id
            FOR UPDATE OF v
            """;

        public const string InsertPagamento = """
            INSERT INTO lancamentos_fiado (cliente_id, tipo, valor, observacao)
            VALUES (@clienteId, 'PAGAMENTO', @valor, @observacao)
            RETURNING id
            """;

        public const string InsertPagamentoVenda = """
            INSERT INTO venda_pagamentos (venda_id, forma, valor, data, lancamento_fiado_id)
            VALUES (@vendaId, @forma::forma_pagamento, @valor, now(), @lancamentoId)
            """;

        public const string UpdateStatusVenda =
            "UPDATE vendas SET status_pagamento = @status::status_pagamento_venda, updated_at = now() WHERE id = @vendaId";

        public const string ListSaldosDevedores = """
            SELECT cliente_id, nome, saldo_devedor, saldo
            FROM vw_saldo_fiado_cliente
            WHERE saldo_devedor <> 0
            ORDER BY saldo_devedor DESC
            """;
    }
}
