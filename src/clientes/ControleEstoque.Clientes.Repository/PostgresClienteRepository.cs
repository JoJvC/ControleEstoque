using ControleEstoque.Clientes.Domain;
using Npgsql;
using NpgsqlTypes;

namespace ControleEstoque.Clientes.Repository;

public sealed class PostgresClienteRepository : IClienteRepository
{
    private readonly NpgsqlDataSource dataSource;

    public PostgresClienteRepository(NpgsqlDataSource dataSource) => this.dataSource = dataSource;

    public async Task CreateAsync(Cliente cliente, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(Sql.Insert, connection);
        AddWriteParameters(command, cliente);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    public async Task<bool> UpdateAsync(Cliente cliente, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(Sql.Update, connection);
        AddWriteParameters(command, cliente);
        return await command.ExecuteNonQueryAsync(cancellationToken) > 0;
    }

    public async Task<Cliente?> GetAsync(Guid id, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);

        Cliente? cliente;
        await using (var command = new NpgsqlCommand(Sql.Get, connection))
        {
            command.Parameters.AddWithValue("id", id);
            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            if (!await reader.ReadAsync(cancellationToken))
            {
                return null;
            }

            cliente = MapCliente(reader);
        }

        await using (var command = new NpgsqlCommand(Sql.GetEnderecos, connection))
        {
            command.Parameters.AddWithValue("clienteId", id);
            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            var enderecos = new List<Endereco>();
            while (await reader.ReadAsync(cancellationToken))
            {
                enderecos.Add(MapEndereco(reader));
            }

            return cliente with { Enderecos = enderecos };
        }
    }

    public async Task<bool> ExistsAsync(Guid id, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(Sql.Exists, connection);
        command.Parameters.AddWithValue("id", id);
        return (bool?)await command.ExecuteScalarAsync(cancellationToken) == true;
    }

    public async Task<IReadOnlyList<Cliente>> ListAsync(
        string? nome, int page, int pageSize, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(Sql.List, connection);
        command.Parameters.Add(new NpgsqlParameter("nome", NpgsqlDbType.Text)
        {
            Value = (object?)nome ?? DBNull.Value
        });
        command.Parameters.AddWithValue("offset", (page - 1) * pageSize);
        command.Parameters.AddWithValue("limit", pageSize);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        var results = new List<Cliente>();
        while (await reader.ReadAsync(cancellationToken))
        {
            results.Add(MapCliente(reader));
        }

        return results;
    }

    public async Task AddEnderecoAsync(Endereco endereco, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(Sql.InsertEndereco, connection);
        command.Parameters.AddWithValue("id", endereco.Id);
        command.Parameters.AddWithValue("clienteId", endereco.ClienteId);
        command.Parameters.AddWithValue("logradouro", endereco.Logradouro);
        command.Parameters.Add(new NpgsqlParameter("numero", NpgsqlDbType.Text)
        {
            Value = (object?)endereco.Numero ?? DBNull.Value
        });
        command.Parameters.Add(new NpgsqlParameter("bairro", NpgsqlDbType.Text)
        {
            Value = (object?)endereco.Bairro ?? DBNull.Value
        });
        command.Parameters.Add(new NpgsqlParameter("complemento", NpgsqlDbType.Text)
        {
            Value = (object?)endereco.Complemento ?? DBNull.Value
        });
        command.Parameters.Add(new NpgsqlParameter("referencia", NpgsqlDbType.Text)
        {
            Value = (object?)endereco.Referencia ?? DBNull.Value
        });
        command.Parameters.AddWithValue("principal", endereco.Principal);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    private static void AddWriteParameters(NpgsqlCommand command, Cliente cliente)
    {
        command.Parameters.AddWithValue("id", cliente.Id);
        command.Parameters.AddWithValue("nome", cliente.Nome);
        command.Parameters.Add(new NpgsqlParameter("telefone", NpgsqlDbType.Text)
        {
            Value = (object?)cliente.Telefone ?? DBNull.Value
        });
        command.Parameters.Add(new NpgsqlParameter("observacoes", NpgsqlDbType.Text)
        {
            Value = (object?)cliente.Observacoes ?? DBNull.Value
        });
    }

    private static Cliente MapCliente(NpgsqlDataReader reader) => new(
        reader.GetGuid(0),
        reader.GetString(1),
        reader.IsDBNull(2) ? null : reader.GetString(2),
        reader.IsDBNull(3) ? null : reader.GetString(3),
        []);

    private static Endereco MapEndereco(NpgsqlDataReader reader) => new(
        reader.GetGuid(0),
        reader.GetGuid(1),
        reader.GetString(2),
        reader.IsDBNull(3) ? null : reader.GetString(3),
        reader.IsDBNull(4) ? null : reader.GetString(4),
        reader.IsDBNull(5) ? null : reader.GetString(5),
        reader.IsDBNull(6) ? null : reader.GetString(6),
        reader.GetBoolean(7));

    private static class Sql
    {
        public const string Insert = """
            INSERT INTO clientes (id, nome, telefone, observacoes)
            VALUES (@id, @nome, @telefone, @observacoes)
            """;

        public const string Update = """
            UPDATE clientes
            SET nome = @nome, telefone = @telefone, observacoes = @observacoes, updated_at = now()
            WHERE id = @id AND deleted_at IS NULL
            """;

        public const string Get =
            "SELECT id, nome, telefone, observacoes FROM clientes WHERE id = @id AND deleted_at IS NULL";

        public const string Exists =
            "SELECT EXISTS (SELECT 1 FROM clientes WHERE id = @id AND deleted_at IS NULL)";

        public const string List = """
            SELECT id, nome, telefone, observacoes
            FROM clientes
            WHERE deleted_at IS NULL AND (@nome IS NULL OR nome ILIKE '%' || @nome || '%')
            ORDER BY nome
            OFFSET @offset LIMIT @limit
            """;

        public const string GetEnderecos = """
            SELECT id, cliente_id, logradouro, numero, bairro, complemento, referencia, principal
            FROM cliente_enderecos
            WHERE cliente_id = @clienteId AND deleted_at IS NULL
            ORDER BY principal DESC, created_at
            """;

        public const string InsertEndereco = """
            INSERT INTO cliente_enderecos
                (id, cliente_id, logradouro, numero, bairro, complemento, referencia, principal)
            VALUES (@id, @clienteId, @logradouro, @numero, @bairro, @complemento, @referencia, @principal)
            """;
    }
}
