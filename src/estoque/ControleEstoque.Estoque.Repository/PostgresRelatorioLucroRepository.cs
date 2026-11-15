using ControleEstoque.Estoque.Domain;
using Npgsql;
using NpgsqlTypes;

namespace ControleEstoque.Estoque.Repository;

/// <summary>Lê vendas (do mesmo banco) e cargas; a conta do lucro é <see cref="LucroPorProduto"/>.</summary>
public sealed class PostgresRelatorioLucroRepository : IRelatorioLucroRepository
{
    private readonly NpgsqlDataSource dataSource;

    public PostgresRelatorioLucroRepository(NpgsqlDataSource dataSource) => this.dataSource = dataSource;

    public async Task<IReadOnlyList<VendaProdutoMarcaDia>> ListVendasAsync(
        DateOnly? inicio, DateOnly? fim, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(Sql.Vendas, connection);
        AddData(command, "inicio", inicio);
        AddData(command, "fim", fim);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        var lista = new List<VendaProdutoMarcaDia>();
        while (await reader.ReadAsync(cancellationToken))
        {
            var quantidade = reader.GetInt32(6);
            var totalItem = reader.GetDecimal(7);
            lista.Add(new VendaProdutoMarcaDia(
                reader.GetGuid(0), reader.GetGuid(1), reader.GetString(2), reader.GetGuid(3), reader.GetString(4),
                DateOnly.FromDateTime(reader.GetDateTime(5)), quantidade, totalItem,
                LucroPorProduto.RatearVasilhame(
                    totalItem, quantidade, reader.GetDecimal(8), reader.GetBoolean(9),
                    reader.IsDBNull(10) ? null : reader.GetDecimal(10))));
        }

        return lista;
    }

    public async Task<IReadOnlyList<CargaCusto>> ListCargasAsync(
        DateOnly? fim, IReadOnlyList<Guid> produtoMarcaIds, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);

        var cabecalhos = new List<(Guid Id, DateOnly Data, decimal? Frete)>();
        await using (var command = new NpgsqlCommand(Sql.Cargas, connection))
        {
            AddData(command, "fim", fim);
            command.Parameters.AddWithValue("produtoMarcaIds", produtoMarcaIds.ToArray());
            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            while (await reader.ReadAsync(cancellationToken))
            {
                cabecalhos.Add((
                    reader.GetGuid(0),
                    DateOnly.FromDateTime(reader.GetDateTime(1)),
                    reader.IsDBNull(2) ? null : reader.GetDecimal(2)));
            }
        }

        var ids = cabecalhos.Select(c => c.Id).ToArray();
        var itens = await LerLinhasAsync(connection, Sql.Itens, ids, cancellationToken);
        var cascos = await LerLinhasAsync(connection, Sql.Cascos, ids, cancellationToken);
        return cabecalhos
            .Select(c => new CargaCusto(
                c.Data, c.Frete, itens.GetValueOrDefault(c.Id) ?? [], cascos.GetValueOrDefault(c.Id) ?? []))
            .ToList();
    }

    private static async Task<Dictionary<Guid, IReadOnlyList<LinhaCarga>>> LerLinhasAsync(
        NpgsqlConnection connection, string sql, Guid[] abastecimentoIds, CancellationToken cancellationToken)
    {
        await using var command = new NpgsqlCommand(sql, connection);
        command.Parameters.AddWithValue("ids", abastecimentoIds);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        var porCarga = new Dictionary<Guid, List<LinhaCarga>>();
        while (await reader.ReadAsync(cancellationToken))
        {
            var cargaId = reader.GetGuid(0);
            if (!porCarga.TryGetValue(cargaId, out var linhas))
            {
                porCarga[cargaId] = linhas = [];
            }

            linhas.Add(new LinhaCarga(
                reader.GetGuid(1), reader.GetGuid(2), reader.GetInt32(3),
                reader.IsDBNull(4) ? null : reader.GetDecimal(4)));
        }

        return porCarga.ToDictionary(p => p.Key, p => (IReadOnlyList<LinhaCarga>)p.Value);
    }

    private static void AddData(NpgsqlCommand command, string nome, DateOnly? valor) =>
        command.Parameters.Add(new NpgsqlParameter(nome, NpgsqlDbType.Date) { Value = (object?)valor ?? DBNull.Value });

    private static class Sql
    {
        // Mesmo filtro de PostgresRelatorioVendasRepository.FiltroBase (sem filtro de produto).
        // Uma linha por item; o rateio do vasilhame é LucroPorProduto.RatearVasilhame.
        public const string Vendas = """
            SELECT pm.id, p.id, p.nome, m.id, m.nome, v.data::date, i.quantidade, i.total_item,
                   i.preco_unitario, i.pagou_vasilhame, i.preco_vasilhame
            FROM venda_itens i
            JOIN vendas v ON v.id = i.venda_id
            JOIN produto_marcas pm ON pm.id = i.produto_marca_id
            JOIN produtos p ON p.id = pm.produto_id
            JOIN marcas m ON m.id = pm.marca_id
            WHERE i.deleted_at IS NULL AND v.deleted_at IS NULL
              AND (@inicio IS NULL OR v.data::date >= @inicio)
              AND (@fim IS NULL OR v.data::date <= @fim)
            """;

        public const string Cargas = """
            SELECT a.id, a.data, a.frete
            FROM abastecimentos a
            WHERE a.deleted_at IS NULL
              AND (@fim IS NULL OR a.data <= @fim)
              AND EXISTS (SELECT 1 FROM abastecimento_itens i
                          WHERE i.abastecimento_id = a.id AND i.produto_marca_id = ANY(@produtoMarcaIds))
            """;

        public const string Itens = """
            SELECT abastecimento_id, id, produto_marca_id, quantidade, custo_unitario
            FROM abastecimento_itens WHERE abastecimento_id = ANY(@ids)
            """;

        public const string Cascos = """
            SELECT abastecimento_id, id, tipo_casco_id, quantidade, custo_unitario
            FROM abastecimento_cascos WHERE abastecimento_id = ANY(@ids)
            """;
    }
}
