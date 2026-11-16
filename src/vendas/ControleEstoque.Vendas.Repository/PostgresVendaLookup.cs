using ControleEstoque.Vendas.Domain;
using Npgsql;

namespace ControleEstoque.Vendas.Repository;

public sealed class PostgresVendaLookup : IVendaLookup
{
    private readonly NpgsqlDataSource dataSource;

    public PostgresVendaLookup(NpgsqlDataSource dataSource) => this.dataSource = dataSource;

    public Task<bool> ClienteExisteAsync(Guid clienteId, CancellationToken cancellationToken) =>
        ExistsAsync(Sql.ClienteExiste, clienteId, cancellationToken);

    public async Task<decimal> GetCreditoDisponivelAsync(
        Guid clienteId, Guid? vendaIgnorada, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(Sql.CreditoDisponivel, connection);
        command.Parameters.AddWithValue("clienteId", clienteId);
        command.Parameters.Add(new NpgsqlParameter("vendaIgnorada", NpgsqlTypes.NpgsqlDbType.Uuid)
        {
            Value = (object?)vendaIgnorada ?? DBNull.Value
        });
        return (decimal?)await command.ExecuteScalarAsync(cancellationToken) ?? 0m;
    }

    public async Task<IReadOnlyDictionary<Guid, long>> GetCreditoCascoPorTipoAsync(
        Guid clienteId, IReadOnlyCollection<Guid> tipoCascoIds, Guid? vendaIgnorada,
        CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(Sql.CreditoCascoPorTipo, connection);
        command.Parameters.AddWithValue("clienteId", clienteId);
        command.Parameters.AddWithValue("tipoCascoIds", tipoCascoIds.ToArray());
        command.Parameters.Add(new NpgsqlParameter("vendaIgnorada", NpgsqlTypes.NpgsqlDbType.Uuid)
        {
            Value = (object?)vendaIgnorada ?? DBNull.Value
        });
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        var creditos = new Dictionary<Guid, long>();
        while (await reader.ReadAsync(cancellationToken))
        {
            creditos[reader.GetGuid(0)] = reader.GetInt64(1);
        }

        return creditos;
    }

    public async Task<IReadOnlyDictionary<Guid, long>> GetSaldoCascoPorTipoAsync(
        Guid clienteId, IReadOnlyCollection<Guid> tipoCascoIds, Guid? vendaIgnorada,
        CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(Sql.SaldoCascoPorTipo, connection);
        command.Parameters.AddWithValue("clienteId", clienteId);
        command.Parameters.AddWithValue("tipoCascoIds", tipoCascoIds.ToArray());
        command.Parameters.Add(new NpgsqlParameter("vendaIgnorada", NpgsqlTypes.NpgsqlDbType.Uuid)
        {
            Value = (object?)vendaIgnorada ?? DBNull.Value
        });
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        var saldos = new Dictionary<Guid, long>();
        while (await reader.ReadAsync(cancellationToken))
        {
            saldos[reader.GetGuid(0)] = reader.GetInt64(1);
        }

        return saldos;
    }

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

    public async Task<IReadOnlyDictionary<(Guid ProdutoId, Guid MarcaId), ProdutoVenda>> GetProdutosAsync(
        IReadOnlyCollection<(Guid ProdutoId, Guid MarcaId)> pares, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(Sql.GetProdutos, connection);
        command.Parameters.AddWithValue("produtoIds", pares.Select(p => p.ProdutoId).ToArray());
        command.Parameters.AddWithValue("marcaIds", pares.Select(p => p.MarcaId).ToArray());
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        var results = new Dictionary<(Guid ProdutoId, Guid MarcaId), ProdutoVenda>();
        while (await reader.ReadAsync(cancellationToken))
        {
            var produto = new ProdutoVenda(
                reader.GetGuid(0), reader.GetGuid(1), reader.GetGuid(2),
                Enum.Parse<TipoProduto>(reader.GetString(3)), reader.GetString(4),
                reader.IsDBNull(5) ? null : reader.GetGuid(5),
                reader.IsDBNull(6) ? null : reader.GetGuid(6));
            results[(produto.ProdutoId, produto.MarcaId)] = produto;
        }

        return results;
    }

    public async Task<IReadOnlyDictionary<Guid, TipoCascoVenda>> GetTiposCascoAsync(
        IReadOnlyCollection<Guid> ids, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(Sql.GetTiposCasco, connection);
        command.Parameters.AddWithValue("ids", ids.ToArray());
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        var results = new Dictionary<Guid, TipoCascoVenda>();
        while (await reader.ReadAsync(cancellationToken))
        {
            results[reader.GetGuid(0)] = new TipoCascoVenda(
                reader.GetGuid(0), reader.GetDecimal(1), reader.GetBoolean(2));
        }

        return results;
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

        // Saldo da view sem os lançamentos da venda ignorada (débitos somam de volta, créditos e pagamentos saem).
        public const string CreditoDisponivel = """
            SELECT GREATEST(0, COALESCE((SELECT saldo FROM vw_saldo_fiado_cliente WHERE cliente_id = @clienteId), 0)
                + COALESCE((SELECT SUM(CASE WHEN tipo IN ('CREDITO_CONVERSAO_SUCATA', 'PAGAMENTO', 'CREDITO_SOBRA_VENDA') THEN -valor ELSE valor END)
                            FROM lancamentos_fiado
                            WHERE venda_id = @vendaIgnorada AND cliente_id = @clienteId AND deleted_at IS NULL), 0))
            """;

        // Mesma conta de vw_saldo_casco_cliente por tipo (positivo = cliente deve): crédito = max(0, -saldo).
        public const string CreditoCascoPorTipo = """
            SELECT tipo_casco_id,
                   (-SUM(CASE tipo
                       WHEN 'EMPRESTIMO'      THEN  quantidade
                       WHEN 'DEVOLUCAO'       THEN -quantidade
                       WHEN 'CONVERSAO_VALOR' THEN -quantidade
                   END))::bigint
            FROM movimentos_casco_cliente
            WHERE cliente_id = @clienteId AND tipo_casco_id = ANY(@tipoCascoIds) AND deleted_at IS NULL
              AND (@vendaIgnorada IS NULL OR venda_id IS NULL OR venda_id <> @vendaIgnorada)
            GROUP BY tipo_casco_id
            HAVING SUM(CASE tipo
                       WHEN 'EMPRESTIMO'      THEN  quantidade
                       WHEN 'DEVOLUCAO'       THEN -quantidade
                       WHEN 'CONVERSAO_VALOR' THEN -quantidade
                   END) < 0
            """;

        // Mesma conta de vw_saldo_casco_cliente por tipo (positivo = cliente deve): devedor = max(0, saldo).
        public const string SaldoCascoPorTipo = """
            SELECT tipo_casco_id,
                   (SUM(CASE tipo
                       WHEN 'EMPRESTIMO'      THEN  quantidade
                       WHEN 'DEVOLUCAO'       THEN -quantidade
                       WHEN 'CONVERSAO_VALOR' THEN -quantidade
                   END))::bigint
            FROM movimentos_casco_cliente
            WHERE cliente_id = @clienteId AND tipo_casco_id = ANY(@tipoCascoIds) AND deleted_at IS NULL
              AND (@vendaIgnorada IS NULL OR venda_id IS NULL OR venda_id <> @vendaIgnorada)
            GROUP BY tipo_casco_id
            HAVING SUM(CASE tipo
                       WHEN 'EMPRESTIMO'      THEN  quantidade
                       WHEN 'DEVOLUCAO'       THEN -quantidade
                       WHEN 'CONVERSAO_VALOR' THEN -quantidade
                   END) > 0
            """;

        public const string FuncionarioExiste =
            "SELECT EXISTS (SELECT 1 FROM funcionarios WHERE id = @id AND deleted_at IS NULL)";

        public const string EnderecoPertence = """
            SELECT EXISTS (SELECT 1 FROM cliente_enderecos
                           WHERE id = @enderecoId AND cliente_id = @clienteId AND deleted_at IS NULL)
            """;

        public const string GetProdutos = """
            SELECT pm.id, pm.produto_id, pm.marca_id, p.tipo::text, p.nome, p.tipo_casco_id, pm.tipo_casco_id
            FROM unnest(@produtoIds::uuid[], @marcaIds::uuid[]) AS par(produto_id, marca_id)
            JOIN produto_marcas pm ON pm.produto_id = par.produto_id AND pm.marca_id = par.marca_id
            JOIN produtos p ON p.id = pm.produto_id
            WHERE pm.deleted_at IS NULL AND p.deleted_at IS NULL
            """;

        public const string GetTiposCasco =
            "SELECT id, preco_vasilhame, aceita_sucata FROM tipos_casco WHERE id = ANY(@ids)";
    }
}
