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

        var porDia = new List<FaturamentoPorDia>();
        await using (var command = new NpgsqlCommand(Sql.PorDia, connection))
        {
            AddFiltros(command, inicio, fim, produtoId);
            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            while (await reader.ReadAsync(cancellationToken))
            {
                porDia.Add(new FaturamentoPorDia(
                    reader.GetFieldValue<DateOnly>(0), reader.GetDecimal(1)));
            }
        }

        return new RelatorioFaturamento(totalBruto, totalDesconto, totalLiquido, porProduto, porDia);
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
            WHERE i.deleted_at IS NULL AND v.deleted_at IS NULL
              AND (@inicio IS NULL OR v.data::date >= @inicio)
              AND (@fim IS NULL OR v.data::date <= @fim)
              AND (@produtoId IS NULL OR i.produto_id = @produtoId)
            """;

        public const string Totais = """
            SELECT COALESCE(SUM(i.quantidade * i.preco_unitario), 0),
                   COALESCE(SUM(i.quantidade * i.preco_unitario - i.total_item), 0),
                   COALESCE(SUM(i.total_item), 0)
            """ + FiltroBase;

        public const string PorProduto = """
            SELECT i.produto_id, p.nome, SUM(i.quantidade)::bigint, SUM(i.total_item)
            FROM venda_itens i
            JOIN vendas v ON v.id = i.venda_id
            JOIN produtos p ON p.id = i.produto_id
            WHERE i.deleted_at IS NULL AND v.deleted_at IS NULL
              AND (@inicio IS NULL OR v.data::date >= @inicio)
              AND (@fim IS NULL OR v.data::date <= @fim)
              AND (@produtoId IS NULL OR i.produto_id = @produtoId)
            GROUP BY i.produto_id, p.nome
            ORDER BY SUM(i.total_item) DESC
            """;

        public const string PorDia = """
            SELECT v.data::date, SUM(i.total_item)
            """ + FiltroBase + """

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
