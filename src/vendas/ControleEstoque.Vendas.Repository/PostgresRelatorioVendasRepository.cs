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

    public async Task<IReadOnlyList<VendasPorFuncionario>> VendasPorFuncionarioAsync(
        DateOnly? inicio, DateOnly? fim, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(Sql.PorFuncionario, connection);
        AddFiltros(command, inicio, fim, null);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        var results = new List<VendasPorFuncionario>();
        while (await reader.ReadAsync(cancellationToken))
        {
            results.Add(new VendasPorFuncionario(
                reader.GetGuid(0), reader.GetString(1), reader.GetInt64(2), reader.GetDecimal(3)));
        }

        return results;
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

        public const string PorFuncionario = """
            SELECT v.funcionario_id, f.nome, COUNT(*)::bigint, COALESCE(SUM(v.total_liquido), 0)
            FROM vendas v
            JOIN funcionarios f ON f.id = v.funcionario_id
            WHERE v.deleted_at IS NULL
              AND (@inicio IS NULL OR v.data::date >= @inicio)
              AND (@fim IS NULL OR v.data::date <= @fim)
            GROUP BY v.funcionario_id, f.nome
            ORDER BY SUM(v.total_liquido) DESC
            """;
    }
}
