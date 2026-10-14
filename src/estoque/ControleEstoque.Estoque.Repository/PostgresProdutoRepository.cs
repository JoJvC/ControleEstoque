using ControleEstoque.Estoque.Domain;
using Npgsql;
using NpgsqlTypes;

namespace ControleEstoque.Estoque.Repository;

public sealed class PostgresProdutoRepository : IProdutoRepository
{
    private readonly NpgsqlDataSource dataSource;

    public PostgresProdutoRepository(NpgsqlDataSource dataSource) => this.dataSource = dataSource;

    public async Task CreateAsync(Produto produto, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(Sql.Insert, connection);
        AddWriteParameters(command, produto);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    public async Task<bool> UpdateAsync(Produto produto, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(Sql.Update, connection);
        AddWriteParameters(command, produto);
        return await command.ExecuteNonQueryAsync(cancellationToken) > 0;
    }

    public async Task<Produto?> GetAsync(Guid id, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(Sql.Get, connection);
        command.Parameters.AddWithValue("id", id);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        return await reader.ReadAsync(cancellationToken) ? MapRow(reader) : null;
    }

    public async Task<Produto?> GetFirstByTipoAsync(TipoProduto tipo, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(Sql.GetFirstByTipo, connection);
        command.Parameters.AddWithValue("tipo", tipo.ToString());
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        return await reader.ReadAsync(cancellationToken) ? MapRow(reader) : null;
    }

    public async Task<IReadOnlyList<Produto>> ListAsync(
        TipoProduto? tipo, Guid? marcaId, string? categoria, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(Sql.List, connection);
        command.Parameters.Add(new NpgsqlParameter("tipo", NpgsqlDbType.Text)
        {
            Value = (object?)tipo?.ToString() ?? DBNull.Value
        });
        command.Parameters.Add(new NpgsqlParameter("marcaId", NpgsqlDbType.Uuid)
        {
            Value = (object?)marcaId ?? DBNull.Value
        });
        command.Parameters.Add(new NpgsqlParameter("categoria", NpgsqlDbType.Text)
        {
            Value = (object?)categoria ?? DBNull.Value
        });
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        var results = new List<Produto>();
        while (await reader.ReadAsync(cancellationToken))
        {
            results.Add(MapRow(reader));
        }

        return results;
    }

    public async Task<bool> SetFotoAsync(Guid id, string fotoUrl, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(Sql.SetFoto, connection);
        command.Parameters.AddWithValue("id", id);
        command.Parameters.AddWithValue("fotoUrl", fotoUrl);
        return await command.ExecuteNonQueryAsync(cancellationToken) > 0;
    }

    private static void AddWriteParameters(NpgsqlCommand command, Produto produto)
    {
        command.Parameters.AddWithValue("id", produto.Id);
        command.Parameters.AddWithValue("tipo", produto.Tipo.ToString());
        command.Parameters.AddWithValue("nome", produto.Nome);
        command.Parameters.Add(new NpgsqlParameter("marcaId", NpgsqlDbType.Uuid)
        {
            Value = (object?)produto.MarcaId ?? DBNull.Value
        });
        command.Parameters.Add(new NpgsqlParameter("categoria", NpgsqlDbType.Text)
        {
            Value = (object?)produto.Categoria ?? DBNull.Value
        });
        command.Parameters.Add(new NpgsqlParameter("tamanho", NpgsqlDbType.Text)
        {
            Value = (object?)produto.Tamanho ?? DBNull.Value
        });
        command.Parameters.AddWithValue("precoReferencia", produto.PrecoReferencia);
        command.Parameters.AddWithValue("estoqueMinimo", produto.EstoqueMinimo);
    }

    private static Produto MapRow(NpgsqlDataReader reader) => new(
        reader.GetGuid(0),
        Enum.Parse<TipoProduto>(reader.GetString(1)),
        reader.GetString(2),
        reader.IsDBNull(3) ? null : reader.GetGuid(3),
        reader.IsDBNull(4) ? null : reader.GetString(4),
        reader.IsDBNull(5) ? null : reader.GetString(5),
        reader.IsDBNull(6) ? null : reader.GetString(6),
        reader.IsDBNull(7) ? null : reader.GetString(7),
        reader.GetDecimal(8),
        reader.GetInt32(9));

    private static class Sql
    {
        private const string SelectColumns = """
            SELECT p.id, p.tipo::text, p.nome, p.marca_id, m.nome, p.categoria,
                   p.tamanho, p.foto_url, p.preco_referencia, p.estoque_minimo
            FROM produtos p
            LEFT JOIN marcas m ON m.id = p.marca_id
            """;

        public const string Insert = """
            INSERT INTO produtos (id, tipo, nome, marca_id, categoria, tamanho, preco_referencia, estoque_minimo)
            VALUES (@id, @tipo::tipo_produto, @nome, @marcaId, @categoria, @tamanho, @precoReferencia, @estoqueMinimo)
            """;

        public const string Update = """
            UPDATE produtos
            SET tipo = @tipo::tipo_produto, nome = @nome, marca_id = @marcaId, categoria = @categoria,
                tamanho = @tamanho, preco_referencia = @precoReferencia, estoque_minimo = @estoqueMinimo,
                updated_at = now()
            WHERE id = @id AND deleted_at IS NULL
            """;

        public const string Get = SelectColumns + " WHERE p.id = @id AND p.deleted_at IS NULL";

        public const string GetFirstByTipo = SelectColumns + """
             WHERE p.tipo = @tipo::tipo_produto AND p.deleted_at IS NULL
             ORDER BY p.created_at LIMIT 1
            """;

        public const string List = SelectColumns + """
             WHERE p.deleted_at IS NULL
               AND (@tipo IS NULL OR p.tipo::text = @tipo)
               AND (@marcaId IS NULL OR p.marca_id = @marcaId)
               AND (@categoria IS NULL OR p.categoria = @categoria)
             ORDER BY p.nome
            """;

        public const string SetFoto =
            "UPDATE produtos SET foto_url = @fotoUrl, updated_at = now() WHERE id = @id AND deleted_at IS NULL";
    }
}
