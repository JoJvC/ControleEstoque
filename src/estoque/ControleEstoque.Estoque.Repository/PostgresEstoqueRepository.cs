using ControleEstoque.Estoque.Domain;
using Npgsql;
using NpgsqlTypes;

namespace ControleEstoque.Estoque.Repository;

public sealed class PostgresEstoqueRepository : IEstoqueRepository
{
    private readonly NpgsqlDataSource dataSource;

    public PostgresEstoqueRepository(NpgsqlDataSource dataSource) => this.dataSource = dataSource;

    public async Task<IReadOnlyList<EstoqueItem>> GetEstoqueAsync(CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(Sql.GetEstoque, connection);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        var results = new List<EstoqueItem>();
        while (await reader.ReadAsync(cancellationToken))
        {
            results.Add(new EstoqueItem(
                reader.GetGuid(0),
                Enum.Parse<TipoProduto>(reader.GetString(1)),
                reader.GetString(2),
                reader.IsDBNull(3) ? null : reader.GetString(3),
                reader.IsDBNull(4) ? null : reader.GetString(4),
                reader.IsDBNull(5) ? null : reader.GetString(5),
                reader.GetInt64(6),
                reader.GetInt32(7),
                reader.GetBoolean(8)));
        }

        return results;
    }

    public async Task<long> GetSaldoAsync(Guid produtoId, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(Sql.GetSaldo, connection);
        command.Parameters.AddWithValue("produtoId", produtoId);
        return (long?)await command.ExecuteScalarAsync(cancellationToken) ?? 0;
    }

    public async Task AddAjusteAsync(
        Guid produtoId, int quantidade, string? observacao, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(Sql.AddAjuste, connection);
        command.Parameters.AddWithValue("produtoId", produtoId);
        command.Parameters.AddWithValue("quantidade", quantidade);
        command.Parameters.Add(new NpgsqlParameter("observacao", NpgsqlDbType.Text)
        {
            Value = (object?)observacao ?? DBNull.Value
        });
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    private static class Sql
    {
        public const string GetEstoque = """
            SELECT produto_id, tipo::text, nome, marca, categoria, tamanho,
                   quantidade, estoque_minimo, abaixo_minimo
            FROM vw_estoque_atual
            ORDER BY nome
            """;

        public const string GetSaldo = """
            SELECT COALESCE(SUM(quantidade), 0)::bigint
            FROM movimentos_estoque
            WHERE produto_id = @produtoId AND deleted_at IS NULL
            """;

        public const string AddAjuste = """
            INSERT INTO movimentos_estoque (produto_id, tipo, quantidade, observacao)
            VALUES (@produtoId, 'AJUSTE', @quantidade, @observacao)
            """;
    }
}
