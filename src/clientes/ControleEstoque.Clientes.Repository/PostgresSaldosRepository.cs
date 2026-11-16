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

        var cascos = new List<SaldoCascoPorTipo>();
        await using (var command = new NpgsqlCommand(Sql.GetCascosPorTipo, connection))
        {
            command.Parameters.AddWithValue("clienteId", clienteId);
            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            while (await reader.ReadAsync(cancellationToken))
            {
                cascos.Add(new SaldoCascoPorTipo(reader.GetGuid(0), reader.GetString(1), reader.GetInt64(2)));
            }
        }

        var sucata = new List<SucataPorTipo>();
        await using (var command = new NpgsqlCommand(Sql.GetSucataPorTipo, connection))
        {
            command.Parameters.AddWithValue("clienteId", clienteId);
            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            while (await reader.ReadAsync(cancellationToken))
            {
                sucata.Add(new SucataPorTipo(reader.GetGuid(0), reader.GetString(1), reader.GetInt64(2)));
            }
        }

        await using var fiadoCommand = new NpgsqlCommand(Sql.GetSaldoFiado, connection);
        fiadoCommand.Parameters.AddWithValue("clienteId", clienteId);
        var saldoFiado = (decimal?)await fiadoCommand.ExecuteScalarAsync(cancellationToken) ?? 0m;

        return SaldosCascos.Montar(cascos, sucata, saldoFiado);
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
                reader.GetGuid(0), reader.GetString(1), reader.GetInt64(2), reader.GetInt64(3)));
        }

        return results;
    }

    public async Task<long> GetTotalCascosNaRuaAsync(CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(Sql.TotalCascosNaRua, connection);
        return Convert.ToInt64(await command.ExecuteScalarAsync(cancellationToken));
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
        // Tipo apagado com movimento continua na lista (sem filtrar deleted_at), para o total bater com a soma.
        public const string GetCascosPorTipo = """
            SELECT v.tipo_casco_id, tc.nome, v.saldo_cascos
            FROM vw_saldo_casco_cliente v
            JOIN tipos_casco tc ON tc.id = v.tipo_casco_id
            WHERE v.cliente_id = @clienteId AND v.saldo_cascos <> 0
            ORDER BY tc.nome
            """;

        public const string GetSucataPorTipo = """
            SELECT v.tipo_casco_id, tc.nome, v.total_entregue
            FROM vw_sucata_entregue_cliente v
            JOIN tipos_casco tc ON tc.id = v.tipo_casco_id
            WHERE v.cliente_id = @clienteId AND v.total_entregue > 0
            ORDER BY tc.nome
            """;

        public const string GetSaldoFiado =
            "SELECT saldo_devedor FROM vw_saldo_fiado_cliente WHERE cliente_id = @clienteId";

        public const string ListSaldosCasco = """
            SELECT cliente_id, nome,
                   SUM(GREATEST(saldo_cascos, 0))::bigint AS cascos,
                   SUM(GREATEST(-saldo_cascos, 0))::bigint AS a_favor
            FROM vw_saldo_casco_cliente
            GROUP BY cliente_id, nome
            HAVING SUM(GREATEST(saldo_cascos, 0)) > 0 OR SUM(GREATEST(-saldo_cascos, 0)) > 0
            ORDER BY cascos DESC, a_favor DESC, nome
            """;

        public const string TotalCascosNaRua = """
            SELECT COALESCE(SUM(GREATEST(saldo_cascos, 0)), 0)::bigint
            FROM vw_saldo_casco_cliente
            """;

        public const string ListSucataEntregue = """
            SELECT cliente_id, nome, SUM(total_entregue)::bigint AS total_entregue
            FROM vw_sucata_entregue_cliente
            GROUP BY cliente_id, nome
            HAVING SUM(total_entregue) > 0
            ORDER BY SUM(total_entregue) DESC
            """;
    }
}
