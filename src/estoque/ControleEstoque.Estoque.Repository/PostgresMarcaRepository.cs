using ControleEstoque.Estoque.Domain;
using ControleEstoque.Shared.Results;
using Npgsql;

namespace ControleEstoque.Estoque.Repository;

public sealed class PostgresMarcaRepository : IMarcaRepository
{
    private readonly NpgsqlDataSource dataSource;

    public PostgresMarcaRepository(NpgsqlDataSource dataSource) => this.dataSource = dataSource;

    public async Task<Marca> CreateAsync(string nome, CancellationToken cancellationToken)
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
            throw new ConflictException("MARCA_DUPLICADA", $"Já existe marca com o nome '{nome}'.");
        }

        return new Marca(id, nome);
    }

    public async Task<IReadOnlyList<Marca>> ListAsync(CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(Sql.List, connection);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        var results = new List<Marca>();
        while (await reader.ReadAsync(cancellationToken))
        {
            results.Add(new Marca(reader.GetGuid(0), reader.GetString(1)));
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
        public const string Insert = "INSERT INTO marcas (id, nome) VALUES (@id, @nome)";
        public const string List = "SELECT id, nome FROM marcas WHERE deleted_at IS NULL ORDER BY nome";
        public const string Exists = "SELECT EXISTS (SELECT 1 FROM marcas WHERE id = @id AND deleted_at IS NULL)";
    }
}
