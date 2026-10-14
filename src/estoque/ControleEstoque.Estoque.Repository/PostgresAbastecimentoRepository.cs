using ControleEstoque.Estoque.Domain;
using Npgsql;
using NpgsqlTypes;

namespace ControleEstoque.Estoque.Repository;

public sealed class PostgresAbastecimentoRepository : IAbastecimentoRepository
{
    private readonly NpgsqlDataSource dataSource;

    public PostgresAbastecimentoRepository(NpgsqlDataSource dataSource) => this.dataSource = dataSource;

    public async Task<Guid> CreateAsync(NovoAbastecimento abastecimento, CancellationToken cancellationToken)
    {
        var id = Guid.NewGuid();
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);

        await using (var command = new NpgsqlCommand(Sql.InsertAbastecimento, connection, transaction))
        {
            command.Parameters.AddWithValue("id", id);
            command.Parameters.AddWithValue("tipoFrete", abastecimento.TipoFrete.ToString());
            command.Parameters.AddWithValue("custoTotal", abastecimento.CustoTotal);
            command.Parameters.Add(new NpgsqlParameter("funcionarioId", NpgsqlDbType.Uuid)
            {
                Value = (object?)abastecimento.FuncionarioId ?? DBNull.Value
            });
            command.Parameters.Add(new NpgsqlParameter("observacao", NpgsqlDbType.Text)
            {
                Value = (object?)abastecimento.Observacao ?? DBNull.Value
            });
            await command.ExecuteNonQueryAsync(cancellationToken);
        }

        foreach (var item in abastecimento.Itens)
        {
            await using (var command = new NpgsqlCommand(Sql.InsertItem, connection, transaction))
            {
                command.Parameters.AddWithValue("abastecimentoId", id);
                command.Parameters.AddWithValue("produtoId", item.ProdutoId);
                command.Parameters.AddWithValue("quantidade", item.Quantidade);
                command.Parameters.AddWithValue("custoUnitario", item.CustoUnitario);
                await command.ExecuteNonQueryAsync(cancellationToken);
            }

            await using (var command = new NpgsqlCommand(Sql.InsertMovimento, connection, transaction))
            {
                command.Parameters.AddWithValue("produtoId", item.ProdutoId);
                command.Parameters.AddWithValue("quantidade", item.Quantidade);
                command.Parameters.AddWithValue("abastecimentoId", id);
                await command.ExecuteNonQueryAsync(cancellationToken);
            }
        }

        // Custo do abastecimento vira despesa do caixa do dia, se houver caixa aberto.
        if (abastecimento.CustoTotal > 0)
        {
            await using var command = new NpgsqlCommand(Sql.InsertDespesaSeCaixaAberto, connection, transaction);
            command.Parameters.AddWithValue("valor", abastecimento.CustoTotal);
            command.Parameters.AddWithValue("abastecimentoId", id);
            await command.ExecuteNonQueryAsync(cancellationToken);
        }

        await transaction.CommitAsync(cancellationToken);
        return id;
    }

    private static class Sql
    {
        public const string InsertAbastecimento = """
            INSERT INTO abastecimentos (id, tipo_frete, custo_total, funcionario_id, observacao)
            VALUES (@id, @tipoFrete::tipo_frete, @custoTotal, @funcionarioId, @observacao)
            """;

        public const string InsertItem = """
            INSERT INTO abastecimento_itens (abastecimento_id, produto_id, quantidade, custo_unitario)
            VALUES (@abastecimentoId, @produtoId, @quantidade, @custoUnitario)
            """;

        public const string InsertMovimento = """
            INSERT INTO movimentos_estoque (produto_id, tipo, quantidade, abastecimento_id)
            VALUES (@produtoId, 'ENTRADA_ABASTECIMENTO', @quantidade, @abastecimentoId)
            """;

        public const string InsertDespesaSeCaixaAberto = """
            INSERT INTO caixa_despesas (caixa_id, tipo_despesa_id, valor, descricao, abastecimento_id)
            SELECT c.id, td.id, @valor, 'Custo de abastecimento', @abastecimentoId
            FROM caixas c
            CROSS JOIN LATERAL (
                SELECT id FROM tipos_despesa
                WHERE nome = 'Abastecimento' AND deleted_at IS NULL
                LIMIT 1
            ) td
            WHERE c.data = CURRENT_DATE AND c.status = 'ABERTO' AND c.deleted_at IS NULL
            """;
    }
}
