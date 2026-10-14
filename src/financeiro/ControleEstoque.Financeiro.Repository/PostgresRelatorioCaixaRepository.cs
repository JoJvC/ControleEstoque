using ControleEstoque.Financeiro.Domain;
using Npgsql;
using NpgsqlTypes;

namespace ControleEstoque.Financeiro.Repository;

public sealed class PostgresRelatorioCaixaRepository : IRelatorioCaixaRepository
{
    private readonly NpgsqlDataSource dataSource;

    public PostgresRelatorioCaixaRepository(NpgsqlDataSource dataSource) => this.dataSource = dataSource;

    public async Task<RelatorioCaixa> CaixaPorPeriodoAsync(
        DateOnly? inicio, DateOnly? fim, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);

        var dias = new List<DiaCaixa>();
        await using (var command = new NpgsqlCommand(Sql.Dias, connection))
        {
            AddFiltros(command, inicio, fim);
            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            while (await reader.ReadAsync(cancellationToken))
            {
                dias.Add(new DiaCaixa(
                    reader.GetFieldValue<DateOnly>(0),
                    Enum.Parse<StatusCaixa>(reader.GetString(1)),
                    reader.GetDecimal(2),
                    reader.GetDecimal(3),
                    reader.GetDecimal(4),
                    reader.IsDBNull(5) ? null : reader.GetDecimal(5)));
            }
        }

        var despesasPorTipo = new List<DespesaPorTipo>();
        await using (var command = new NpgsqlCommand(Sql.DespesasPorTipo, connection))
        {
            AddFiltros(command, inicio, fim);
            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            while (await reader.ReadAsync(cancellationToken))
            {
                despesasPorTipo.Add(new DespesaPorTipo(reader.GetString(0), reader.GetDecimal(1)));
            }
        }

        return new RelatorioCaixa(dias, despesasPorTipo);
    }

    private static void AddFiltros(NpgsqlCommand command, DateOnly? inicio, DateOnly? fim)
    {
        command.Parameters.Add(new NpgsqlParameter("inicio", NpgsqlDbType.Date)
        {
            Value = (object?)inicio ?? DBNull.Value
        });
        command.Parameters.Add(new NpgsqlParameter("fim", NpgsqlDbType.Date)
        {
            Value = (object?)fim ?? DBNull.Value
        });
    }

    private static class Sql
    {
        public const string Dias = """
            SELECT c.data, c.status::text, c.saldo_inicial,
                   COALESCE(c.total_entradas,
                       COALESCE((SELECT SUM(p.valor)
                                 FROM venda_pagamentos p
                                 JOIN vendas v ON v.id = p.venda_id
                                 WHERE p.deleted_at IS NULL AND v.deleted_at IS NULL
                                   AND p.data::date = c.data), 0)
                     + COALESCE((SELECT SUM(l.valor)
                                 FROM lancamentos_fiado l
                                 WHERE l.deleted_at IS NULL AND l.tipo = 'PAGAMENTO'
                                   AND l.venda_id IS NULL AND l.created_at::date = c.data), 0)),
                   COALESCE(c.total_saidas,
                       COALESCE((SELECT SUM(d.valor) FROM caixa_despesas d
                                 WHERE d.caixa_id = c.id AND d.deleted_at IS NULL), 0)),
                   c.saldo_final
            FROM caixas c
            WHERE c.deleted_at IS NULL
              AND (@inicio IS NULL OR c.data >= @inicio)
              AND (@fim IS NULL OR c.data <= @fim)
            ORDER BY c.data
            """;

        public const string DespesasPorTipo = """
            SELECT td.nome, SUM(d.valor)
            FROM caixa_despesas d
            JOIN tipos_despesa td ON td.id = d.tipo_despesa_id
            JOIN caixas c ON c.id = d.caixa_id
            WHERE d.deleted_at IS NULL AND c.deleted_at IS NULL
              AND (@inicio IS NULL OR c.data >= @inicio)
              AND (@fim IS NULL OR c.data <= @fim)
            GROUP BY td.nome
            ORDER BY SUM(d.valor) DESC
            """;
    }
}
