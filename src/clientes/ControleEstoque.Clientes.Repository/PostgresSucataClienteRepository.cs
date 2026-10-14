using ControleEstoque.Clientes.Domain;
using ControleEstoque.Shared.Results;
using Npgsql;
using NpgsqlTypes;

namespace ControleEstoque.Clientes.Repository;

public sealed class PostgresSucataClienteRepository : ISucataClienteRepository
{
    private readonly NpgsqlDataSource dataSource;

    public PostgresSucataClienteRepository(NpgsqlDataSource dataSource) => this.dataSource = dataSource;

    public async Task<ResultadoEntregaSucata> EntregarAsync(
        Guid clienteId, int quantidade, decimal? valorConversao, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);

        Guid sucataProdutoId;
        await using (var command = new NpgsqlCommand(Sql.GetProdutoSucata, connection, transaction))
        {
            var id = (Guid?)await command.ExecuteScalarAsync(cancellationToken);
            sucataProdutoId = id ?? throw new BusinessRuleException(
                "PRODUTO_SUCATA_AUSENTE", "Produto estrutural SUCATA não cadastrado.");
        }

        // Registro do cliente — nunca toca movimentos_casco_cliente.
        await using (var command = new NpgsqlCommand(Sql.InsertEntrega, connection, transaction))
        {
            command.Parameters.AddWithValue("clienteId", clienteId);
            command.Parameters.AddWithValue("quantidade", quantidade);
            command.Parameters.Add(new NpgsqlParameter("valorConversao", NpgsqlDbType.Numeric)
            {
                Value = (object?)valorConversao ?? DBNull.Value
            });
            await command.ExecuteNonQueryAsync(cancellationToken);
        }

        await using (var command = new NpgsqlCommand(Sql.InsertMovimentoEstoque, connection, transaction))
        {
            command.Parameters.AddWithValue("produtoId", sucataProdutoId);
            command.Parameters.AddWithValue("quantidade", quantidade);
            await command.ExecuteNonQueryAsync(cancellationToken);
        }

        if (valorConversao is > 0)
        {
            await using var command = new NpgsqlCommand(Sql.InsertCreditoFiado, connection, transaction);
            command.Parameters.AddWithValue("clienteId", clienteId);
            command.Parameters.AddWithValue("valor", valorConversao.Value);
            command.Parameters.AddWithValue(
                "observacao", $"Crédito por entrega de {quantidade} sucata(s)");
            await command.ExecuteNonQueryAsync(cancellationToken);
        }

        long totalEntregue;
        await using (var command = new NpgsqlCommand(Sql.GetTotalEntregue, connection, transaction))
        {
            command.Parameters.AddWithValue("clienteId", clienteId);
            totalEntregue = (long?)await command.ExecuteScalarAsync(cancellationToken) ?? 0;
        }

        decimal saldoFiado;
        await using (var command = new NpgsqlCommand(Sql.GetSaldoFiado, connection, transaction))
        {
            command.Parameters.AddWithValue("clienteId", clienteId);
            saldoFiado = (decimal?)await command.ExecuteScalarAsync(cancellationToken) ?? 0m;
        }

        await transaction.CommitAsync(cancellationToken);
        return new ResultadoEntregaSucata(totalEntregue, saldoFiado);
    }

    private static class Sql
    {
        public const string GetProdutoSucata = """
            SELECT id FROM produtos
            WHERE tipo = 'SUCATA' AND deleted_at IS NULL
            ORDER BY created_at LIMIT 1
            """;

        public const string InsertEntrega = """
            INSERT INTO entregas_sucata_cliente (cliente_id, quantidade, valor_conversao)
            VALUES (@clienteId, @quantidade, @valorConversao)
            """;

        public const string InsertMovimentoEstoque = """
            INSERT INTO movimentos_estoque (produto_id, tipo, quantidade)
            VALUES (@produtoId, 'ENTRADA_SUCATA', @quantidade)
            """;

        public const string InsertCreditoFiado = """
            INSERT INTO lancamentos_fiado (cliente_id, tipo, valor, observacao)
            VALUES (@clienteId, 'CREDITO_CONVERSAO_SUCATA', @valor, @observacao)
            """;

        public const string GetTotalEntregue =
            "SELECT total_entregue FROM vw_sucata_entregue_cliente WHERE cliente_id = @clienteId";

        public const string GetSaldoFiado =
            "SELECT saldo_devedor FROM vw_saldo_fiado_cliente WHERE cliente_id = @clienteId";
    }
}
