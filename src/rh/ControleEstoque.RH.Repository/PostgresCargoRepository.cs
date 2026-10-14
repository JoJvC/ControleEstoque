using ControleEstoque.RH.Domain;
using ControleEstoque.Shared.Results;
using Npgsql;

namespace ControleEstoque.RH.Repository;

public sealed class PostgresCargoRepository : ICargoRepository
{
    private readonly NpgsqlDataSource dataSource;

    public PostgresCargoRepository(NpgsqlDataSource dataSource) => this.dataSource = dataSource;

    public async Task CreateAsync(Cargo cargo, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);

        await using (var command = new NpgsqlCommand(Sql.Insert, connection, transaction))
        {
            command.Parameters.AddWithValue("id", cargo.Id);
            command.Parameters.AddWithValue("nome", cargo.Nome);
            try
            {
                await command.ExecuteNonQueryAsync(cancellationToken);
            }
            catch (PostgresException e) when (e.SqlState == PostgresErrorCodes.UniqueViolation)
            {
                throw new ConflictException("CARGO_DUPLICADO", $"Já existe cargo com o nome '{cargo.Nome}'.");
            }
        }

        await InserirPermissoesAsync(connection, transaction, cargo, cancellationToken);
        await transaction.CommitAsync(cancellationToken);
    }

    public async Task<Cargo?> GetAsync(Guid id, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(Sql.Get, connection);
        command.Parameters.AddWithValue("id", id);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        return await reader.ReadAsync(cancellationToken) ? MapCargo(reader) : null;
    }

    public async Task<IReadOnlyList<Cargo>> ListAsync(CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(Sql.List, connection);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        var results = new List<Cargo>();
        while (await reader.ReadAsync(cancellationToken))
        {
            results.Add(MapCargo(reader));
        }

        return results;
    }

    public async Task UpdateAsync(Cargo cargo, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);

        await using (var command = new NpgsqlCommand(Sql.Update, connection, transaction))
        {
            command.Parameters.AddWithValue("id", cargo.Id);
            command.Parameters.AddWithValue("nome", cargo.Nome);
            await command.ExecuteNonQueryAsync(cancellationToken);
        }

        await using (var command = new NpgsqlCommand(Sql.DeletePermissoes, connection, transaction))
        {
            command.Parameters.AddWithValue("cargoId", cargo.Id);
            await command.ExecuteNonQueryAsync(cancellationToken);
        }

        await InserirPermissoesAsync(connection, transaction, cargo, cancellationToken);
        await transaction.CommitAsync(cancellationToken);
    }

    public async Task<bool> ExistsAsync(Guid id, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(Sql.Exists, connection);
        command.Parameters.AddWithValue("id", id);
        return (bool?)await command.ExecuteScalarAsync(cancellationToken) == true;
    }

    private static async Task InserirPermissoesAsync(
        NpgsqlConnection connection, NpgsqlTransaction transaction, Cargo cargo,
        CancellationToken cancellationToken)
    {
        foreach (var permissao in cargo.Permissoes.Distinct())
        {
            await using var command = new NpgsqlCommand(Sql.InsertPermissao, connection, transaction);
            command.Parameters.AddWithValue("cargoId", cargo.Id);
            command.Parameters.AddWithValue("permissao", permissao);
            await command.ExecuteNonQueryAsync(cancellationToken);
        }
    }

    private static Cargo MapCargo(NpgsqlDataReader reader) => new(
        reader.GetGuid(0),
        reader.GetString(1),
        reader.GetBoolean(2),
        reader.IsDBNull(3) ? [] : reader.GetFieldValue<string[]>(3));

    private static class Sql
    {
        private const string SelectCargo = """
            SELECT c.id, c.nome, c.nativo,
                   (SELECT array_agg(p.permissao) FROM cargo_permissoes p WHERE p.cargo_id = c.id)
            FROM cargos c
            """;

        public const string Insert = "INSERT INTO cargos (id, nome) VALUES (@id, @nome)";

        public const string InsertPermissao =
            "INSERT INTO cargo_permissoes (cargo_id, permissao) VALUES (@cargoId, @permissao)";

        public const string DeletePermissoes = "DELETE FROM cargo_permissoes WHERE cargo_id = @cargoId";

        public const string Get = SelectCargo + " WHERE c.id = @id AND c.deleted_at IS NULL";

        public const string List = SelectCargo + " WHERE c.deleted_at IS NULL ORDER BY c.nome";

        public const string Update =
            "UPDATE cargos SET nome = @nome, updated_at = now() WHERE id = @id AND deleted_at IS NULL";

        public const string Exists =
            "SELECT EXISTS (SELECT 1 FROM cargos WHERE id = @id AND deleted_at IS NULL)";
    }
}
