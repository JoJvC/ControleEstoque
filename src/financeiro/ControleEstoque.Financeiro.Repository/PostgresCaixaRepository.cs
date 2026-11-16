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
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);

        // FOR SHARE conflita com o FOR UPDATE do fechamento: quem chega depois dele vê FECHADO.
        await using (var command = new NpgsqlCommand(Sql.TravaCaixaPorId, connection, transaction))
        {
            command.Parameters.AddWithValue("caixaId", caixaId);
            var status = (string?)await command.ExecuteScalarAsync(cancellationToken)
                ?? throw new EntityNotFoundException("CAIXA_NAO_ENCONTRADO", $"Caixa {caixaId} não encontrado.");
            if (status == nameof(StatusCaixa.FECHADO))
            {
                throw new ConflictException("CAIXA_FECHADO", "Não é possível lançar despesa em caixa fechado.");
            }
        }

        await using (var command = new NpgsqlCommand(Sql.AddDespesa, connection, transaction))
        {
            command.Parameters.AddWithValue("caixaId", caixaId);
            command.Parameters.AddWithValue("tipoDespesaId", tipoDespesaId);
            command.Parameters.AddWithValue("valor", valor);
            command.Parameters.Add(new NpgsqlParameter("descricao", NpgsqlDbType.Text)
            {
                Value = (object?)descricao ?? DBNull.Value
            });
            await command.ExecuteNonQueryAsync(cancellationToken);
        }

        await transaction.CommitAsync(cancellationToken);
    }

    public async Task<decimal> GetEntradasAsync(DateOnly data, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        return await GetEntradasAsync(connection, null, data, cancellationToken);
    }

    private static async Task<decimal> GetEntradasAsync(
        NpgsqlConnection connection, NpgsqlTransaction? transaction, DateOnly data,
        CancellationToken cancellationToken)
    {
        await using var command = new NpgsqlCommand(Sql.GetEntradas, connection, transaction);
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

    public async Task<ResultadoFechamento> FecharAsync(
        Guid caixaId, IReadOnlyList<DiariaFechamento> funcionarioIds, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);

        DateOnly data;
        decimal saldoInicial;
        await using (var command = new NpgsqlCommand(Sql.TravaCaixaParaFechar, connection, transaction))
        {
            command.Parameters.AddWithValue("caixaId", caixaId);
            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            if (!await reader.ReadAsync(cancellationToken))
            {
                throw new EntityNotFoundException("CAIXA_NAO_ENCONTRADO", $"Caixa {caixaId} não encontrado.");
            }

            if (reader.GetString(0) == nameof(StatusCaixa.FECHADO))
            {
                throw new ConflictException("CAIXA_JA_FECHADO", "Caixa já foi fechado.");
            }

            data = reader.GetFieldValue<DateOnly>(1);
            saldoInicial = reader.GetDecimal(2);
        }

        var efetivos = await ResolverDiariasAsync(connection, transaction, funcionarioIds, cancellationToken);
        var (entradas, totalSaidas, saldoFinal) =
            await CalcularTotaisAsync(connection, transaction, caixaId, data, saldoInicial, cancellationToken);

        // Diária credita a conta corrente do funcionário — não é saída de caixa.
        // Valor efetivo 0 não gera lançamento: lancamentos_funcionario exige valor > 0.
        var diariasLancadas = 0;
        foreach (var (funcionarioId, valorEfetivo) in efetivos.Where(e => e.Valor > 0))
        {
            diariasLancadas++;
            await using var command = new NpgsqlCommand(Sql.InsertDiaria, connection, transaction);
            command.Parameters.AddWithValue("funcionarioId", funcionarioId);
            command.Parameters.AddWithValue("caixaId", caixaId);
            command.Parameters.AddWithValue("valor", valorEfetivo);
            try
            {
                await command.ExecuteNonQueryAsync(cancellationToken);
            }
            catch (PostgresException e) when (e.SqlState == PostgresErrorCodes.UniqueViolation)
            {
                throw new ConflictException("CAIXA_JA_FECHADO", "Caixa já foi fechado.");
            }
        }

        await using (var command = new NpgsqlCommand(Sql.Fechar, connection, transaction))
        {
            command.Parameters.AddWithValue("caixaId", caixaId);
            command.Parameters.AddWithValue("totalEntradas", entradas);
            command.Parameters.AddWithValue("totalSaidas", totalSaidas);
            command.Parameters.AddWithValue("saldoFinal", saldoFinal);
            if (await command.ExecuteNonQueryAsync(cancellationToken) != 1)
            {
                throw new ConflictException("CAIXA_JA_FECHADO", "Caixa já foi fechado.");
            }
        }

        await transaction.CommitAsync(cancellationToken);
        return new ResultadoFechamento(caixaId, data, entradas, totalSaidas, saldoFinal, diariasLancadas);
    }

    /// <summary>
    /// Falta = funcionário simplesmente não listado; o valor informado vale só neste lançamento
    /// e, se nulo, vale o do cadastro (que também confirma a existência do funcionário).
    /// </summary>
    private static async Task<List<(Guid FuncionarioId, decimal Valor)>> ResolverDiariasAsync(
        NpgsqlConnection connection, NpgsqlTransaction transaction,
        IReadOnlyList<DiariaFechamento> funcionarioIds, CancellationToken cancellationToken)
    {
        var valores = new Dictionary<Guid, decimal>();
        if (funcionarioIds.Count > 0)
        {
            await using var command = new NpgsqlCommand(Sql.GetValoresDiaria, connection, transaction);
            command.Parameters.AddWithValue("ids", funcionarioIds.Select(d => d.FuncionarioId).ToArray());
            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            while (await reader.ReadAsync(cancellationToken))
            {
                valores[reader.GetGuid(0)] = reader.GetDecimal(1);
            }
        }

        var efetivos = new List<(Guid FuncionarioId, decimal Valor)>();
        foreach (var (funcionarioId, valor) in funcionarioIds)
        {
            if (!valores.TryGetValue(funcionarioId, out var cadastro))
            {
                throw new EntityNotFoundException(
                    "FUNCIONARIO_NAO_ENCONTRADO", $"Funcionário {funcionarioId} não encontrado.");
            }

            efetivos.Add((funcionarioId, valor ?? cadastro));
        }

        return efetivos;
    }

    /// <summary>Consolidados do caixa; diária NÃO sai do caixa (regra crítica 7).</summary>
    private static async Task<(decimal Entradas, decimal Saidas, decimal SaldoFinal)> CalcularTotaisAsync(
        NpgsqlConnection connection, NpgsqlTransaction transaction, Guid caixaId, DateOnly data,
        decimal saldoInicial, CancellationToken cancellationToken)
    {
        var entradas = await GetEntradasAsync(connection, transaction, data, cancellationToken);
        decimal totalSaidas;
        await using (var command = new NpgsqlCommand(Sql.TotalDespesas, connection, transaction))
        {
            command.Parameters.AddWithValue("caixaId", caixaId);
            totalSaidas = (decimal?)await command.ExecuteScalarAsync(cancellationToken) ?? 0m;
        }

        return (entradas, totalSaidas, saldoInicial + entradas - totalSaidas);
    }

    public async Task<IReadOnlyList<Caixa>> ListAbertosAntesDeAsync(
        DateOnly data, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(Sql.ListAbertosAntesDe, connection);
        command.Parameters.Add(new NpgsqlParameter("data", NpgsqlDbType.Date) { Value = data });
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        var results = new List<Caixa>();
        while (await reader.ReadAsync(cancellationToken))
        {
            results.Add(MapCaixa(reader));
        }

        return results;
    }

    public async Task<bool> FecharPeloSistemaAsync(
        Guid caixaId, DateTimeOffset fechadoEm, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);

        DateOnly data;
        decimal saldoInicial;
        await using (var command = new NpgsqlCommand(Sql.TravaCaixaParaFechar, connection, transaction))
        {
            command.Parameters.AddWithValue("caixaId", caixaId);
            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            if (!await reader.ReadAsync(cancellationToken)
                || reader.GetString(0) != nameof(StatusCaixa.ABERTO))
            {
                return false; // já fechado (à mão ou por outro ciclo): idempotente
            }

            data = reader.GetFieldValue<DateOnly>(1);
            saldoInicial = reader.GetDecimal(2);
        }

        var (entradas, totalSaidas, saldoFinal) =
            await CalcularTotaisAsync(connection, transaction, caixaId, data, saldoInicial, cancellationToken);

        int linhas;
        await using (var command = new NpgsqlCommand(Sql.FecharPeloSistema, connection, transaction))
        {
            command.Parameters.AddWithValue("caixaId", caixaId);
            command.Parameters.AddWithValue("totalEntradas", entradas);
            command.Parameters.AddWithValue("totalSaidas", totalSaidas);
            command.Parameters.AddWithValue("saldoFinal", saldoFinal);
            command.Parameters.Add(ParametroInstante("fechadoEm", fechadoEm));
            linhas = await command.ExecuteNonQueryAsync(cancellationToken);
        }

        await transaction.CommitAsync(cancellationToken);
        return linhas == 1;
    }

    public async Task<IReadOnlyList<CaixaDiariasPendentes>> ListComDiariasPendentesAsync(
        CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(Sql.ListComDiariasPendentes, connection);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        var results = new List<CaixaDiariasPendentes>();
        while (await reader.ReadAsync(cancellationToken))
        {
            results.Add(new CaixaDiariasPendentes(reader.GetGuid(0), reader.GetFieldValue<DateOnly>(1)));
        }

        return results;
    }

    public async Task<ResultadoLancamentoDiarias> LancarDiariasPendentesAsync(
        Guid caixaId, IReadOnlyList<DiariaFechamento> diarias, DateTimeOffset instante,
        CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);

        DateOnly data;
        await using (var command = new NpgsqlCommand(Sql.TravaCaixaParaDiarias, connection, transaction))
        {
            command.Parameters.AddWithValue("caixaId", caixaId);
            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            if (!await reader.ReadAsync(cancellationToken))
            {
                throw new EntityNotFoundException("CAIXA_NAO_ENCONTRADO", $"Caixa {caixaId} não encontrado.");
            }

            data = reader.GetFieldValue<DateOnly>(0);
            if (!reader.GetBoolean(1))
            {
                throw new BusinessRuleException(
                    "CAIXA_SEM_DIARIAS_PENDENTES",
                    "O caixa não foi fechado pelo sistema: não há diárias pendentes.");
            }

            if (!reader.GetBoolean(2))
            {
                throw CaixaService.DiariasJaLancadas(data);
            }
        }

        var efetivos = await ResolverDiariasAsync(connection, transaction, diarias, cancellationToken);

        // Valor efetivo 0 não gera lançamento: lancamentos_funcionario exige valor > 0.
        var lancadas = 0;
        foreach (var (funcionarioId, valor) in efetivos.Where(e => e.Valor > 0))
        {
            lancadas++;
            await using var command = new NpgsqlCommand(Sql.InsertDiariaPendente, connection, transaction);
            command.Parameters.AddWithValue("funcionarioId", funcionarioId);
            command.Parameters.AddWithValue("caixaId", caixaId);
            command.Parameters.AddWithValue("valor", valor);
            command.Parameters.Add(ParametroInstante("createdAt", instante));
            try
            {
                await command.ExecuteNonQueryAsync(cancellationToken);
            }
            catch (PostgresException e) when (e.SqlState == PostgresErrorCodes.UniqueViolation)
            {
                throw CaixaService.DiariasJaLancadas(data);
            }
        }

        await using (var command = new NpgsqlCommand(Sql.QuitarDiariasPendentes, connection, transaction))
        {
            command.Parameters.AddWithValue("caixaId", caixaId);
            await command.ExecuteNonQueryAsync(cancellationToken);
        }

        await transaction.CommitAsync(cancellationToken);
        return new ResultadoLancamentoDiarias(caixaId, data, lancadas);
    }

    private static Caixa MapCaixa(NpgsqlDataReader reader) => new(
        reader.GetGuid(0),
        reader.GetFieldValue<DateOnly>(1),
        Enum.Parse<StatusCaixa>(reader.GetString(2)),
        reader.GetDecimal(3),
        reader.IsDBNull(4) ? null : reader.GetDecimal(4),
        reader.IsDBNull(5) ? null : reader.GetDecimal(5),
        reader.IsDBNull(6) ? null : reader.GetDecimal(6),
        reader.IsDBNull(7) ? null : reader.GetFieldValue<DateTimeOffset>(7),
        reader.GetBoolean(8),
        reader.GetBoolean(9));

    /// <summary>Npgsql só grava timestamptz com Offset 0: todo instante vai em UTC (a meia-noite de SP vira 03:00Z).</summary>
    public static NpgsqlParameter ParametroInstante(string nome, DateTimeOffset instante) =>
        new(nome, NpgsqlDbType.TimestampTz) { Value = instante.ToUniversalTime() };

    private static class Sql
    {
        private const string SelectCaixa = """
            SELECT id, data, status::text, saldo_inicial, total_entradas, total_saidas,
                   saldo_final, fechado_em, fechado_pelo_sistema, diarias_pendentes
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
                               AND p.forma <> 'CREDITO_CLIENTE'
                               AND p.lancamento_fiado_id IS NULL
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
            WHERE id = @caixaId AND status = 'ABERTO' AND deleted_at IS NULL
            """;

        public const string ListAbertosAntesDe =
            SelectCaixa + " WHERE data < @data AND status = 'ABERTO' AND deleted_at IS NULL ORDER BY data";

        public const string FecharPeloSistema = """
            UPDATE caixas
            SET status = 'FECHADO', total_entradas = @totalEntradas, total_saidas = @totalSaidas,
                saldo_final = @saldoFinal, fechado_em = @fechadoEm, fechado_pelo_sistema = true,
                diarias_pendentes = true, updated_at = now()
            WHERE id = @caixaId AND status = 'ABERTO' AND deleted_at IS NULL
            """;

        public const string ListComDiariasPendentes = """
            SELECT id, data FROM caixas
            WHERE fechado_pelo_sistema AND diarias_pendentes AND deleted_at IS NULL
            ORDER BY data
            """;

        public const string TravaCaixaParaDiarias = """
            SELECT data, fechado_pelo_sistema, diarias_pendentes FROM caixas
            WHERE id = @caixaId AND deleted_at IS NULL
            FOR UPDATE
            """;

        public const string InsertDiariaPendente = """
            INSERT INTO lancamentos_funcionario (funcionario_id, caixa_id, tipo, valor, created_at)
            VALUES (@funcionarioId, @caixaId, 'DIARIA', @valor, @createdAt)
            """;

        public const string QuitarDiariasPendentes = """
            UPDATE caixas SET diarias_pendentes = false, updated_at = now()
            WHERE id = @caixaId AND diarias_pendentes
            """;

        public const string TravaCaixaPorId =
            "SELECT status::text FROM caixas WHERE id = @caixaId AND deleted_at IS NULL FOR SHARE";

        public const string TravaCaixaParaFechar = """
            SELECT status::text, data, saldo_inicial FROM caixas
            WHERE id = @caixaId AND deleted_at IS NULL
            FOR UPDATE
            """;

        public const string TotalDespesas =
            "SELECT COALESCE(SUM(valor), 0) FROM caixa_despesas WHERE caixa_id = @caixaId AND deleted_at IS NULL";

        public const string GetValoresDiaria = """
            SELECT id, valor_diaria FROM funcionarios
            WHERE id = ANY(@ids) AND deleted_at IS NULL
            """;
    }
}
