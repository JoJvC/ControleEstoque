using ControleEstoque.RH.Domain;
using Npgsql;
using NpgsqlTypes;

namespace ControleEstoque.RH.Repository;

public sealed class PostgresContaFuncionarioRepository : IContaFuncionarioRepository
{
    private readonly NpgsqlDataSource dataSource;

    public PostgresContaFuncionarioRepository(NpgsqlDataSource dataSource) => this.dataSource = dataSource;

    public async Task<decimal> GetSaldoAsync(Guid funcionarioId, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(Sql.GetSaldo, connection);
        command.Parameters.AddWithValue("funcionarioId", funcionarioId);
        return (decimal?)await command.ExecuteScalarAsync(cancellationToken) ?? 0m;
    }

    public async Task AddLancamentoAsync(
        Guid funcionarioId, TipoLancamentoFuncionario tipo, decimal valor, string? observacao,
        CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(Sql.Insert, connection);
        command.Parameters.AddWithValue("funcionarioId", funcionarioId);
        command.Parameters.AddWithValue("tipo", tipo.ToString());
        command.Parameters.AddWithValue("valor", valor);
        command.Parameters.Add(new NpgsqlParameter("observacao", NpgsqlDbType.Text)
        {
            Value = (object?)observacao ?? DBNull.Value
        });
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<LancamentoFuncionario>> GetLancamentosAsync(
        Guid funcionarioId, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(Sql.GetLancamentos, connection);
        command.Parameters.AddWithValue("funcionarioId", funcionarioId);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        var results = new List<LancamentoFuncionario>();
        while (await reader.ReadAsync(cancellationToken))
        {
            results.Add(new LancamentoFuncionario(
                reader.GetGuid(0),
                Enum.Parse<TipoLancamentoFuncionario>(reader.GetString(1)),
                reader.GetDecimal(2),
                reader.GetFieldValue<DateTimeOffset>(3),
                reader.IsDBNull(4) ? null : reader.GetString(4)));
        }

        return results;
    }

    public async Task<IReadOnlyList<SaldoFuncionario>> ListSaldosAsync(CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(Sql.ListSaldos, connection);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        var results = new List<SaldoFuncionario>();
        while (await reader.ReadAsync(cancellationToken))
        {
            results.Add(new SaldoFuncionario(
                reader.GetGuid(0), reader.GetString(1), reader.GetDecimal(2)));
        }

        return results;
    }

    private static class Sql
    {
        public const string GetSaldo =
            "SELECT saldo_a_pagar FROM vw_saldo_funcionario WHERE funcionario_id = @funcionarioId";

        public const string Insert = """
            INSERT INTO lancamentos_funcionario (funcionario_id, tipo, valor, observacao)
            VALUES (@funcionarioId, @tipo::tipo_lancamento_funcionario, @valor, @observacao)
            """;

        public const string GetLancamentos = """
            SELECT id, tipo::text, valor, created_at, observacao
            FROM lancamentos_funcionario
            WHERE funcionario_id = @funcionarioId AND deleted_at IS NULL
            ORDER BY created_at DESC
            """;

        public const string ListSaldos = """
            SELECT funcionario_id, nome, saldo_a_pagar
            FROM vw_saldo_funcionario
            ORDER BY saldo_a_pagar DESC
            """;
    }
}
