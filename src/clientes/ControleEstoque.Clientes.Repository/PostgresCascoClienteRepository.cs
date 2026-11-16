using ControleEstoque.Clientes.Domain;
using Npgsql;

namespace ControleEstoque.Clientes.Repository;

public sealed class PostgresCascoClienteRepository : ICascoClienteRepository
{
    private readonly NpgsqlDataSource dataSource;

    public PostgresCascoClienteRepository(NpgsqlDataSource dataSource) => this.dataSource = dataSource;

    public async Task<ResultadoDevolucaoCasco> DevolverAsync(
        Guid clienteId, IReadOnlyList<LinhaDevolucaoCasco> linhas, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);

        // Mesma trava de cliente da venda CONVERTER_CASCO: devolução e conversão do mesmo cliente não se cruzam.
        await using (var command = new NpgsqlCommand(Sql.TravaCliente, connection, transaction))
        {
            command.Parameters.AddWithValue("clienteId", clienteId);
            await command.ExecuteScalarAsync(cancellationToken);
        }

        foreach (var linha in linhas)
        {
            await using (var command = new NpgsqlCommand(Sql.InsertMovimentoCasco, connection, transaction))
            {
                command.Parameters.AddWithValue("clienteId", clienteId);
                command.Parameters.AddWithValue("tipoCascoId", linha.TipoCascoId);
                command.Parameters.AddWithValue("tipo", "DEVOLUCAO");
                command.Parameters.AddWithValue("quantidade", linha.Quantidade);
                await command.ExecuteNonQueryAsync(cancellationToken);
            }

            // O vazio devolvido entra no estoque físico da loja, no tipo de casco devolvido.
            await using (var command = new NpgsqlCommand(Sql.InsertMovimentoEstoqueCasco, connection, transaction))
            {
                command.Parameters.AddWithValue("tipoCascoId", linha.TipoCascoId);
                command.Parameters.AddWithValue("quantidade", linha.Quantidade);
                await command.ExecuteNonQueryAsync(cancellationToken);
            }
        }

        var novoSaldo = await GetSaldoAsync(connection, transaction, clienteId, cancellationToken);
        var porTipo = new List<SaldoCascoPorTipo>();
        await using (var command = new NpgsqlCommand(Sql.GetCascosPorTipo, connection, transaction))
        {
            command.Parameters.AddWithValue("clienteId", clienteId);
            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            while (await reader.ReadAsync(cancellationToken))
            {
                porTipo.Add(new SaldoCascoPorTipo(reader.GetGuid(0), reader.GetString(1), reader.GetInt64(2)));
            }
        }

        await transaction.CommitAsync(cancellationToken);
        return new ResultadoDevolucaoCasco(novoSaldo, porTipo);
    }

    private static async Task<long> GetSaldoAsync(
        NpgsqlConnection connection, NpgsqlTransaction? transaction, Guid clienteId,
        CancellationToken cancellationToken)
    {
        await using var command = new NpgsqlCommand(Sql.GetSaldo, connection, transaction);
        command.Parameters.AddWithValue("clienteId", clienteId);
        return (long?)await command.ExecuteScalarAsync(cancellationToken) ?? 0;
    }

    private static class Sql
    {
        public const string TravaCliente =
            "SELECT id FROM clientes WHERE id = @clienteId AND deleted_at IS NULL FOR UPDATE";

        public const string InsertMovimentoCasco = """
            INSERT INTO movimentos_casco_cliente (cliente_id, tipo_casco_id, tipo, quantidade)
            VALUES (@clienteId, @tipoCascoId, @tipo::tipo_movimento_casco, @quantidade)
            """;

        public const string InsertMovimentoEstoqueCasco = """
            INSERT INTO movimentos_estoque_casco (tipo_casco_id, situacao, tipo, quantidade)
            VALUES (@tipoCascoId, 'VAZIO', 'DEVOLUCAO_CLIENTE', @quantidade)
            """;

        // Só os positivos: crédito de um tipo não abate outro. SUM(bigint) é numeric no Postgres: o ::bigint mantém o (long?) do ExecuteScalar.
        public const string GetSaldo =
            "SELECT COALESCE(SUM(GREATEST(saldo_cascos, 0)), 0)::bigint FROM vw_saldo_casco_cliente WHERE cliente_id = @clienteId";

        // Mesmo critério de PostgresSaldosRepository.GetCascosPorTipo (GET /saldos).
        public const string GetCascosPorTipo = """
            SELECT v.tipo_casco_id, tc.nome, v.saldo_cascos
            FROM vw_saldo_casco_cliente v
            JOIN tipos_casco tc ON tc.id = v.tipo_casco_id
            WHERE v.cliente_id = @clienteId AND v.saldo_cascos <> 0
            ORDER BY tc.nome
            """;
    }
}
