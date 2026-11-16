using System.Text.RegularExpressions;
using ControleEstoque.Financeiro.Domain;
using ControleEstoque.Shared.Results;

namespace ControleEstoque.Financeiro.Tests;

public sealed class FechamentoAutomaticoTests
{
    private static readonly TimeSpan Sp = TimeSpan.FromHours(-3);
    private static readonly DateOnly Dia15 = new(2026, 11, 15);

    private readonly FakeCaixaRepository caixas = new();
    private readonly FakeTipoDespesaRepository tipos = new();

    private CaixaService ServicoEm(DateTimeOffset agora) => new(caixas, tipos, new RelogioFixo(agora));

    private static DateTimeOffset Em(int dia, int h, int m, int s) => new(2026, 11, dia, h, m, s, Sp);

    [Fact]
    public async Task As2359ESpNaoFecha_MesmoComUtcJaNoDiaSeguinte()
    {
        var caixa = caixas.AddCaixa(Dia15, 10m);
        var agora = Em(15, 23, 59, 59);
        Assert.Equal(new DateOnly(2026, 11, 16), DateOnly.FromDateTime(agora.UtcDateTime)); // UTC já é 16/11

        Assert.Equal(0, await ServicoEm(agora).FecharVencidosAsync(CancellationToken.None));

        Assert.Equal(StatusCaixa.ABERTO, (await caixas.GetAsync(caixa.Id, default))!.Status);
    }

    [Fact]
    public async Task As0000EmSp_FechaCaixaDeOntemComoSistemaSemLancarDiaria()
    {
        var caixa = caixas.AddCaixa(Dia15, 100m);
        caixas.Entradas = 40m;
        caixas.AddDespesa(caixa.Id, 15m);
        caixas.ValoresDiaria[Guid.NewGuid()] = 80m;

        var fechados = await ServicoEm(Em(16, 0, 0, 0)).FecharVencidosAsync(CancellationToken.None);

        var c = (await caixas.GetAsync(caixa.Id, default))!;
        Assert.Equal(1, fechados);
        Assert.Equal(StatusCaixa.FECHADO, c.Status);
        Assert.Equal(new DateTimeOffset(2026, 11, 16, 0, 0, 0, Sp), c.FechadoEm);
        Assert.True(c.FechadoPeloSistema);
        Assert.True(c.DiariasPendentes);
        Assert.Equal((40m, 15m, 125m), (c.TotalEntradas, c.TotalSaidas, c.SaldoFinal));
        Assert.Empty(caixas.DiariasLancadas);
        Assert.Empty(caixas.DiariasPendentesLancadas);
    }

    [Fact]
    public async Task CaixaDeHojeAbertoNaoFecha()
    {
        var hoje = caixas.AddCaixa(new DateOnly(2026, 11, 16), 0m);

        Assert.Equal(0, await ServicoEm(Em(16, 10, 0, 0)).FecharVencidosAsync(CancellationToken.None));

        Assert.Equal(StatusCaixa.ABERTO, (await caixas.GetAsync(hoje.Id, default))!.Status);
    }

    [Fact]
    public async Task CaixaFechadoAMaoFicaIgual()
    {
        var fechadoEm = Em(15, 18, 30, 0);
        var caixa = caixas.AddCaixa(Dia15, 5m, StatusCaixa.FECHADO, fechadoEm);

        Assert.Equal(0, await ServicoEm(Em(17, 9, 0, 0)).FecharVencidosAsync(CancellationToken.None));

        Assert.Equal(caixa, await caixas.GetAsync(caixa.Id, default));
        Assert.False(caixa.FechadoPeloSistema);
        Assert.False(caixa.DiariasPendentes);
    }

    [Fact]
    public async Task RodarDuasVezes_SegundaDevolveZeroENadaMuda()
    {
        var caixa = caixas.AddCaixa(Dia15, 5m);
        var sut = ServicoEm(Em(16, 0, 0, 0));
        await sut.FecharVencidosAsync(CancellationToken.None);
        var depoisDaPrimeira = await caixas.GetAsync(caixa.Id, default);

        var segunda = await ServicoEm(Em(16, 8, 0, 0)).FecharVencidosAsync(CancellationToken.None);

        Assert.Equal(0, segunda);
        Assert.Equal(depoisDaPrimeira, await caixas.GetAsync(caixa.Id, default));
    }

    [Fact]
    public async Task DiariasFicamPendentes_EResumoAvisa()
    {
        var antigo = caixas.AddCaixa(Dia15, 0m);
        caixas.AddCaixa(new DateOnly(2026, 11, 16), 0m);

        var resumo = await ServicoEm(Em(16, 8, 0, 0)).ObterResumoAsync(
            new DateOnly(2026, 11, 16), CancellationToken.None);

        Assert.Equal(new CaixaDiariasPendentes(antigo.Id, Dia15), Assert.Single(resumo.CaixasComDiariasPendentes));
    }

    [Fact]
    public async Task AbrirAsync_DisparaOFechamentoAutomatico()
    {
        var antigo = caixas.AddCaixa(Dia15, 0m);

        await ServicoEm(Em(16, 8, 0, 0)).AbrirAsync(new DateOnly(2026, 11, 16), 0m, CancellationToken.None);

        var c = (await caixas.GetAsync(antigo.Id, default))!;
        Assert.True(c.FechadoPeloSistema);
        Assert.Equal(StatusCaixa.FECHADO, c.Status);
    }

    [Fact]
    public async Task LancarDepois_ComValorEditado_GravaNaDataDoCaixaEQuitaAPendencia()
    {
        var caixa = caixas.AddCaixa(Dia15, 0m);
        var a = Guid.NewGuid();
        var b = Guid.NewGuid();
        caixas.ValoresDiaria[a] = 60m;
        caixas.ValoresDiaria[b] = 55m;
        var sut = ServicoEm(Em(16, 9, 0, 0));
        await sut.FecharVencidosAsync(CancellationToken.None);

        var r = await sut.LancarDiariasPendentesAsync(
            caixa.Id, [new DiariaFechamento(a, 70m), new DiariaFechamento(b, null)], CancellationToken.None);

        Assert.Equal(2, r.DiariasLancadas);
        Assert.Equal(Dia15, r.Data);
        Assert.Equal((a, 70m), (caixas.DiariasPendentesLancadas[0].FuncionarioId, caixas.DiariasPendentesLancadas[0].Valor));
        Assert.Equal((b, 55m), (caixas.DiariasPendentesLancadas[1].FuncionarioId, caixas.DiariasPendentesLancadas[1].Valor));
        Assert.All(caixas.DiariasPendentesLancadas, d =>
        {
            Assert.Equal(new DateTimeOffset(2026, 11, 15, 23, 59, 59, Sp), d.CriadoEm);
            Assert.Equal(Dia15, RelogioCaixa.HojeEmSaoPaulo(d.CriadoEm));
        });
        Assert.Empty((await sut.ObterResumoAsync(Dia15, CancellationToken.None)).CaixasComDiariasPendentes);
        var c = (await caixas.GetAsync(caixa.Id, default))!;
        Assert.Equal(StatusCaixa.FECHADO, c.Status); // não reabre
        Assert.True(c.FechadoPeloSistema);
    }

    [Fact]
    public async Task LancarDepois_ValorZeroNaoLanca()
    {
        var caixa = caixas.AddCaixa(Dia15, 0m);
        var a = Guid.NewGuid();
        caixas.ValoresDiaria[a] = 60m;
        var sut = ServicoEm(Em(16, 9, 0, 0));
        await sut.FecharVencidosAsync(CancellationToken.None);

        var r = await sut.LancarDiariasPendentesAsync(caixa.Id, [new DiariaFechamento(a, 0m)], CancellationToken.None);

        Assert.Equal(0, r.DiariasLancadas);
        Assert.Empty(caixas.DiariasPendentesLancadas);
    }

    [Fact]
    public async Task LancarDepois_SegundaTentativaRecebeDiariasJaLancadas()
    {
        var caixa = caixas.AddCaixa(Dia15, 0m);
        var sut = ServicoEm(Em(16, 9, 0, 0));
        await sut.FecharVencidosAsync(CancellationToken.None);
        await sut.LancarDiariasPendentesAsync(caixa.Id, [], CancellationToken.None);

        var e = await Assert.ThrowsAsync<ConflictException>(
            () => sut.LancarDiariasPendentesAsync(caixa.Id, [], CancellationToken.None));

        Assert.Equal("DIARIAS_JA_LANCADAS", e.Code);
        Assert.Equal("As diárias do caixa de 15/11/2026 já foram lançadas.", e.Message);
    }

    [Fact]
    public async Task LancarDepois_CaixaAbertoOuFechadoAMao_RecebeSemDiariasPendentes()
    {
        var aberto = caixas.AddCaixa(Dia15, 0m);
        var amao = caixas.AddCaixa(new DateOnly(2026, 11, 14), 0m, StatusCaixa.FECHADO, Em(14, 18, 0, 0));
        var sut = ServicoEm(Em(15, 9, 0, 0)); // 14/11 já passou, mas o fechado à mão não é tocado

        foreach (var id in new[] { aberto.Id, amao.Id })
        {
            var e = await Assert.ThrowsAsync<BusinessRuleException>(
                () => sut.LancarDiariasPendentesAsync(id, [], CancellationToken.None));
            Assert.Equal("CAIXA_SEM_DIARIAS_PENDENTES", e.Code);
        }
    }

    [Fact]
    public async Task LancarDepois_CaixaInexistente_LancaNaoEncontrado()
    {
        var e = await Assert.ThrowsAsync<EntityNotFoundException>(
            () => ServicoEm(Em(16, 9, 0, 0)).LancarDiariasPendentesAsync(Guid.NewGuid(), [], CancellationToken.None));

        Assert.Equal("CAIXA_NAO_ENCONTRADO", e.Code);
    }

    [Fact]
    public async Task LancarDepois_ValidaDuplicadoENegativoComoOManual()
    {
        var caixa = caixas.AddCaixa(Dia15, 0m);
        var a = Guid.NewGuid();
        var sut = ServicoEm(Em(16, 9, 0, 0));
        await sut.FecharVencidosAsync(CancellationToken.None);

        var dup = await Assert.ThrowsAsync<RequestValidationException>(() =>
            sut.LancarDiariasPendentesAsync(caixa.Id, [new(a, 1m), new(a, 2m)], CancellationToken.None));
        var neg = await Assert.ThrowsAsync<RequestValidationException>(() =>
            sut.LancarDiariasPendentesAsync(caixa.Id, [new(a, -1m)], CancellationToken.None));

        Assert.Equal("FUNCIONARIO_DUPLICADO", dup.Code);
        Assert.Equal("DIARIA_INVALIDA", neg.Code);
    }

    [Fact]
    public void FuncoesPuras_HojeMeiaNoiteEInstanteDaDiaria()
    {
        // 16/11 02:59:59 UTC = 15/11 23:59:59 em SP; 03:00 UTC = 16/11 00:00 em SP
        Assert.Equal(Dia15, RelogioCaixa.HojeEmSaoPaulo(new DateTimeOffset(2026, 11, 16, 2, 59, 59, TimeSpan.Zero)));
        Assert.Equal(
            new DateOnly(2026, 11, 16),
            RelogioCaixa.HojeEmSaoPaulo(new DateTimeOffset(2026, 11, 16, 3, 0, 0, TimeSpan.Zero)));
        Assert.Equal(new DateTimeOffset(2026, 11, 16, 3, 0, 0, TimeSpan.Zero), RelogioCaixa.MeiaNoiteSeguinte(Dia15));
        Assert.Equal(new DateTimeOffset(2027, 1, 1, 3, 0, 0, TimeSpan.Zero), RelogioCaixa.MeiaNoiteSeguinte(new DateOnly(2026, 12, 31)));
        Assert.Equal(
            new DateTimeOffset(2026, 11, 16, 2, 59, 59, TimeSpan.Zero), RelogioCaixa.InstanteDaDiaria(Dia15));
    }

    // ---- SQL conferido pelo texto dos arquivos (sem Postgres na verificação) ----

    private static string Ler(params string[] caminho)
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null && !File.Exists(Path.Combine(dir.FullName, "infra", "postgres", "init.sql")))
            dir = dir.Parent;
        Assert.NotNull(dir);
        return File.ReadAllText(Path.Combine([dir!.FullName, .. caminho]));
    }

    private static string Sql(string nome)
    {
        var cs = Ler("src", "financeiro", "ControleEstoque.Financeiro.Repository", "PostgresCaixaRepository.cs");
        var m = Regex.Match(cs, $@"public const string {nome} =\s*(?:""""""(.*?)""""""|(.*?);)", RegexOptions.Singleline);
        Assert.True(m.Success, $"SQL {nome} não encontrado");
        return m.Value;
    }

    [Fact]
    public void InitSql_TemAsColunasEACheckIdempotentes()
    {
        var sql = Ler("infra", "postgres", "init.sql");

        Assert.Contains("ALTER TABLE caixas ADD COLUMN IF NOT EXISTS fechado_pelo_sistema BOOLEAN NOT NULL DEFAULT false;", sql);
        Assert.Contains("ALTER TABLE caixas ADD COLUMN IF NOT EXISTS diarias_pendentes BOOLEAN NOT NULL DEFAULT false;", sql);
        Assert.Matches(
            @"conname = 'ck_caixas_pendentes_so_sistema'(?s:.*?)CHECK \(NOT diarias_pendentes OR fechado_pelo_sistema\)", sql);
    }

    [Fact]
    public void SqlDoFechamentoPeloSistema_SoAbertoFechadoEmPorParametroSemDiaria()
    {
        var sql = Sql("FecharPeloSistema");

        Assert.Contains("status = 'ABERTO'", sql);
        Assert.Contains("fechado_em = @fechadoEm", sql);
        Assert.Contains("fechado_pelo_sistema = true", sql);
        Assert.Contains("diarias_pendentes = true", sql);
        Assert.DoesNotContain("lancamentos_funcionario", sql);
        var repo = Ler("src", "financeiro", "ControleEstoque.Financeiro.Repository", "PostgresCaixaRepository.cs");
        var metodo = repo[repo.IndexOf("public async Task<bool> FecharPeloSistemaAsync", StringComparison.Ordinal)..];
        metodo = metodo[..metodo.IndexOf("ListComDiariasPendentesAsync", StringComparison.Ordinal)];
        Assert.DoesNotContain("InsertDiaria", metodo);
    }

    [Fact]
    public void SqlDaDiariaLancadaDepois_GravaCreatedAtPorParametro()
    {
        var sql = Sql("InsertDiariaPendente");

        Assert.Contains("INSERT INTO lancamentos_funcionario", sql);
        Assert.Contains("created_at", sql);
        Assert.Contains("@createdAt", sql);
    }

    [Fact]
    public void ParametroInstante_VaiEmUtc_MeiaNoiteDeSpVira03hZ()
    {
        // Npgsql recusa timestamptz com Offset != 0 (ArgumentException).
        var p = Repository.PostgresCaixaRepository.ParametroInstante("fechadoEm", RelogioCaixa.MeiaNoiteSeguinte(Dia15));

        var v = Assert.IsType<DateTimeOffset>(p.Value);
        Assert.Equal(TimeSpan.Zero, v.Offset);
        Assert.Equal(new DateTimeOffset(2026, 11, 16, 3, 0, 0, TimeSpan.Zero), v);
        Assert.Equal(NpgsqlTypes.NpgsqlDbType.TimestampTz, p.NpgsqlDbType);
    }

    [Fact]
    public void RepositorioDoCaixa_NaoEnviaDateTimeOffsetCruAoNpgsql()
    {
        var repo = Ler("src", "financeiro", "ControleEstoque.Financeiro.Repository", "PostgresCaixaRepository.cs");

        Assert.DoesNotContain("AddWithValue(\"fechadoEm\"", repo);
        Assert.DoesNotContain("AddWithValue(\"createdAt\"", repo);
        Assert.Contains("ParametroInstante(\"fechadoEm\", fechadoEm)", repo);
        Assert.Contains("ParametroInstante(\"createdAt\", instante)", repo);
    }
}
