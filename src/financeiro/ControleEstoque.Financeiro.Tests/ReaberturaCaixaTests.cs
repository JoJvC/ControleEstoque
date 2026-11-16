using ControleEstoque.Financeiro.Domain;
using ControleEstoque.Shared.Results;

namespace ControleEstoque.Financeiro.Tests;

public sealed class ReaberturaCaixaTests
{
    private static readonly TimeSpan Sp = TimeSpan.FromHours(-3);
    private static readonly DateOnly Dia10 = new(2026, 11, 10);

    private readonly FakeCaixaRepository caixas = new();
    private readonly FakeTipoDespesaRepository tipos = new();
    private readonly FakePermissaoLookup permissoes = new();

    private static DateTimeOffset Em(int dia, int h, int m = 0) => new(2026, 11, dia, h, m, 0, Sp);

    private CaixaService ServicoEm(DateTimeOffset agora) => new(caixas, tipos, permissoes, new RelogioFixo(agora));

    private Caixa CaixaFechado(DateOnly? data = null, bool pelaSistema = false, bool pendentes = false) =>
        caixas.AddCaixa(
            data ?? Dia10, 100m, StatusCaixa.FECHADO, Em(11, 0), fechadoPeloSistema: pelaSistema,
            diariasPendentes: pendentes);

    [Fact]
    public async Task ReabrirAsync_SemAPermissao_LancaPermissaoNegadaENaoReabre()
    {
        var caixa = CaixaFechado();
        var semPermissao = permissoes.AddFuncionario("caixa.fechar");

        var e = await Assert.ThrowsAsync<ForbiddenException>(
            () => ServicoEm(Em(12, 10)).ReabrirAsync(caixa.Id, semPermissao, "venda esquecida", default));

        Assert.Equal("PERMISSAO_NEGADA", e.Code);
        Assert.Equal(StatusCaixa.FECHADO, (await caixas.GetAsync(caixa.Id, default))!.Status);
        Assert.Empty(caixas.Reaberturas);
    }

    [Fact]
    public async Task ReabrirAsync_ComAsterisco_Reabre()
    {
        var caixa = CaixaFechado();
        var dono = permissoes.AddFuncionario("*");

        var reaberto = await ServicoEm(Em(12, 10)).ReabrirAsync(caixa.Id, dono, "venda esquecida", default);

        Assert.Equal(StatusCaixa.ABERTO, reaberto.Status);
    }

    [Fact]
    public async Task ReabrirAsync_ComAChave_Reabre()
    {
        var caixa = CaixaFechado();
        var gerente = permissoes.AddFuncionario(PermissoesCaixa.Reabrir);

        var reaberto = await ServicoEm(Em(12, 10)).ReabrirAsync(caixa.Id, gerente, "venda esquecida", default);

        Assert.Equal(StatusCaixa.ABERTO, reaberto.Status);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public async Task ReabrirAsync_SemMotivo_LancaMotivoObrigatorio(string? motivo)
    {
        var caixa = CaixaFechado();
        var dono = permissoes.AddFuncionario("*");

        var e = await Assert.ThrowsAsync<RequestValidationException>(
            () => ServicoEm(Em(12, 10)).ReabrirAsync(caixa.Id, dono, motivo, default));

        Assert.Equal("MOTIVO_OBRIGATORIO", e.Code);
        Assert.Empty(caixas.Reaberturas);
    }

    [Fact]
    public async Task ReabrirAsync_FuncionarioVazio_LancaIdInvalido()
    {
        var caixa = CaixaFechado();

        var e = await Assert.ThrowsAsync<RequestValidationException>(
            () => ServicoEm(Em(12, 10)).ReabrirAsync(caixa.Id, Guid.Empty, "motivo", default));

        Assert.Equal("ID_INVALIDO", e.Code);
    }

    [Fact]
    public async Task ReabrirAsync_CaixaInexistente_LancaCaixaNaoEncontrado()
    {
        var dono = permissoes.AddFuncionario("*");

        var e = await Assert.ThrowsAsync<EntityNotFoundException>(
            () => ServicoEm(Em(12, 10)).ReabrirAsync(Guid.NewGuid(), dono, "motivo", default));

        Assert.Equal("CAIXA_NAO_ENCONTRADO", e.Code);
    }

    [Fact]
    public async Task ReabrirAsync_CaixaJaAberto_LancaCaixaJaAberto()
    {
        var caixa = caixas.AddCaixa(Dia10, 0m);
        var dono = permissoes.AddFuncionario("*");

        var e = await Assert.ThrowsAsync<ConflictException>(
            () => ServicoEm(Em(12, 10)).ReabrirAsync(caixa.Id, dono, "motivo", default));

        Assert.Equal("CAIXA_JA_ABERTO", e.Code);
        Assert.Empty(caixas.Reaberturas);
    }

    [Fact]
    public async Task ReabrirAsync_RegistraQuemQuandoEOMotivo()
    {
        var caixa = CaixaFechado(pelaSistema: true, pendentes: true);
        var dono = permissoes.AddFuncionario("*");

        await ServicoEm(Em(12, 10)).ReabrirAsync(caixa.Id, dono, "venda esquecida", default);

        Assert.Equal(new Reabertura(caixa.Id, dono, Em(12, 10), "venda esquecida"), Assert.Single(caixas.Reaberturas));
    }

    [Fact]
    public async Task ReabrirAsync_DesfazDiariasDeixaValeEPagamentoEVoltaAbertoSemFlagsDeSistema()
    {
        var caixa = CaixaFechado(pelaSistema: true, pendentes: false);
        var func = Guid.NewGuid();
        caixas.Lancamentos.Add(new LancamentoFuncionario(caixa.Id, func, "DIARIA", 80m, false));
        caixas.Lancamentos.Add(new LancamentoFuncionario(caixa.Id, func, "VALE", 20m, false));
        caixas.Lancamentos.Add(new LancamentoFuncionario(caixa.Id, func, "PAGAMENTO", 30m, false));
        var dono = permissoes.AddFuncionario("*");

        var reaberto = await ServicoEm(Em(12, 10)).ReabrirAsync(caixa.Id, dono, "motivo", default);

        Assert.Equal(StatusCaixa.ABERTO, reaberto.Status);
        Assert.False(reaberto.FechadoPeloSistema);
        Assert.False(reaberto.DiariasPendentes);
        Assert.Null(reaberto.FechadoEm);
        Assert.Empty(caixas.DiariasAtivas(caixa.Id));
        Assert.Equal(
            ["VALE", "PAGAMENTO"],
            caixas.Lancamentos.Where(l => !l.Apagado).Select(l => l.Tipo).ToList());
    }

    [Fact]
    public async Task FecharAsync_DeNovoAposReabrir_LancaAsDiariasDeNovoComADataDoCaixa()
    {
        var func = Guid.NewGuid();
        caixas.ValoresDiaria[func] = 80m;
        var caixa = caixas.AddCaixa(Dia10, 0m);
        var servico = ServicoEm(Em(10, 20));
        await servico.FecharAsync(caixa.Id, [new DiariaFechamento(func, null)], default);
        var dono = permissoes.AddFuncionario("*");
        var depois = ServicoEm(Em(12, 10));

        await depois.ReabrirAsync(caixa.Id, dono, "venda esquecida", default);
        Assert.Empty(caixas.DiariasAtivas(caixa.Id));
        var resultado = await depois.FecharAsync(caixa.Id, [new DiariaFechamento(func, null)], default);

        Assert.Equal(1, resultado.DiariasLancadas);
        Assert.Single(caixas.DiariasAtivas(caixa.Id));
        Assert.Equal(2, caixas.Lancamentos.Count(l => l.Tipo == "DIARIA")); // a antiga segue apagada
        // 1º fechamento no próprio dia: now(); 2º, de dia anterior: 23:59:59 do caixa.
        Assert.Equal([null, RelogioCaixa.InstanteDaDiaria(Dia10)], caixas.InstantesDiariasFechamento);
    }

    [Fact]
    public async Task DespesaNoCaixaReaberto_ComRelogioEmOutroDia_EntraNoCaixaReaberto()
    {
        var caixa = CaixaFechado();
        var dono = permissoes.AddFuncionario("*");
        var servico = ServicoEm(Em(12, 10));
        await servico.ReabrirAsync(caixa.Id, dono, "motivo", default);
        var tipo = tipos.Add("Gelo");

        await servico.AdicionarDespesaAsync(caixa.Id, tipo.Id, 25m, null, default);

        Assert.Equal(25m, Assert.Single(await caixas.ListDespesasAsync(caixa.Id, default)).Valor);
    }

    [Fact]
    public async Task FecharVencidosAsync_NaMeiaNoite_NaoFechaCaixaReabertoEFechaOsOutros()
    {
        var reaberto = CaixaFechado(new DateOnly(2026, 11, 14));
        var vencido = caixas.AddCaixa(new DateOnly(2026, 11, 15), 0m);
        var dono = permissoes.AddFuncionario("*");
        await ServicoEm(Em(15, 9)).ReabrirAsync(reaberto.Id, dono, "motivo", default);

        var fechados = await ServicoEm(Em(16, 0, 1)).FecharVencidosAsync(default);

        Assert.Equal(1, fechados);
        Assert.Equal(StatusCaixa.ABERTO, (await caixas.GetAsync(reaberto.Id, default))!.Status);
        Assert.Equal(StatusCaixa.FECHADO, (await caixas.GetAsync(vencido.Id, default))!.Status);
    }

    [Fact]
    public async Task ReabrirAsync_DuasVezes_GuardaAsDuasReaberturas()
    {
        var caixa = CaixaFechado();
        var dono = permissoes.AddFuncionario("*");
        var servico = ServicoEm(Em(12, 10));

        await servico.ReabrirAsync(caixa.Id, dono, "primeira", default);
        await servico.FecharAsync(caixa.Id, [], default);
        await ServicoEm(Em(13, 9)).ReabrirAsync(caixa.Id, dono, "segunda", default);

        Assert.Equal(["primeira", "segunda"], caixas.Reaberturas.Select(r => r.Motivo).ToList());
        Assert.Equal(StatusCaixa.ABERTO, (await caixas.GetAsync(caixa.Id, default))!.Status);
    }
}
