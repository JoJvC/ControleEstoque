using ControleEstoque.Clientes.Domain;
using Npgsql;

namespace ControleEstoque.Clientes.Repository;

public sealed class PostgresSaldosRepository : ISaldosRepository
{
    private readonly NpgsqlDataSource dataSource;

    public PostgresSaldosRepository(NpgsqlDataSource dataSource) => this.dataSource = dataSource;

    public async Task<SaldosCliente> GetSaldosAsync(Guid clienteId, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(Sql.GetSaldos, connection);
        command.Parameters.AddWithValue("clienteId", clienteId);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        if (!await reader.ReadAsync(cancellationToken))
        {
            return new SaldosCliente(0, 0, 0m);
        }

        return new SaldosCliente(
            reader.IsDBNull(0) ? 0 : reader.GetInt64(0),
            reader.IsDBNull(1) ? 0 : reader.GetInt64(1),
            reader.IsDBNull(2) ? 0m : reader.GetDecimal(2));
    }

    public async Task<IReadOnlyList<SaldoCascoRelatorio>> ListSaldosCascoAsync(
        CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(Sql.ListSaldosCasco, connection);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        var results = new List<SaldoCascoRelatorio>();
        while (await reader.ReadAsync(cancellationToken))
        {
            results.Add(new SaldoCascoRelatorio(
                reader.GetGuid(0), reader.GetString(1), reader.GetInt64(2)));
        }

        return results;
    }

    public async Task<IReadOnlyList<SucataEntregueRelatorio>> ListSucataEntregueAsync(
        CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(Sql.ListSucataEntregue, connection);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        var results = new List<SucataEntregueRelatorio>();
        while (await reader.ReadAsync(cancellationToken))
        {
            results.Add(new SucataEntregueRelatorio(
                reader.GetGuid(0), reader.GetString(1), reader.GetInt64(2)));
        }

        return results;
    }

    private static class Sql
    {
        public const string GetSaldos = """
            SELECT
                (SELECT saldo_cascos    FROM vw_saldo_casco_cliente     WHERE cliente_id = @clienteId),
                (SELECT total_entregue  FROM vw_sucata_entregue_cliente WHERE cliente_id = @clienteId),
                (SELECT saldo_devedor   FROM vw_saldo_fiado_cliente     WHERE cliente_id = @clienteId)
            """;

        public const string ListSaldosCasco = """
            SELECT cliente_id, nome, saldo_cascos
            FROM vw_saldo_casco_cliente
            WHERE saldo_cascos <> 0
            ORDER BY saldo_cascos DESC
            """;

        public const string ListSucataEntregue = """
            SELECT cliente_id, nome, total_entregue
            FROM vw_sucata_entregue_cliente
            WHERE total_entregue > 0
            ORDER BY total_entregue DESC
            """;
    }
}
