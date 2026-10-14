using ControleEstoque.Financeiro.Domain;
using ControleEstoque.Shared.Results;

namespace ControleEstoque.Financeiro.Tests;

public sealed class CaixaServiceTests
{
    private readonly FakeCaixaRepository caixas = new();
    private readonly FakeTipoDespesaRepository tipos = new();
    private readonly CaixaService sut;

    public CaixaServiceTests() => sut = new CaixaService(caixas, tipos);

    [Fact]
    public async Task FecharAsync_QuandoCaixaJaFechado_LancaCaixaJaFechado()
    {
        var caixa = caixas.AddCaixa(new DateOnly(2026, 7, 7), 100m, StatusCaixa.FECHADO);

        var e = await Assert.ThrowsAsync<BusinessRuleException>(
            () => sut.FecharAsync(caixa.Id, [], CancellationToken.None));

        Assert.Equal("CAIXA_JA_FECHADO", e.Code);
    }

    [Fact]
    public async Task FecharAsync_LancaDiariaComValorDoCadastro()
    {
        var caixa = caixas.AddCaixa(new DateOnly(2026, 7, 7), 100m);
        var funcionario = Guid.NewGuid();
        caixas.ValoresDiaria[funcionario] = 80m;
        caixas.Entradas = 500m;
        caixas.AddDespesa(caixa.Id, 120m);

        var resultado = await sut.FecharAsync(caixa.Id, [funcionario], CancellationToken.None);

        Assert.Single(caixas.DiariasLancadas);
        Assert.Equal((funcionario, 80m), caixas.DiariasLancadas[0]);
        // Diária NÃO entra nas saídas do caixa (regra crítica 7).
        Assert.Equal(120m, resultado.TotalSaidas);
        Assert.Equal(100m + 500m - 120m, resultado.SaldoFinal);
    }

    [Fact]
    public async Task FecharAsync_QuandoFuncionarioInexistente_LancaNotFound()
    {
        var caixa = caixas.AddCaixa(new DateOnly(2026, 7, 7), 0m);

        await Assert.ThrowsAsync<EntityNotFoundException>(
            () => sut.FecharAsync(caixa.Id, [Guid.NewGuid()], CancellationToken.None));
    }

    [Fact]
    public async Task AdicionarDespesaAsync_QuandoCaixaFechado_LancaCaixaFechado()
    {
        var caixa = caixas.AddCaixa(new DateOnly(2026, 7, 7), 0m, StatusCaixa.FECHADO);
        var tipo = tipos.Add("Manutenção");

        var e = await Assert.ThrowsAsync<BusinessRuleException>(
            () => sut.AdicionarDespesaAsync(caixa.Id, tipo.Id, 50m, null, CancellationToken.None));

        Assert.Equal("CAIXA_FECHADO", e.Code);
    }

    [Fact]
    public async Task AdicionarDespesaAsync_QuandoTipoInexistente_LancaTipoInexistente()
    {
        var caixa = caixas.AddCaixa(new DateOnly(2026, 7, 7), 0m);

        var e = await Assert.ThrowsAsync<BusinessRuleException>(
            () => sut.AdicionarDespesaAsync(caixa.Id, Guid.NewGuid(), 50m, null, CancellationToken.None));

        Assert.Equal("TIPO_DESPESA_INEXISTENTE", e.Code);
    }

    [Fact]
    public async Task AbrirAsync_QuandoDataDuplicada_LancaConflict()
    {
        await sut.AbrirAsync(new DateOnly(2026, 7, 7), 0m, CancellationToken.None);

        await Assert.ThrowsAsync<ConflictException>(
            () => sut.AbrirAsync(new DateOnly(2026, 7, 7), 0m, CancellationToken.None));
    }
}
