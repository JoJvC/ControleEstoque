using ControleEstoque.Estoque.Domain;
using Npgsql;
using NpgsqlTypes;

namespace ControleEstoque.Estoque.Repository;

public sealed class PostgresTipoCascoRepository : ITipoCascoRepository
{
    private readonly NpgsqlDataSource dataSource;

    public PostgresTipoCascoRepository(NpgsqlDataSource dataSource) => this.dataSource = dataSource;

    public async Task CreateAsync(TipoCasco tipoCasco, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(Sql.Insert, connection);
        AddWriteParameters(command, tipoCasco);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    public async Task<bool> UpdateAsync(TipoCasco tipoCasco, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(Sql.Update, connection);
        AddWriteParameters(command, tipoCasco);
        return await command.ExecuteNonQueryAsync(cancellationToken) > 0;
    }

    public async Task<TipoCasco?> GetAsync(Guid id, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(Sql.Get, connection);
        command.Parameters.AddWithValue("id", id);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        return await reader.ReadAsync(cancellationToken) ? MapRow(reader) : null;
    }

    public async Task<IReadOnlyList<TipoCasco>> ListAsync(CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(Sql.List, connection);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        var results = new List<TipoCasco>();
        while (await reader.ReadAsync(cancellationToken))
        {
            results.Add(MapRow(reader));
        }

        return results;
    }

    public async Task<bool> EmUsoAsync(Guid id, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(Sql.EmUso, connection);
        command.Parameters.AddWithValue("id", id);
        return (bool?)await command.ExecuteScalarAsync(cancellationToken) == true;
    }

    public async Task<long> GetSaldoSucataAsync(Guid id, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(Sql.SaldoSucata, connection);
        command.Parameters.AddWithValue("id", id);
        return (long)(await command.ExecuteScalarAsync(cancellationToken) ?? 0L);
    }

    private static void AddWriteParameters(NpgsqlCommand command, TipoCasco tipoCasco)
    {
        command.Parameters.AddWithValue("id", tipoCasco.Id);
        command.Parameters.AddWithValue("nome", tipoCasco.Nome);
        command.Parameters.Add(new NpgsqlParameter("marcaId", NpgsqlDbType.Uuid)
        {
            Value = (object?)tipoCasco.MarcaId ?? DBNull.Value
        });
        command.Parameters.AddWithValue("precoVasilhame", tipoCasco.PrecoVasilhame);
        command.Parameters.AddWithValue("aceitaSucata", tipoCasco.AceitaSucata);
    }

    private static TipoCasco MapRow(NpgsqlDataReader reader) => new(
        reader.GetGuid(0),
        reader.GetString(1),
        reader.IsDBNull(2) ? null : reader.GetGuid(2),
        reader.IsDBNull(3) ? null : reader.GetString(3),
        reader.GetDecimal(4),
        reader.GetBoolean(5));

    private static class Sql
    {
        private const string SelectColumns = """
            SELECT t.id, t.nome, t.marca_id, m.nome, t.preco_vasilhame, t.aceita_sucata
            FROM tipos_casco t
            LEFT JOIN marcas m ON m.id = t.marca_id
            """;

        public const string Insert = """
            INSERT INTO tipos_casco (id, nome, marca_id, preco_vasilhame, aceita_sucata)
            VALUES (@id, @nome, @marcaId, @precoVasilhame, @aceitaSucata)
            """;

        public const string Update = """
            UPDATE tipos_casco
            SET nome = @nome, marca_id = @marcaId, preco_vasilhame = @precoVasilhame,
                aceita_sucata = @aceitaSucata, updated_at = now()
            WHERE id = @id AND deleted_at IS NULL
            """;

        public const string Get = SelectColumns + " WHERE t.id = @id AND t.deleted_at IS NULL";

        public const string List = SelectColumns + " WHERE t.deleted_at IS NULL ORDER BY t.nome";

        public const string EmUso = """
            SELECT EXISTS (SELECT 1 FROM produtos WHERE tipo_casco_id = @id AND deleted_at IS NULL)
                OR EXISTS (SELECT 1 FROM produto_marcas WHERE tipo_casco_id = @id AND deleted_at IS NULL)
            """;

        public const string SaldoSucata = """
            SELECT COALESCE(SUM(quantidade), 0)::bigint
            FROM movimentos_estoque_casco
            WHERE tipo_casco_id = @id AND situacao = 'SUCATA' AND deleted_at IS NULL
            """;
    }
}
