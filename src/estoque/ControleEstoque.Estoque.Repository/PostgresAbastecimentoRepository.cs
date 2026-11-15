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
                command.Parameters.AddWithValue("produtoMarcaId", item.ProdutoMarcaId);
                command.Parameters.AddWithValue("quantidade", item.Quantidade);
                await command.ExecuteNonQueryAsync(cancellationToken);
            }

            await using (var command = new NpgsqlCommand(Sql.InsertMovimento, connection, transaction))
            {
                command.Parameters.AddWithValue("produtoMarcaId", item.ProdutoMarcaId);
                command.Parameters.AddWithValue("quantidade", item.Quantidade);
                command.Parameters.AddWithValue("abastecimentoId", id);
                await command.ExecuteNonQueryAsync(cancellationToken);
            }
        }

        foreach (var casco in abastecimento.Cascos)
        {
            await using (var command = new NpgsqlCommand(Sql.InsertCasco, connection, transaction))
            {
                command.Parameters.AddWithValue("abastecimentoId", id);
                command.Parameters.AddWithValue("tipoCascoId", casco.TipoCascoId);
                command.Parameters.AddWithValue("quantidade", casco.Quantidade);
                await command.ExecuteNonQueryAsync(cancellationToken);
            }

            await using (var command = new NpgsqlCommand(Sql.InsertMovimentoCasco, connection, transaction))
            {
                command.Parameters.AddWithValue("tipoCascoId", casco.TipoCascoId);
                command.Parameters.AddWithValue("quantidade", casco.Quantidade);
                command.Parameters.AddWithValue("abastecimentoId", id);
                await command.ExecuteNonQueryAsync(cancellationToken);
            }
        }

        await transaction.CommitAsync(cancellationToken);
        return id;
    }

    public async Task<Abastecimento?> GetAsync(Guid id, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);

        await using var cabecalho = new NpgsqlCommand(Sql.Get, connection);
        cabecalho.Parameters.AddWithValue("id", id);
        await using var reader = await cabecalho.ExecuteReaderAsync(cancellationToken);
        if (!await reader.ReadAsync(cancellationToken))
        {
            return null;
        }

        var carga = new Abastecimento(
            id,
            DateOnly.FromDateTime(reader.GetDateTime(0)),
            Enum.Parse<TipoFrete>(reader.GetString(1)),
            reader.IsDBNull(2) ? null : reader.GetGuid(2),
            reader.IsDBNull(3) ? null : reader.GetString(3),
            reader.IsDBNull(4) ? null : reader.GetDecimal(4),
            [],
            []);
        await reader.CloseAsync();

        return carga with
        {
            Itens = await LerLinhasAsync(connection, Sql.GetItens, id, cancellationToken),
            Cascos = await LerLinhasAsync(connection, Sql.GetCascos, id, cancellationToken)
        };
    }

    public async Task LancarCustosAsync(Guid id, LancamentoCustos custos, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);

        await using (var command = new NpgsqlCommand(Sql.UpdateFrete, connection, transaction))
        {
            command.Parameters.AddWithValue("id", id);
            command.Parameters.Add(new NpgsqlParameter("frete", NpgsqlDbType.Numeric)
            {
                Value = (object?)custos.Frete ?? DBNull.Value
            });
            command.Parameters.AddWithValue("funcionarioId", custos.FuncionarioId);
            await command.ExecuteNonQueryAsync(cancellationToken);
        }

        foreach (var linha in custos.Itens)
        {
            await AtualizarLinhaAsync(connection, transaction, Sql.UpdateCustoItem, id, linha, cancellationToken);
        }

        foreach (var linha in custos.Cascos)
        {
            await AtualizarLinhaAsync(connection, transaction, Sql.UpdateCustoCasco, id, linha, cancellationToken);
        }

        await transaction.CommitAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<AbastecimentoPendente>> ListPendentesAsync(CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(Sql.ListPendentes, connection);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        var lista = new List<AbastecimentoPendente>();
        while (await reader.ReadAsync(cancellationToken))
        {
            lista.Add(new AbastecimentoPendente(
                reader.GetGuid(0),
                DateOnly.FromDateTime(reader.GetDateTime(1)),
                Enum.Parse<TipoFrete>(reader.GetString(2)),
                reader.GetInt32(3),
                reader.GetInt32(4),
                reader.GetBoolean(5)));
        }

        return lista;
    }

    private static async Task<IReadOnlyList<LinhaCarga>> LerLinhasAsync(
        NpgsqlConnection connection, string sql, Guid abastecimentoId, CancellationToken cancellationToken)
    {
        await using var command = new NpgsqlCommand(sql, connection);
        command.Parameters.AddWithValue("id", abastecimentoId);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        var linhas = new List<LinhaCarga>();
        while (await reader.ReadAsync(cancellationToken))
        {
            linhas.Add(new LinhaCarga(
                reader.GetGuid(0),
                reader.GetGuid(1),
                reader.GetInt32(2),
                reader.IsDBNull(3) ? null : reader.GetDecimal(3)));
        }

        return linhas;
    }

    private static async Task AtualizarLinhaAsync(
        NpgsqlConnection connection, NpgsqlTransaction transaction, string sql, Guid abastecimentoId,
        CustoLinha linha, CancellationToken cancellationToken)
    {
        await using var command = new NpgsqlCommand(sql, connection, transaction);
        command.Parameters.AddWithValue("abastecimentoId", abastecimentoId);
        command.Parameters.AddWithValue("linhaId", linha.Id);
        command.Parameters.AddWithValue("custoUnitario", linha.CustoUnitario);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    private static class Sql
    {
        public const string InsertAbastecimento = """
            INSERT INTO abastecimentos (id, tipo_frete, funcionario_id, observacao)
            VALUES (@id, @tipoFrete::tipo_frete, @funcionarioId, @observacao)
            """;

        public const string InsertItem = """
            INSERT INTO abastecimento_itens (abastecimento_id, produto_marca_id, quantidade)
            VALUES (@abastecimentoId, @produtoMarcaId, @quantidade)
            """;

        public const string InsertCasco = """
            INSERT INTO abastecimento_cascos (abastecimento_id, tipo_casco_id, quantidade)
            VALUES (@abastecimentoId, @tipoCascoId, @quantidade)
            """;

        public const string InsertMovimento = """
            INSERT INTO movimentos_estoque (produto_marca_id, tipo, quantidade, abastecimento_id)
            VALUES (@produtoMarcaId, 'ENTRADA_ABASTECIMENTO', @quantidade, @abastecimentoId)
            """;

        public const string InsertMovimentoCasco = """
            INSERT INTO movimentos_estoque_casco (tipo_casco_id, situacao, tipo, quantidade, abastecimento_id)
            VALUES (@tipoCascoId, 'VAZIO', 'ENTRADA_ABASTECIMENTO', @quantidade, @abastecimentoId)
            """;

        public const string Get = """
            SELECT data, tipo_frete::text, funcionario_id, observacao, frete
            FROM abastecimentos
            WHERE id = @id AND deleted_at IS NULL
            """;

        public const string GetItens = """
            SELECT id, produto_marca_id, quantidade, custo_unitario
            FROM abastecimento_itens WHERE abastecimento_id = @id ORDER BY id
            """;

        public const string GetCascos = """
            SELECT id, tipo_casco_id, quantidade, custo_unitario
            FROM abastecimento_cascos WHERE abastecimento_id = @id ORDER BY id
            """;

        public const string UpdateFrete = """
            UPDATE abastecimentos
            SET frete = COALESCE(@frete, frete), updated_by = @funcionarioId, updated_at = now()
            WHERE id = @id
            """;

        public const string UpdateCustoItem = """
            UPDATE abastecimento_itens SET custo_unitario = @custoUnitario
            WHERE id = @linhaId AND abastecimento_id = @abastecimentoId
            """;

        public const string UpdateCustoCasco = """
            UPDATE abastecimento_cascos SET custo_unitario = @custoUnitario
            WHERE id = @linhaId AND abastecimento_id = @abastecimentoId
            """;

        public const string ListPendentes = """
            SELECT a.id, a.data, a.tipo_frete::text,
                   (COALESCE(i.unidades, 0) + COALESCE(c.unidades, 0))::int,
                   (COALESCE(i.sem_custo, 0) + COALESCE(c.sem_custo, 0))::int,
                   a.frete IS NULL
            FROM abastecimentos a
            LEFT JOIN LATERAL (
                SELECT SUM(quantidade) AS unidades, COUNT(*) FILTER (WHERE custo_unitario IS NULL) AS sem_custo
                FROM abastecimento_itens WHERE abastecimento_id = a.id
            ) i ON true
            LEFT JOIN LATERAL (
                SELECT SUM(quantidade) AS unidades, COUNT(*) FILTER (WHERE custo_unitario IS NULL) AS sem_custo
                FROM abastecimento_cascos WHERE abastecimento_id = a.id
            ) c ON true
            WHERE a.deleted_at IS NULL
              AND (a.frete IS NULL OR COALESCE(i.sem_custo, 0) + COALESCE(c.sem_custo, 0) > 0)
            ORDER BY a.data DESC, a.created_at DESC
            """;
    }
}
