using ControleEstoque.Vendas.Domain;
using Npgsql;

namespace ControleEstoque.Vendas.Repository;

public sealed class PostgresVendaLookup : IVendaLookup
{
    private readonly NpgsqlDataSource dataSource;

    public PostgresVendaLookup(NpgsqlDataSource dataSource) => this.dataSource = dataSource;

    public Task<bool> ClienteExisteAsync(Guid clienteId, CancellationToken cancellationToken) =>
        ExistsAsync(Sql.ClienteExiste, clienteId, cancellationToken);

    public Task<bool> FuncionarioExisteAsync(Guid funcionarioId, CancellationToken cancellationToken) =>
        ExistsAsync(Sql.FuncionarioExiste, funcionarioId, cancellationToken);

    public async Task<bool> EnderecoPertenceAoClienteAsync(
        Guid enderecoId, Guid clienteId, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(Sql.EnderecoPertence, connection);
        command.Parameters.AddWithValue("enderecoId", enderecoId);
        command.Parameters.AddWithValue("clienteId", clienteId);
        return (bool?)await command.ExecuteScalarAsync(cancellationToken) == true;
    }

    public async Task<IReadOnlyDictionary<Guid, ProdutoVenda>> GetProdutosAsync(
        IReadOnlyCollection<Guid> produtoIds, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(Sql.GetProdutos, connection);
        command.Parameters.AddWithValue("ids", produtoIds.ToArray());
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        var results = new Dictionary<Guid, ProdutoVenda>();
        while (await reader.ReadAsync(cancellationToken))
        {
            var produto = new ProdutoVenda(
                reader.GetGuid(0), Enum.Parse<TipoProduto>(reader.GetString(1)), reader.GetString(2));
            results[produto.Id] = produto;
        }

        return results;
    }

    public async Task<Guid?> GetProdutoEstruturalAsync(TipoProduto tipo, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(Sql.GetProdutoEstrutural, connection);
        command.Parameters.AddWithValue("tipo", tipo.ToString());
        return (Guid?)await command.ExecuteScalarAsync(cancellationToken);
    }

    public async Task<long> GetSaldoEstoqueAsync(Guid produtoId, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(Sql.GetSaldoEstoque, connection);
        command.Parameters.AddWithValue("produtoId", produtoId);
        return (long?)await command.ExecuteScalarAsync(cancellationToken) ?? 0;
    }

    private async Task<bool> ExistsAsync(string sql, Guid id, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(sql, connection);
        command.Parameters.AddWithValue("id", id);
        return (bool?)await command.ExecuteScalarAsync(cancellationToken) == true;
    }

    private static class Sql
    {
        public const string ClienteExiste =
            "SELECT EXISTS (SELECT 1 FROM clientes WHERE id = @id AND deleted_at IS NULL)";

        public const string FuncionarioExiste =
            "SELECT EXISTS (SELECT 1 FROM funcionarios WHERE id = @id AND deleted_at IS NULL)";

        public const string EnderecoPertence = """
            SELECT EXISTS (SELECT 1 FROM cliente_enderecos
                           WHERE id = @enderecoId AND cliente_id = @clienteId AND deleted_at IS NULL)
            """;

        public const string GetProdutos =
            "SELECT id, tipo::text, nome FROM produtos WHERE id = ANY(@ids) AND deleted_at IS NULL";

        public const string GetProdutoEstrutural = """
            SELECT id FROM produtos
            WHERE tipo = @tipo::tipo_produto AND deleted_at IS NULL
            ORDER BY created_at LIMIT 1
            """;

        public const string GetSaldoEstoque = """
            SELECT COALESCE(SUM(quantidade), 0)::bigint
            FROM movimentos_estoque
            WHERE produto_id = @produtoId AND deleted_at IS NULL
            """;
    }
}
