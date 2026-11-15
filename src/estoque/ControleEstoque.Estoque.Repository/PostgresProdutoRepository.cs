using ControleEstoque.Estoque.Domain;
using ControleEstoque.Shared.Results;
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
        return await GetAsync(connection, id, cancellationToken);
    }

    public async Task<Produto?> GetByProdutoMarcaAsync(Guid produtoMarcaId, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(Sql.ProdutoIdDaMarca, connection);
        command.Parameters.AddWithValue("id", produtoMarcaId);
        if (await command.ExecuteScalarAsync(cancellationToken) is not Guid produtoId)
        {
            return null;
        }

        return await GetAsync(connection, produtoId, cancellationToken);
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
        var produtos = await LerProdutosAsync(command, cancellationToken);
        return await AnexarMarcasAsync(connection, produtos, cancellationToken);
    }

    public async Task AddMarcaAsync(Guid produtoId, ProdutoMarca marca, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(Sql.InsertMarca, connection);
        command.Parameters.AddWithValue("produtoId", produtoId);
        AddMarcaParameters(command, marca);
        await ExecutarMarcaAsync(command, cancellationToken);
    }

    public async Task<bool> UpdateMarcaAsync(Guid produtoId, ProdutoMarca marca, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(Sql.UpdateMarca, connection);
        command.Parameters.AddWithValue("produtoId", produtoId);
        AddMarcaParameters(command, marca);
        return await ExecutarMarcaAsync(command, cancellationToken) > 0;
    }

    public async Task<bool> SetFotoAsync(Guid produtoMarcaId, string fotoUrl, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(Sql.SetFoto, connection);
        command.Parameters.AddWithValue("id", produtoMarcaId);
        command.Parameters.AddWithValue("fotoUrl", fotoUrl);
        return await command.ExecuteNonQueryAsync(cancellationToken) > 0;
    }

    private static async Task<Produto?> GetAsync(
        NpgsqlConnection connection, Guid id, CancellationToken cancellationToken)
    {
        await using var command = new NpgsqlCommand(Sql.Get, connection);
        command.Parameters.AddWithValue("id", id);
        var produtos = await LerProdutosAsync(command, cancellationToken);
        return (await AnexarMarcasAsync(connection, produtos, cancellationToken)).FirstOrDefault();
    }

    // A unicidade (produto_id, marca_id) é do banco; a checagem do domínio perde para a corrida.
    private static async Task<int> ExecutarMarcaAsync(NpgsqlCommand command, CancellationToken cancellationToken)
    {
        try
        {
            return await command.ExecuteNonQueryAsync(cancellationToken);
        }
        catch (PostgresException e) when (e.SqlState == PostgresErrorCodes.UniqueViolation)
        {
            throw new ConflictException("MARCA_DUPLICADA", "O produto já tem associação com esta marca.");
        }
    }

    private static void AddWriteParameters(NpgsqlCommand command, Produto produto)
    {
        command.Parameters.AddWithValue("id", produto.Id);
        command.Parameters.AddWithValue("tipo", produto.Tipo.ToString());
        command.Parameters.AddWithValue("nome", produto.Nome);
        command.Parameters.Add(new NpgsqlParameter("categoria", NpgsqlDbType.Text)
        {
            Value = (object?)produto.Categoria ?? DBNull.Value
        });
        command.Parameters.Add(new NpgsqlParameter("tamanho", NpgsqlDbType.Text)
        {
            Value = (object?)produto.Tamanho ?? DBNull.Value
        });
        command.Parameters.Add(new NpgsqlParameter("tipoCascoId", NpgsqlDbType.Uuid)
        {
            Value = (object?)produto.TipoCascoId ?? DBNull.Value
        });
    }

    private static void AddMarcaParameters(NpgsqlCommand command, ProdutoMarca marca)
    {
        command.Parameters.AddWithValue("id", marca.Id);
        command.Parameters.AddWithValue("marcaId", marca.MarcaId);
        command.Parameters.Add(new NpgsqlParameter("tipoCascoId", NpgsqlDbType.Uuid)
        {
            Value = (object?)marca.TipoCascoId ?? DBNull.Value
        });
        command.Parameters.AddWithValue("precoReferencia", marca.PrecoReferencia);
        command.Parameters.AddWithValue("estoqueMinimo", marca.EstoqueMinimo);
    }

    private static async Task<List<Produto>> LerProdutosAsync(NpgsqlCommand command, CancellationToken cancellationToken)
    {
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        var results = new List<Produto>();
        while (await reader.ReadAsync(cancellationToken))
        {
            results.Add(new Produto(
                reader.GetGuid(0),
                Enum.Parse<TipoProduto>(reader.GetString(1)),
                reader.GetString(2),
                reader.IsDBNull(3) ? null : reader.GetString(3),
                reader.IsDBNull(4) ? null : reader.GetString(4),
                reader.IsDBNull(5) ? null : reader.GetGuid(5),
                []));
        }

        return results;
    }

    /// <summary>Carrega as associações (com a quantidade de cada uma) de todos os produtos de uma vez.</summary>
    private static async Task<IReadOnlyList<Produto>> AnexarMarcasAsync(
        NpgsqlConnection connection, List<Produto> produtos, CancellationToken cancellationToken)
    {
        if (produtos.Count == 0)
        {
            return produtos;
        }

        var porProduto = new Dictionary<Guid, List<ProdutoMarca>>();
        await using (var command = new NpgsqlCommand(Sql.Marcas, connection))
        {
            command.Parameters.AddWithValue("ids", produtos.Select(p => p.Id).ToArray());
            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            while (await reader.ReadAsync(cancellationToken))
            {
                var produtoId = reader.GetGuid(0);
                if (!porProduto.TryGetValue(produtoId, out var lista))
                {
                    porProduto[produtoId] = lista = [];
                }

                lista.Add(new ProdutoMarca(
                    reader.GetGuid(1),
                    reader.GetGuid(2),
                    reader.GetString(3),
                    reader.GetDecimal(4),
                    reader.GetInt32(5),
                    reader.GetInt64(6),
                    reader.IsDBNull(7) ? null : reader.GetString(7),
                    reader.IsDBNull(8) ? null : reader.GetGuid(8)));
            }
        }

        return produtos
            .Select(p => p with { Marcas = porProduto.GetValueOrDefault(p.Id) ?? [] })
            .ToList();
    }

    private static class Sql
    {
        private const string SelectColumns = """
            SELECT p.id, p.tipo::text, p.nome, p.categoria, p.tamanho, p.tipo_casco_id
            FROM produtos p
            """;

        public const string Insert = """
            INSERT INTO produtos (id, tipo, nome, categoria, tamanho, tipo_casco_id)
            VALUES (@id, @tipo::tipo_produto, @nome, @categoria, @tamanho, @tipoCascoId)
            """;

        public const string Update = """
            UPDATE produtos
            SET tipo = @tipo::tipo_produto, nome = @nome, categoria = @categoria,
                tamanho = @tamanho, tipo_casco_id = @tipoCascoId, updated_at = now()
            WHERE id = @id AND deleted_at IS NULL
            """;

        public const string Get = SelectColumns + " WHERE p.id = @id AND p.deleted_at IS NULL";

        public const string ProdutoIdDaMarca = """
            SELECT pm.produto_id
            FROM produto_marcas pm
            JOIN produtos p ON p.id = pm.produto_id AND p.deleted_at IS NULL
            WHERE pm.id = @id AND pm.deleted_at IS NULL
            """;

        public const string List = SelectColumns + """
             WHERE p.deleted_at IS NULL
               AND (@tipo IS NULL OR p.tipo::text = @tipo)
               AND (@marcaId IS NULL OR EXISTS (
                    SELECT 1 FROM produto_marcas pm
                    WHERE pm.produto_id = p.id AND pm.marca_id = @marcaId AND pm.deleted_at IS NULL))
               AND (@categoria IS NULL OR p.categoria = @categoria)
             ORDER BY p.nome
            """;

        public const string Marcas = """
            SELECT pm.produto_id, pm.id, pm.marca_id, ma.nome, pm.preco_referencia, pm.estoque_minimo,
                   COALESCE(SUM(m.quantidade), 0)::bigint, pm.foto_url, pm.tipo_casco_id
            FROM produto_marcas pm
            JOIN marcas ma ON ma.id = pm.marca_id
            LEFT JOIN movimentos_estoque m ON m.produto_marca_id = pm.id AND m.deleted_at IS NULL
            WHERE pm.produto_id = ANY(@ids) AND pm.deleted_at IS NULL
            GROUP BY pm.id, ma.nome
            ORDER BY ma.nome
            """;

        public const string InsertMarca = """
            INSERT INTO produto_marcas (id, produto_id, marca_id, tipo_casco_id, preco_referencia, estoque_minimo)
            VALUES (@id, @produtoId, @marcaId, @tipoCascoId, @precoReferencia, @estoqueMinimo)
            """;

        public const string UpdateMarca = """
            UPDATE produto_marcas
            SET marca_id = @marcaId, tipo_casco_id = @tipoCascoId, preco_referencia = @precoReferencia,
                estoque_minimo = @estoqueMinimo, updated_at = now()
            WHERE id = @id AND produto_id = @produtoId AND deleted_at IS NULL
            """;

        public const string SetFoto = """
            UPDATE produto_marcas SET foto_url = @fotoUrl, updated_at = now()
            WHERE id = @id AND deleted_at IS NULL
            """;
    }
}
