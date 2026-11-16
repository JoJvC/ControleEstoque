using ControleEstoque.Vendas.Domain;
using Npgsql;
using NpgsqlTypes;

namespace ControleEstoque.Vendas.Repository;

public sealed class PostgresRelatorioVendasRepository : IRelatorioVendasRepository
{
    private readonly NpgsqlDataSource dataSource;

    public PostgresRelatorioVendasRepository(NpgsqlDataSource dataSource) => this.dataSource = dataSource;

    public async Task<RelatorioFaturamento> FaturamentoAsync(
        DateOnly? inicio, DateOnly? fim, Guid? produtoId, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);

        decimal totalBruto, totalDesconto, totalLiquido;
        await using (var command = new NpgsqlCommand(Sql.Totais, connection))
        {
            AddFiltros(command, inicio, fim, produtoId);
            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            await reader.ReadAsync(cancellationToken);
            totalBruto = reader.GetDecimal(0);
            totalDesconto = reader.GetDecimal(1);
            totalLiquido = reader.GetDecimal(2);
        }

        var porProduto = new List<FaturamentoPorProduto>();
        await using (var command = new NpgsqlCommand(Sql.PorProduto, connection))
        {
            AddFiltros(command, inicio, fim, produtoId);
            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            while (await reader.ReadAsync(cancellationToken))
            {
                porProduto.Add(new FaturamentoPorProduto(
                    reader.GetGuid(0), reader.GetString(1), reader.GetInt64(2), reader.GetDecimal(3)));
            }
        }

        var liquidoPorDia = new Dictionary<DateOnly, decimal>();
        await using (var command = new NpgsqlCommand(Sql.PorDia, connection))
        {
            AddFiltros(command, inicio, fim, produtoId);
            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            while (await reader.ReadAsync(cancellationToken))
            {
                liquidoPorDia[reader.GetFieldValue<DateOnly>(0)] = reader.GetDecimal(1);
            }
        }

        // Pagamento e fiado não se repartem por produto: com produtoId ficam em 0.
        var recebidoPorDia = new Dictionary<DateOnly, decimal>();
        var fiadoPorDia = new Dictionary<DateOnly, decimal>();
        if (produtoId is null)
        {
            await LerPorDiaAsync(connection, Sql.RecebidoPorDia, inicio, fim, recebidoPorDia, cancellationToken);
            await LerPorDiaAsync(connection, Sql.FiadoGeradoPorDia, inicio, fim, fiadoPorDia, cancellationToken);
        }

        var porDia = SerieDiariaFaturamento.Montar(liquidoPorDia, recebidoPorDia, fiadoPorDia);

        var linhasCategoria = new List<(string? Categoria, long Quantidade, decimal Total)>();
        await using (var command = new NpgsqlCommand(Sql.PorCategoria, connection))
        {
            AddFiltros(command, inicio, fim, produtoId);
            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            while (await reader.ReadAsync(cancellationToken))
            {
                linhasCategoria.Add((
                    reader.IsDBNull(0) ? null : reader.GetString(0),
                    reader.GetInt64(1),
                    reader.GetDecimal(2)));
            }
        }

        return new RelatorioFaturamento(
            totalBruto, totalDesconto, totalLiquido, porProduto, porDia,
            FaturamentoCategorias.Consolidar(linhasCategoria),
            recebidoPorDia.Values.Sum(), fiadoPorDia.Values.Sum());
    }

    public async Task<RelatorioVendasPorFuncionario> VendasPorFuncionarioAsync(
        DateOnly? inicio, DateOnly? fim, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);

        var cabecalhos = new List<(Guid Id, FuncionarioRelatorio Funcionario, bool DePedido, decimal TotalLiquido, decimal DescontoSucata)>();
        await foreach (var r in LerAsync(connection, Sql.PorFuncionarioVendas, inicio, fim, cancellationToken))
        {
            cabecalhos.Add((r.GetGuid(0), new FuncionarioRelatorio(r.GetGuid(1), r.GetString(2)), r.GetBoolean(3),
                r.GetDecimal(4), r.GetDecimal(5)));
        }

        var funcionariosPedido = new Dictionary<Guid, List<FuncionarioRelatorio>>();
        await foreach (var r in LerAsync(connection, Sql.PorFuncionarioPedido, inicio, fim, cancellationToken))
        {
            Lista(funcionariosPedido, r.GetGuid(0)).Add(new FuncionarioRelatorio(r.GetGuid(1), r.GetString(2)));
        }

        var itens = new Dictionary<Guid, List<ItemVendaRelatorio>>();
        await foreach (var r in LerAsync(connection, Sql.PorFuncionarioItens, inicio, fim, cancellationToken))
        {
            Lista(itens, r.GetGuid(0)).Add(new ItemVendaRelatorio(
                r.GetGuid(1), r.GetString(2), r.GetGuid(3), r.GetString(4), r.GetInt32(5), r.GetDecimal(6)));
        }

        var vasilhames = new Dictionary<Guid, List<VasilhameVendaRelatorio>>();
        await foreach (var r in LerAsync(connection, Sql.PorFuncionarioVasilhames, inicio, fim, cancellationToken))
        {
            Lista(vasilhames, r.GetGuid(0)).Add(new VasilhameVendaRelatorio(
                r.GetGuid(1), r.GetString(2), r.GetInt32(3), r.GetDecimal(4)));
        }

        var vendas = cabecalhos.Select(c => new VendaParaRelatorio(
            c.Id, c.Funcionario, c.DePedido,
            funcionariosPedido.GetValueOrDefault(c.Id) ?? [], c.TotalLiquido, c.DescontoSucata,
            itens.GetValueOrDefault(c.Id) ?? [], vasilhames.GetValueOrDefault(c.Id) ?? [])).ToList();
        return VendasPorFuncionarioAgrupado.Montar(inicio, fim, vendas);
    }

    private static List<T> Lista<T>(Dictionary<Guid, List<T>> destino, Guid chave) =>
        destino.TryGetValue(chave, out var lista) ? lista : destino[chave] = [];

    private static async IAsyncEnumerable<NpgsqlDataReader> LerAsync(
        NpgsqlConnection connection, string sql, DateOnly? inicio, DateOnly? fim,
        [System.Runtime.CompilerServices.EnumeratorCancellation] CancellationToken cancellationToken)
    {
        await using var command = new NpgsqlCommand(sql, connection);
        AddFiltros(command, inicio, fim, null);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            yield return reader;
        }
    }

    private static async Task LerPorDiaAsync(
        NpgsqlConnection connection, string sql, DateOnly? inicio, DateOnly? fim,
        Dictionary<DateOnly, decimal> destino, CancellationToken cancellationToken)
    {
        await using var command = new NpgsqlCommand(sql, connection);
        AddFiltros(command, inicio, fim, null);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            destino[reader.GetFieldValue<DateOnly>(0)] = reader.GetDecimal(1);
        }
    }

    private static void AddFiltros(NpgsqlCommand command, DateOnly? inicio, DateOnly? fim, Guid? produtoId)
    {
        command.Parameters.Add(new NpgsqlParameter("inicio", NpgsqlDbType.Date)
        {
            Value = (object?)inicio ?? DBNull.Value
        });
        command.Parameters.Add(new NpgsqlParameter("fim", NpgsqlDbType.Date)
        {
            Value = (object?)fim ?? DBNull.Value
        });
        if (command.CommandText.Contains("@produtoId", StringComparison.Ordinal))
        {
            command.Parameters.Add(new NpgsqlParameter("produtoId", NpgsqlDbType.Uuid)
            {
                Value = (object?)produtoId ?? DBNull.Value
            });
        }
    }

    private static class Sql
    {
        private const string FiltroBase = """
            FROM venda_itens i
            JOIN vendas v ON v.id = i.venda_id
            JOIN produto_marcas pm ON pm.id = i.produto_marca_id
            WHERE i.deleted_at IS NULL AND v.deleted_at IS NULL
              AND (@inicio IS NULL OR v.data::date >= @inicio)
              AND (@fim IS NULL OR v.data::date <= @fim)
              AND (@produtoId IS NULL OR pm.produto_id = @produtoId)
            """;

        // Só os itens: vasilhame vendido e desconto por sucata ficam fora deste relatório.
        public const string Totais = """
            SELECT COALESCE(SUM(i.quantidade * i.preco_unitario), 0),
                   COALESCE(SUM(i.quantidade * i.preco_unitario - i.total_item), 0),
                   COALESCE(SUM(i.total_item), 0)
            """ + FiltroBase;

        public const string PorProduto = """
            SELECT pm.produto_id, p.nome, SUM(i.quantidade)::bigint, SUM(i.total_item)
            FROM venda_itens i
            JOIN vendas v ON v.id = i.venda_id
            JOIN produto_marcas pm ON pm.id = i.produto_marca_id
            JOIN produtos p ON p.id = pm.produto_id
            WHERE i.deleted_at IS NULL AND v.deleted_at IS NULL
              AND (@inicio IS NULL OR v.data::date >= @inicio)
              AND (@fim IS NULL OR v.data::date <= @fim)
              AND (@produtoId IS NULL OR pm.produto_id = @produtoId)
            GROUP BY pm.produto_id, p.nome
            ORDER BY SUM(i.total_item) DESC
            """;

        public const string PorCategoria = """
            SELECT p.categoria, SUM(i.quantidade)::bigint, SUM(i.total_item)
            FROM venda_itens i
            JOIN vendas v ON v.id = i.venda_id
            JOIN produto_marcas pm ON pm.id = i.produto_marca_id
            JOIN produtos p ON p.id = pm.produto_id
            WHERE i.deleted_at IS NULL AND v.deleted_at IS NULL
              AND (@inicio IS NULL OR v.data::date >= @inicio)
              AND (@fim IS NULL OR v.data::date <= @fim)
              AND (@produtoId IS NULL OR pm.produto_id = @produtoId)
            GROUP BY p.categoria
            """;

        public const string PorDia = """
            SELECT v.data::date, SUM(i.total_item)
            """ + FiltroBase + """

            GROUP BY v.data::date
            ORDER BY v.data::date
            """;

        // Mesma regra das entradas do caixa: pagamentos de venda ativa + recebimento de fiado avulso.
        public const string RecebidoPorDia = """
            SELECT dia, SUM(valor) FROM (
                SELECT p.data::date AS dia, p.valor
                FROM venda_pagamentos p
                JOIN vendas v ON v.id = p.venda_id
                WHERE p.deleted_at IS NULL AND v.deleted_at IS NULL
                  AND p.forma <> 'CREDITO_CLIENTE' -- crédito usado não é dinheiro recebido
                  AND p.lancamento_fiado_id IS NULL -- recebimento de fiado conta pelo lançamento PAGAMENTO
                UNION ALL
                SELECT l.created_at::date, l.valor
                FROM lancamentos_fiado l
                WHERE l.deleted_at IS NULL AND l.tipo = 'PAGAMENTO' AND l.venda_id IS NULL
            ) r
            WHERE (@inicio IS NULL OR dia >= @inicio)
              AND (@fim IS NULL OR dia <= @fim)
            GROUP BY dia
            ORDER BY dia
            """;

        public const string FiadoGeradoPorDia = """
            SELECT v.data::date, SUM(l.valor)
            FROM lancamentos_fiado l
            JOIN vendas v ON v.id = l.venda_id
            WHERE l.deleted_at IS NULL AND v.deleted_at IS NULL AND l.tipo = 'DEBITO_VENDA'
              AND (@inicio IS NULL OR v.data::date >= @inicio)
              AND (@fim IS NULL OR v.data::date <= @fim)
            GROUP BY v.data::date
            ORDER BY v.data::date
            """;

        // Quatro leituras do mesmo período (venda, funcionários do pedido, itens, vasilhames); a atribuição é do domínio.
        public const string PorFuncionarioVendas = """
            SELECT v.id, v.funcionario_id, f.nome, (p.id IS NOT NULL), v.total_liquido, v.desconto_sucata
            FROM vendas v
            JOIN funcionarios f ON f.id = v.funcionario_id
            LEFT JOIN pedidos p ON p.venda_id = v.id
            WHERE v.deleted_at IS NULL
              AND (@inicio IS NULL OR v.data::date >= @inicio)
              AND (@fim IS NULL OR v.data::date <= @fim)
            """;

        public const string PorFuncionarioPedido = """
            SELECT p.venda_id, pf.funcionario_id, f.nome
            FROM pedidos p
            JOIN vendas v ON v.id = p.venda_id
            JOIN pedido_funcionarios pf ON pf.pedido_id = p.id
            JOIN funcionarios f ON f.id = pf.funcionario_id
            WHERE v.deleted_at IS NULL
              AND (@inicio IS NULL OR v.data::date >= @inicio)
              AND (@fim IS NULL OR v.data::date <= @fim)
            """;

        public const string PorFuncionarioItens = """
            SELECT i.venda_id, pm.produto_id, p.nome, pm.marca_id, m.nome, i.quantidade, i.total_item
            FROM venda_itens i
            JOIN vendas v ON v.id = i.venda_id
            JOIN produto_marcas pm ON pm.id = i.produto_marca_id
            JOIN produtos p ON p.id = pm.produto_id
            JOIN marcas m ON m.id = pm.marca_id
            WHERE i.deleted_at IS NULL AND v.deleted_at IS NULL
              AND (@inicio IS NULL OR v.data::date >= @inicio)
              AND (@fim IS NULL OR v.data::date <= @fim)
            """;

        public const string PorFuncionarioVasilhames = """
            SELECT vv.venda_id, vv.tipo_casco_id, tc.nome, vv.quantidade, vv.total
            FROM venda_vasilhames vv
            JOIN vendas v ON v.id = vv.venda_id
            JOIN tipos_casco tc ON tc.id = vv.tipo_casco_id
            WHERE vv.deleted_at IS NULL AND v.deleted_at IS NULL
              AND (@inicio IS NULL OR v.data::date >= @inicio)
              AND (@fim IS NULL OR v.data::date <= @fim)
            """;
    }
}
