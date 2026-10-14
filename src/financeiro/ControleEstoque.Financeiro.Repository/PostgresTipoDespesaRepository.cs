using ControleEstoque.Financeiro.Domain;
using ControleEstoque.Shared.Results;
using Npgsql;

namespace ControleEstoque.Financeiro.Repository;

public sealed class PostgresTipoDespesaRepository : ITipoDespesaRepository
{
    private readonly NpgsqlDataSource dataSource;

    public PostgresTipoDespesaRepository(NpgsqlDataSource dataSource) => this.dataSource = dataSource;

    public async Task<TipoDespesa> CreateAsync(string nome, CancellationToken cancellationToken)
    {
        var id = Guid.NewGuid();
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(Sql.Insert, connection);
        command.Parameters.AddWithValue("id", id);
        command.Parameters.AddWithValue("nome", nome);
        try
        {
            await command.ExecuteNonQueryAsync(cancellationToken);
        }
        catch (PostgresException e) when (e.SqlState == PostgresErrorCodes.UniqueViolation)
        {
            throw new ConflictException("TIPO_DESPESA_DUPLICADO", $"Já existe tipo de despesa '{nome}'.");
        }

        return new TipoDespesa(id, nome);
    }

    public async Task<IReadOnlyList<TipoDespesa>> ListAsync(CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(Sql.List, connection);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        var results = new List<TipoDespesa>();
        while (await reader.ReadAsync(cancellationToken))
        {
            results.Add(new TipoDespesa(reader.GetGuid(0), reader.GetString(1)));
        }

        return results;
    }

    public async Task<bool> ExistsAsync(Guid id, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(Sql.Exists, connection);
        command.Parameters.AddWithValue("id", id);
        return (bool?)await command.ExecuteScalarAsync(cancellationToken) == true;
    }

    private static class Sql
    {
        public const string Insert = "INSERT INTO tipos_despesa (id, nome) VALUES (@id, @nome)";

        public const string List =
            "SELECT id, nome FROM tipos_despesa WHERE deleted_at IS NULL ORDER BY nome";

        public const string Exists =
            "SELECT EXISTS (SELECT 1 FROM tipos_despesa WHERE id = @id AND deleted_at IS NULL)";
    }
}
