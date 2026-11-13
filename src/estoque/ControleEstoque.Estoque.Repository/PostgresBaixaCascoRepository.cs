using ControleEstoque.Estoque.Domain;
using ControleEstoque.Shared.Results;
using Npgsql;
using NpgsqlTypes;

namespace ControleEstoque.Estoque.Repository;

public sealed class PostgresBaixaCascoRepository : IBaixaCascoRepository
{
    private readonly NpgsqlDataSource dataSource;

    public PostgresBaixaCascoRepository(NpgsqlDataSource dataSource) => this.dataSource = dataSource;

    public async Task<(Guid Id, SaldoInsuficiente? Falta)> CreateAsync(
        NovaBaixaCasco baixa, Guid cascoProdutoId, Guid sucataProdutoId, CancellationToken cancellationToken)
    {
        var id = Guid.NewGuid();
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);

        // Trava o casco e, em outra instrução, confere o saldo; tudo antes de qualquer INSERT.
        await using (var command = new NpgsqlCommand(Sql.TravaCasco, connection, transaction))
        {
            command.Parameters.AddWithValue("id", cascoProdutoId);
            await command.ExecuteScalarAsync(cancellationToken);
        }

        var saidas = new Dictionary<Guid, long> { [cascoProdutoId] = baixa.Quantidade };
        if (await PostgresEstoqueRepository.ConferirSaldoAsync(connection, transaction, saidas, cancellationToken)
            is { } falta)
        {
            return (Guid.Empty, falta); // sem Commit: o Dispose da transação faz rollback.
        }

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
        return (id, null);
    }

    private static class Sql
    {
        // NO KEY UPDATE não conflita com o FOR KEY SHARE das FKs: lançamentos positivos não esperam.
        public const string TravaCasco = "SELECT id FROM produtos WHERE id = @id FOR NO KEY UPDATE";

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
