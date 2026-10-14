using ControleEstoque.Financeiro.Domain;
using ControleEstoque.Shared.Results;
using Npgsql;
using NpgsqlTypes;

namespace ControleEstoque.Financeiro.Repository;

public sealed class PostgresCaixaRepository : ICaixaRepository
{
    private readonly NpgsqlDataSource dataSource;

    public PostgresCaixaRepository(NpgsqlDataSource dataSource) => this.dataSource = dataSource;

    public async Task<Caixa> AbrirAsync(
        DateOnly? data, decimal saldoInicial, CancellationToken cancellationToken)
    {
        var id = Guid.NewGuid();
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(Sql.Abrir, connection);
        command.Parameters.AddWithValue("id", id);
        command.Parameters.Add(new NpgsqlParameter("data", NpgsqlDbType.Date)
        {
            Value = (object?)data ?? DBNull.Value
        });
        command.Parameters.AddWithValue("saldoInicial", saldoInicial);
        try
        {
            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            await reader.ReadAsync(cancellationToken);
            return new Caixa(
                id, reader.GetFieldValue<DateOnly>(0), StatusCaixa.ABERTO, saldoInicial,
                null, null, null, null);
        }
        catch (PostgresException e) when (e.SqlState == PostgresErrorCodes.UniqueViolation)
        {
            throw new ConflictException("CAIXA_JA_EXISTE", "Já existe caixa aberto/fechado para esta data.");
        }
    }

    public async Task<Caixa?> GetAsync(Guid id, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(Sql.Get, connection);
        command.Parameters.AddWithValue("id", id);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        return await reader.ReadAsync(cancellationToken) ? MapCaixa(reader) : null;
    }

    public async Task<Caixa?> GetByDataAsync(DateOnly data, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(Sql.GetByData, connection);
        command.Parameters.Add(new NpgsqlParameter("data", NpgsqlDbType.Date) { Value = data });
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        return await reader.ReadAsync(cancellationToken) ? MapCaixa(reader) : null;
    }

    public async Task AddDespesaAsync(
        Guid caixaId, Guid tipoDespesaId, decimal valor, string? descricao,
        CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(Sql.AddDespesa, connection);
        command.Parameters.AddWithValue("caixaId", caixaId);
        command.Parameters.AddWithValue("tipoDespesaId", tipoDespesaId);
        command.Parameters.AddWithValue("valor", valor);
        command.Parameters.Add(new NpgsqlParameter("descricao", NpgsqlDbType.Text)
        {
            Value = (object?)descricao ?? DBNull.Value
        });
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    public async Task<decimal> GetEntradasAsync(DateOnly data, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(Sql.GetEntradas, connection);
        command.Parameters.Add(new NpgsqlParameter("data", NpgsqlDbType.Date) { Value = data });
        return (decimal?)await command.ExecuteScalarAsync(cancellationToken) ?? 0m;
    }

    public async Task<IReadOnlyList<Despesa>> ListDespesasAsync(
        Guid caixaId, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(Sql.ListDespesas, connection);
        command.Parameters.AddWithValue("caixaId", caixaId);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        var results = new List<Despesa>();
        while (await reader.ReadAsync(cancellationToken))
        {
            results.Add(new Despesa(
                reader.GetGuid(0), reader.GetGuid(1), reader.GetString(2), reader.GetDecimal(3),
                reader.IsDBNull(4) ? null : reader.GetString(4)));
        }

        return results;
    }

    public async Task FecharAsync(
        Guid caixaId,
        IReadOnlyList<(Guid FuncionarioId, decimal Valor)> diarias,
        decimal totalEntradas,
        decimal totalSaidas,
        decimal saldoFinal,
        CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);

        // Diária credita a conta corrente do funcionário — não é saída de caixa.
        foreach (var (funcionarioId, valor) in diarias)
        {
            await using var command = new NpgsqlCommand(Sql.InsertDiaria, connection, transaction);
            command.Parameters.AddWithValue("funcionarioId", funcionarioId);
            command.Parameters.AddWithValue("caixaId", caixaId);
            command.Parameters.AddWithValue("valor", valor);
            await command.ExecuteNonQueryAsync(cancellationToken);
        }

        await using (var command = new NpgsqlCommand(Sql.Fechar, connection, transaction))
        {
            command.Parameters.AddWithValue("caixaId", caixaId);
            command.Parameters.AddWithValue("totalEntradas", totalEntradas);
            command.Parameters.AddWithValue("totalSaidas", totalSaidas);
            command.Parameters.AddWithValue("saldoFinal", saldoFinal);
            await command.ExecuteNonQueryAsync(cancellationToken);
        }

        await transaction.CommitAsync(cancellationToken);
    }

    public async Task<IReadOnlyDictionary<Guid, decimal>> GetValoresDiariaAsync(
        IReadOnlyCollection<Guid> funcionarioIds, CancellationToken cancellationToken)
    {
        if (funcionarioIds.Count == 0)
        {
            return new Dictionary<Guid, decimal>();
        }

        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(Sql.GetValoresDiaria, connection);
        command.Parameters.AddWithValue("ids", funcionarioIds.ToArray());
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        var results = new Dictionary<Guid, decimal>();
        while (await reader.ReadAsync(cancellationToken))
        {
            results[reader.GetGuid(0)] = reader.GetDecimal(1);
        }

        return results;
    }

    private static Caixa MapCaixa(NpgsqlDataReader reader) => new(
        reader.GetGuid(0),
        reader.GetFieldValue<DateOnly>(1),
        Enum.Parse<StatusCaixa>(reader.GetString(2)),
        reader.GetDecimal(3),
        reader.IsDBNull(4) ? null : reader.GetDecimal(4),
        reader.IsDBNull(5) ? null : reader.GetDecimal(5),
        reader.IsDBNull(6) ? null : reader.GetDecimal(6),
        reader.IsDBNull(7) ? null : reader.GetFieldValue<DateTimeOffset>(7));

    private static class Sql
    {
        private const string SelectCaixa = """
            SELECT id, data, status::text, saldo_inicial, total_entradas, total_saidas,
                   saldo_final, fechado_em
            FROM caixas
            """;

        public const string Abrir = """
            INSERT INTO caixas (id, data, saldo_inicial)
            VALUES (@id, COALESCE(@data, CURRENT_DATE), @saldoInicial)
            RETURNING data
            """;

        public const string Get = SelectCaixa + " WHERE id = @id AND deleted_at IS NULL";

        public const string GetByData = SelectCaixa + " WHERE data = @data AND deleted_at IS NULL";

        public const string AddDespesa = """
            INSERT INTO caixa_despesas (caixa_id, tipo_despesa_id, valor, descricao)
            VALUES (@caixaId, @tipoDespesaId, @valor, @descricao)
            """;

        public const string GetEntradas = """
            SELECT COALESCE((SELECT SUM(p.valor)
                             FROM venda_pagamentos p
                             JOIN vendas v ON v.id = p.venda_id
                             WHERE p.deleted_at IS NULL AND v.deleted_at IS NULL
                               AND p.data::date = @data), 0)
                 + COALESCE((SELECT SUM(l.valor)
                             FROM lancamentos_fiado l
                             WHERE l.deleted_at IS NULL AND l.tipo = 'PAGAMENTO'
                               AND l.venda_id IS NULL
                               AND l.created_at::date = @data), 0)
            """;

        public const string ListDespesas = """
            SELECT d.id, d.tipo_despesa_id, td.nome, d.valor, d.descricao
            FROM caixa_despesas d
            JOIN tipos_despesa td ON td.id = d.tipo_despesa_id
            WHERE d.caixa_id = @caixaId AND d.deleted_at IS NULL
            ORDER BY d.created_at
            """;

        public const string InsertDiaria = """
            INSERT INTO lancamentos_funcionario (funcionario_id, caixa_id, tipo, valor)
            VALUES (@funcionarioId, @caixaId, 'DIARIA', @valor)
            """;

        public const string Fechar = """
            UPDATE caixas
            SET status = 'FECHADO', total_entradas = @totalEntradas, total_saidas = @totalSaidas,
                saldo_final = @saldoFinal, fechado_em = now(), updated_at = now()
            WHERE id = @caixaId AND deleted_at IS NULL
            """;

        public const string GetValoresDiaria = """
            SELECT id, valor_diaria FROM funcionarios
            WHERE id = ANY(@ids) AND deleted_at IS NULL
            """;
    }
}
