using ControleEstoque.RH.Domain;
using Npgsql;
using NpgsqlTypes;

namespace ControleEstoque.RH.Repository;

public sealed class PostgresFuncionarioRepository : IFuncionarioRepository
{
    private readonly NpgsqlDataSource dataSource;

    public PostgresFuncionarioRepository(NpgsqlDataSource dataSource) => this.dataSource = dataSource;

    public async Task CreateAsync(Funcionario funcionario, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(Sql.Insert, connection);
        AddWriteParameters(command, funcionario);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    public async Task<bool> UpdateAsync(Funcionario funcionario, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(Sql.Update, connection);
        AddWriteParameters(command, funcionario);
        return await command.ExecuteNonQueryAsync(cancellationToken) > 0;
    }

    public async Task<Funcionario?> GetAsync(Guid id, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(Sql.Get, connection);
        command.Parameters.AddWithValue("id", id);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        return await reader.ReadAsync(cancellationToken) ? MapFuncionario(reader) : null;
    }

    public async Task<bool> ExistsAsync(Guid id, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(Sql.Exists, connection);
        command.Parameters.AddWithValue("id", id);
        return (bool?)await command.ExecuteScalarAsync(cancellationToken) == true;
    }

    public async Task<IReadOnlyList<Funcionario>> ListAsync(CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(Sql.List, connection);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        var results = new List<Funcionario>();
        while (await reader.ReadAsync(cancellationToken))
        {
            results.Add(MapFuncionario(reader));
        }

        return results;
    }

    private static void AddWriteParameters(NpgsqlCommand command, Funcionario funcionario)
    {
        command.Parameters.AddWithValue("id", funcionario.Id);
        command.Parameters.AddWithValue("nome", funcionario.Nome);
        command.Parameters.Add(new NpgsqlParameter("telefone", NpgsqlDbType.Text)
        {
            Value = (object?)funcionario.Telefone ?? DBNull.Value
        });
        command.Parameters.AddWithValue("cargoId", funcionario.CargoId);
        command.Parameters.AddWithValue("valorDiaria", funcionario.ValorDiaria);
        command.Parameters.AddWithValue("ativo", funcionario.Ativo);
    }

    private static Funcionario MapFuncionario(NpgsqlDataReader reader) => new(
        reader.GetGuid(0),
        reader.GetString(1),
        reader.IsDBNull(2) ? null : reader.GetString(2),
        reader.GetGuid(3),
        reader.IsDBNull(4) ? null : reader.GetString(4),
        reader.GetDecimal(5),
        reader.GetBoolean(6));

    private static class Sql
    {
        private const string SelectFuncionario = """
            SELECT f.id, f.nome, f.telefone, f.cargo_id, c.nome, f.valor_diaria, f.ativo
            FROM funcionarios f
            LEFT JOIN cargos c ON c.id = f.cargo_id
            """;

        public const string Insert = """
            INSERT INTO funcionarios (id, nome, telefone, cargo_id, valor_diaria, ativo)
            VALUES (@id, @nome, @telefone, @cargoId, @valorDiaria, @ativo)
            """;

        public const string Update = """
            UPDATE funcionarios
            SET nome = @nome, telefone = @telefone, cargo_id = @cargoId,
                valor_diaria = @valorDiaria, ativo = @ativo, updated_at = now()
            WHERE id = @id AND deleted_at IS NULL
            """;

        public const string Get = SelectFuncionario + " WHERE f.id = @id AND f.deleted_at IS NULL";

        public const string Exists =
            "SELECT EXISTS (SELECT 1 FROM funcionarios WHERE id = @id AND deleted_at IS NULL)";

        public const string List = SelectFuncionario + " WHERE f.deleted_at IS NULL ORDER BY f.nome";
    }
}
