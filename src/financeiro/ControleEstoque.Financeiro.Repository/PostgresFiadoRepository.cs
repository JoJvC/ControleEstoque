using ControleEstoque.Financeiro.Domain;
using Npgsql;
using NpgsqlTypes;

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

    public async Task<decimal> PagarAsync(
        Guid clienteId, decimal valor, string? observacao, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);

        await using (var command = new NpgsqlCommand(Sql.InsertPagamento, connection, transaction))
        {
            command.Parameters.AddWithValue("clienteId", clienteId);
            command.Parameters.AddWithValue("valor", valor);
            command.Parameters.Add(new NpgsqlParameter("observacao", NpgsqlDbType.Text)
            {
                Value = (object?)observacao ?? DBNull.Value
            });
            await command.ExecuteNonQueryAsync(cancellationToken);
        }

        var saldo = await GetSaldoAsync(connection, transaction, clienteId, cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return saldo;
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
                reader.GetGuid(0), reader.GetString(1), reader.GetDecimal(2)));
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

        public const string GetSaldo =
            "SELECT saldo_devedor FROM vw_saldo_fiado_cliente WHERE cliente_id = @clienteId";

        public const string InsertPagamento = """
            INSERT INTO lancamentos_fiado (cliente_id, tipo, valor, observacao)
            VALUES (@clienteId, 'PAGAMENTO', @valor, @observacao)
            """;

        public const string ListSaldosDevedores = """
            SELECT cliente_id, nome, saldo_devedor
            FROM vw_saldo_fiado_cliente
            WHERE saldo_devedor <> 0
            ORDER BY saldo_devedor DESC
            """;
    }
}
