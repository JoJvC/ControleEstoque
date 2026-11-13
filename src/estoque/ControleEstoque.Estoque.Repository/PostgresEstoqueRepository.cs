using ControleEstoque.Estoque.Domain;
using ControleEstoque.Shared.Results;
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

    public async Task<SaldoInsuficiente?> AddAjusteAsync(
        Guid produtoId, int quantidade, string? observacao, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);

        if (quantidade < 0)
        {
            var saidas = new Dictionary<Guid, long> { [produtoId] = -(long)quantidade };
            if (await ChecarSaldoAsync(connection, transaction, saidas, cancellationToken) is { } falta)
            {
                return falta; // sem Commit: o Dispose da transação faz rollback.
            }
        }

        await using (var command = new NpgsqlCommand(Sql.AddAjuste, connection, transaction))
        {
            command.Parameters.AddWithValue("produtoId", produtoId);
            command.Parameters.AddWithValue("quantidade", quantidade);
            command.Parameters.Add(new NpgsqlParameter("observacao", NpgsqlDbType.Text)
            {
                Value = (object?)observacao ?? DBNull.Value
            });
            await command.ExecuteNonQueryAsync(cancellationToken);
        }

        await transaction.CommitAsync(cancellationToken);
        return null;
    }

    /// <summary>
    /// Trava os produtos em ordem de id e, em outra instrução da mesma transação (READ COMMITTED),
    /// confere se o saldo cobre as saídas. O saldo é lido depois da trava para ver o commit de quem a soltou.
    /// </summary>
    internal static async Task<SaldoInsuficiente?> ChecarSaldoAsync(
        NpgsqlConnection connection, NpgsqlTransaction transaction,
        IReadOnlyDictionary<Guid, long> saidasPorProduto, CancellationToken cancellationToken)
    {
        var ids = saidasPorProduto.Keys.ToArray();

        await using (var command = new NpgsqlCommand(Sql.TravaProdutos, connection, transaction))
        {
            command.Parameters.AddWithValue("ids", ids);
            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            while (await reader.ReadAsync(cancellationToken))
            {
            }
        }

        return await ConferirSaldoAsync(connection, transaction, saidasPorProduto, cancellationToken);
    }

    /// <summary>Confere o saldo das saídas; os produtos já devem estar travados na transação.</summary>
    internal static async Task<SaldoInsuficiente?> ConferirSaldoAsync(
        NpgsqlConnection connection, NpgsqlTransaction transaction,
        IReadOnlyDictionary<Guid, long> saidasPorProduto, CancellationToken cancellationToken)
    {
        var ids = saidasPorProduto.Keys.ToArray();
        var saldos = new Dictionary<Guid, long>();
        await using (var command = new NpgsqlCommand(Sql.GetSaldos, connection, transaction))
        {
            command.Parameters.AddWithValue("ids", ids);
            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            while (await reader.ReadAsync(cancellationToken))
            {
                saldos[reader.GetGuid(0)] = reader.GetInt64(1);
            }
        }

        foreach (var (produtoId, saida) in saidasPorProduto)
        {
            var saldo = saldos.GetValueOrDefault(produtoId);
            if (saldo - saida < 0)
            {
                return new SaldoInsuficiente(produtoId, saldo, saida);
            }
        }

        return null;
    }

    private static class Sql
    {
        public const string GetEstoque = """
            SELECT produto_id, tipo::text, nome, marca, categoria, tamanho,
                   quantidade, estoque_minimo, abaixo_minimo
            FROM vw_estoque_atual
            ORDER BY nome
            """;

        // NO KEY UPDATE não conflita com o FOR KEY SHARE das FKs: lançamentos positivos não esperam.
        public const string TravaProdutos =
            "SELECT id FROM produtos WHERE id = ANY(@ids) ORDER BY id FOR NO KEY UPDATE";

        public const string GetSaldos = """
            SELECT produto_id, COALESCE(SUM(quantidade), 0)::bigint
            FROM movimentos_estoque
            WHERE produto_id = ANY(@ids) AND deleted_at IS NULL
            GROUP BY produto_id
            """;

        public const string AddAjuste = """
            INSERT INTO movimentos_estoque (produto_id, tipo, quantidade, observacao)
            VALUES (@produtoId, 'AJUSTE', @quantidade, @observacao)
            """;
    }
}
