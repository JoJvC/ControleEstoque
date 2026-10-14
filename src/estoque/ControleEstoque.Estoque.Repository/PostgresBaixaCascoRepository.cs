using ControleEstoque.Estoque.Domain;
using Npgsql;
using NpgsqlTypes;

namespace ControleEstoque.Estoque.Repository;

public sealed class PostgresBaixaCascoRepository : IBaixaCascoRepository
{
    private readonly NpgsqlDataSource dataSource;

    public PostgresBaixaCascoRepository(NpgsqlDataSource dataSource) => this.dataSource = dataSource;

    public async Task<Guid> CreateAsync(
        NovaBaixaCasco baixa, Guid cascoProdutoId, Guid sucataProdutoId, CancellationToken cancellationToken)
    {
        var id = Guid.NewGuid();
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);

        await using (var command = new NpgsqlCommand(Sql.InsertBaixa, connection, transaction))
        {
            command.Parameters.AddWithValue("id", id);
            command.Parameters.AddWithValue("quantidade", baixa.Quantidade);
            command.Parameters.Add(new NpgsqlParameter("motivo", NpgsqlDbType.Text)
            {
                Value = (object?)baixa.Motivo ?? DBNull.Value
            });
            await command.ExecuteNonQueryAsync(cancellationToken);
        }

        foreach (var funcionarioId in baixa.ResponsaveisIds.Distinct())
        {
            await using var command = new NpgsqlCommand(Sql.InsertResponsavel, connection, transaction);
            command.Parameters.AddWithValue("baixaId", id);
            command.Parameters.AddWithValue("funcionarioId", funcionarioId);
            await command.ExecuteNonQueryAsync(cancellationToken);
        }

        // O casco quebrado sai do estoque de vazios e passa a compor o estoque de sucata.
        await using (var command = new NpgsqlCommand(Sql.InsertMovimentos, connection, transaction))
        {
            command.Parameters.AddWithValue("cascoProdutoId", cascoProdutoId);
            command.Parameters.AddWithValue("sucataProdutoId", sucataProdutoId);
            command.Parameters.AddWithValue("quantidade", baixa.Quantidade);
            await command.ExecuteNonQueryAsync(cancellationToken);
        }

        await transaction.CommitAsync(cancellationToken);
        return id;
    }

    private static class Sql
    {
        public const string InsertBaixa =
            "INSERT INTO baixas_casco (id, quantidade, motivo) VALUES (@id, @quantidade, @motivo)";

        public const string InsertResponsavel = """
            INSERT INTO baixa_casco_responsaveis (baixa_id, funcionario_id)
            VALUES (@baixaId, @funcionarioId)
            """;

        public const string InsertMovimentos = """
            INSERT INTO movimentos_estoque (produto_id, tipo, quantidade)
            VALUES (@cascoProdutoId,  'BAIXA_QUEBRA',  -@quantidade),
                   (@sucataProdutoId, 'ENTRADA_SUCATA', @quantidade)
            """;
    }
}
