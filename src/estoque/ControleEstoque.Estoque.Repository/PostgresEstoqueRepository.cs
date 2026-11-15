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
                reader.GetGuid(1),
                Enum.Parse<TipoProduto>(reader.GetString(2)),
                reader.GetString(3),
                reader.GetGuid(4),
                reader.IsDBNull(5) ? null : reader.GetString(5),
                reader.IsDBNull(6) ? null : reader.GetString(6),
                reader.IsDBNull(7) ? null : reader.GetString(7),
                reader.GetInt64(8),
                reader.GetInt32(9),
                reader.GetBoolean(10)));
        }

        return results;
    }

    public async Task<IReadOnlyList<EstoqueCasco>> GetEstoqueCascosAsync(CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(Sql.GetEstoqueCascos, connection);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        var results = new List<EstoqueCasco>();
        while (await reader.ReadAsync(cancellationToken))
        {
            results.Add(new EstoqueCasco(
                reader.GetGuid(0),
                reader.GetString(1),
                reader.IsDBNull(2) ? null : reader.GetGuid(2),
                reader.IsDBNull(3) ? null : reader.GetString(3),
                reader.GetBoolean(4),
                reader.GetInt64(5),
                reader.GetInt64(6)));
        }

        return results;
    }

    public async Task<SaldoInsuficiente?> AddAjusteAsync(
        Guid produtoMarcaId, int quantidade, string? observacao, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);

        if (quantidade < 0)
        {
            var saidas = new Dictionary<Guid, long> { [produtoMarcaId] = -(long)quantidade };
            if (await ChecarSaldoAsync(connection, transaction, saidas, cancellationToken) is { } falta)
            {
                return falta; // sem Commit: o Dispose da transação faz rollback.
            }
        }

        await using (var command = new NpgsqlCommand(Sql.AddAjuste, connection, transaction))
        {
            command.Parameters.AddWithValue("produtoMarcaId", produtoMarcaId);
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

    public async Task<SaldoInsuficiente?> AddAjusteCascoAsync(
        Guid tipoCascoId, SituacaoCasco situacao, int quantidade, string? observacao,
        CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);

        MovimentoCasco[] movimentos = [new(situacao, TipoMovimentoEstoque.AJUSTE, quantidade)];
        if (quantidade < 0
            && await ChecarSaldoCascoAsync(connection, transaction, tipoCascoId, movimentos, cancellationToken)
                is { } falta)
        {
            return falta; // sem Commit: o Dispose da transação faz rollback.
        }

        await InserirMovimentosCascoAsync(
            connection, transaction, tipoCascoId, movimentos, null, observacao, cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return null;
    }

    /// <summary>
    /// Trava o tipo de casco e, em outra instrução da mesma transação (READ COMMITTED), confere se o saldo
    /// de cada situação cobre as saídas dos movimentos. O saldo é lido depois da trava.
    /// </summary>
    internal static async Task<SaldoInsuficiente?> ChecarSaldoCascoAsync(
        NpgsqlConnection connection, NpgsqlTransaction transaction, Guid tipoCascoId,
        IReadOnlyList<MovimentoCasco> movimentos, CancellationToken cancellationToken)
    {
        await using (var command = new NpgsqlCommand(Sql.TravaTipoCasco, connection, transaction))
        {
            command.Parameters.AddWithValue("id", tipoCascoId);
            await command.ExecuteScalarAsync(cancellationToken);
        }

        var saldos = new Dictionary<string, long>();
        await using (var command = new NpgsqlCommand(Sql.GetSaldosCasco, connection, transaction))
        {
            command.Parameters.AddWithValue("tipoCascoId", tipoCascoId);
            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            while (await reader.ReadAsync(cancellationToken))
            {
                saldos[reader.GetString(0)] = reader.GetInt64(1);
            }
        }

        foreach (var porSituacao in movimentos.GroupBy(m => m.Situacao))
        {
            var saldo = saldos.GetValueOrDefault(porSituacao.Key.ToString());
            var delta = porSituacao.Sum(m => (long)m.Quantidade);
            if (saldo + delta < 0)
            {
                return new SaldoInsuficiente(tipoCascoId, saldo, -delta);
            }
        }

        return null;
    }

    internal static async Task InserirMovimentosCascoAsync(
        NpgsqlConnection connection, NpgsqlTransaction transaction, Guid tipoCascoId,
        IReadOnlyList<MovimentoCasco> movimentos, Guid? baixaCascoId, string? observacao,
        CancellationToken cancellationToken)
    {
        foreach (var movimento in movimentos)
        {
            await using var command = new NpgsqlCommand(Sql.InsertMovimentoCasco, connection, transaction);
            command.Parameters.AddWithValue("tipoCascoId", tipoCascoId);
            command.Parameters.AddWithValue("situacao", movimento.Situacao.ToString());
            command.Parameters.AddWithValue("tipo", movimento.Tipo.ToString());
            command.Parameters.AddWithValue("quantidade", movimento.Quantidade);
            command.Parameters.Add(new NpgsqlParameter("baixaCascoId", NpgsqlDbType.Uuid)
            {
                Value = (object?)baixaCascoId ?? DBNull.Value
            });
            command.Parameters.Add(new NpgsqlParameter("observacao", NpgsqlDbType.Text)
            {
                Value = (object?)observacao ?? DBNull.Value
            });
            await command.ExecuteNonQueryAsync(cancellationToken);
        }
    }

    /// <summary>
    /// Trava as linhas de estoque (produto+marca) em ordem de id e, em outra instrução da mesma transação (READ COMMITTED),
    /// confere se o saldo cobre as saídas. O saldo é lido depois da trava para ver o commit de quem a soltou.
    /// </summary>
    internal static async Task<SaldoInsuficiente?> ChecarSaldoAsync(
        NpgsqlConnection connection, NpgsqlTransaction transaction,
        IReadOnlyDictionary<Guid, long> saidasPorProdutoMarca, CancellationToken cancellationToken)
    {
        var ids = saidasPorProdutoMarca.Keys.ToArray();

        await using (var command = new NpgsqlCommand(Sql.TravaProdutos, connection, transaction))
        {
            command.Parameters.AddWithValue("ids", ids);
            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            while (await reader.ReadAsync(cancellationToken))
            {
            }
        }

        return await ConferirSaldoAsync(connection, transaction, saidasPorProdutoMarca, cancellationToken);
    }

    /// <summary>Confere o saldo das saídas; as linhas já devem estar travadas na transação.</summary>
    internal static async Task<SaldoInsuficiente?> ConferirSaldoAsync(
        NpgsqlConnection connection, NpgsqlTransaction transaction,
        IReadOnlyDictionary<Guid, long> saidasPorProdutoMarca, CancellationToken cancellationToken)
    {
        var ids = saidasPorProdutoMarca.Keys.ToArray();
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

        foreach (var (produtoMarcaId, saida) in saidasPorProdutoMarca)
        {
            var saldo = saldos.GetValueOrDefault(produtoMarcaId);
            if (saldo - saida < 0)
            {
                return new SaldoInsuficiente(produtoMarcaId, saldo, saida);
            }
        }

        return null;
    }

    private static class Sql
    {
        public const string GetEstoque = """
            SELECT produto_marca_id, produto_id, tipo::text, nome, marca_id, marca, categoria, tamanho,
                   quantidade, estoque_minimo, abaixo_minimo
            FROM vw_estoque_atual
            ORDER BY nome, marca
            """;

        public const string GetEstoqueCascos = """
            SELECT tipo_casco_id, nome, marca_id, marca, aceita_sucata, vazios, sucata
            FROM vw_estoque_casco
            ORDER BY nome
            """;

        // NO KEY UPDATE não conflita com o FOR KEY SHARE das FKs: lançamentos positivos não esperam.
        public const string TravaProdutos =
            "SELECT id FROM produto_marcas WHERE id = ANY(@ids) ORDER BY id FOR NO KEY UPDATE";

        public const string GetSaldos = """
            SELECT produto_marca_id, COALESCE(SUM(quantidade), 0)::bigint
            FROM movimentos_estoque
            WHERE produto_marca_id = ANY(@ids) AND deleted_at IS NULL
            GROUP BY produto_marca_id
            """;

        public const string AddAjuste = """
            INSERT INTO movimentos_estoque (produto_marca_id, tipo, quantidade, observacao)
            VALUES (@produtoMarcaId, 'AJUSTE', @quantidade, @observacao)
            """;

        public const string TravaTipoCasco = "SELECT id FROM tipos_casco WHERE id = @id FOR NO KEY UPDATE";

        public const string GetSaldosCasco = """
            SELECT situacao::text, COALESCE(SUM(quantidade), 0)::bigint
            FROM movimentos_estoque_casco
            WHERE tipo_casco_id = @tipoCascoId AND deleted_at IS NULL
            GROUP BY situacao
            """;

        public const string InsertMovimentoCasco = """
            INSERT INTO movimentos_estoque_casco (tipo_casco_id, situacao, tipo, quantidade, baixa_casco_id, observacao)
            VALUES (@tipoCascoId, @situacao::situacao_casco, @tipo::tipo_movimento_estoque, @quantidade,
                    @baixaCascoId, @observacao)
            """;
    }
}
