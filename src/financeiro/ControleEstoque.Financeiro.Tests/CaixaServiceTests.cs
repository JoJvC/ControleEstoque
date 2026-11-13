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

        var e = await Assert.ThrowsAsync<ConflictException>(
            () => sut.FecharAsync(caixa.Id, [], CancellationToken.None));

        Assert.Equal("CAIXA_JA_FECHADO", e.Code);
    }

    [Fact]
    public async Task FecharAsync_QuandoUpdateAfetaZeroLinhas_LancaCaixaJaFechado()
    {
        // Corrida: outro fechamento ganhou entre a leitura e o UPDATE condicional (status = 'ABERTO').
        var caixa = caixas.AddCaixa(new DateOnly(2026, 7, 7), 100m);
        caixas.LinhasAfetadasNoFechamento = 0;

        var e = await Assert.ThrowsAsync<ConflictException>(
            () => sut.FecharAsync(caixa.Id, [], CancellationToken.None));

        Assert.Equal("CAIXA_JA_FECHADO", e.Code);
        Assert.Null(caixas.Fechamento);
    }

    [Fact]
    public async Task FecharAsync_QuandoBancoInformaDiariaDuplicada_LancaCaixaJaFechado()
    {
        // UniqueViolation de lancamentos_funcionario (caixa_id, funcionario_id, DIARIA) vira CAIXA_JA_FECHADO.
        var caixa = caixas.AddCaixa(new DateOnly(2026, 7, 7), 100m);
        var funcionario = Guid.NewGuid();
        caixas.ValoresDiaria[funcionario] = 80m;
        caixas.DiariaDuplicadaNoBanco = true;

        var e = await Assert.ThrowsAsync<ConflictException>(
            () => sut.FecharAsync(caixa.Id, [funcionario], CancellationToken.None));

        Assert.Equal("CAIXA_JA_FECHADO", e.Code);
        Assert.Empty(caixas.DiariasLancadas);
    }

    [Fact]
    public async Task FecharAsync_QuandoFuncionarioRepetido_LancaValidacaoENaoFecha()
    {
        var caixa = caixas.AddCaixa(new DateOnly(2026, 7, 7), 100m);
        var funcionario = Guid.NewGuid();
        caixas.ValoresDiaria[funcionario] = 80m;

        var e = await Assert.ThrowsAsync<RequestValidationException>(
            () => sut.FecharAsync(caixa.Id, [funcionario, funcionario], CancellationToken.None));

        Assert.Equal("FUNCIONARIO_DUPLICADO", e.Code);
        Assert.Empty(caixas.DiariasLancadas);
        Assert.Null(caixas.Fechamento);
    }

    [Fact]
    public async Task FecharAsync_TotaisVemDoRepositorio_ServicoNaoLeEntradasNemDespesas()
    {
        var caixa = caixas.AddCaixa(new DateOnly(2026, 7, 7), 100m);
        caixas.Entradas = 500m;
        caixas.AddDespesa(caixa.Id, 120m);

        var resultado = await sut.FecharAsync(caixa.Id, [], CancellationToken.None);

        Assert.Equal(0, caixas.LeiturasAvulsas);
        Assert.Equal(500m, resultado.TotalEntradas);
        Assert.Equal(120m, resultado.TotalSaidas);
        Assert.Equal(caixas.Fechamento, (resultado.TotalEntradas, resultado.TotalSaidas, resultado.SaldoFinal));
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

        var e = await Assert.ThrowsAsync<ConflictException>(
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

    [Fact]
    public async Task AdicionarDespesaAsync_QuandoTipoDespesaIdVazio_LancaIdInvalido()
    {
        var e = await Assert.ThrowsAsync<RequestValidationException>(
            () => sut.AdicionarDespesaAsync(Guid.NewGuid(), Guid.Empty, 10m, null, CancellationToken.None));

        Assert.Equal("ID_INVALIDO", e.Code);
    }

    [Fact]
    public async Task FecharAsync_QuandoFuncionarioIdVazio_LancaIdInvalido()
    {
        var caixa = caixas.AddCaixa(new DateOnly(2026, 7, 7), 100m);

        var e = await Assert.ThrowsAsync<RequestValidationException>(
            () => sut.FecharAsync(caixa.Id, [Guid.Empty], CancellationToken.None));

        Assert.Equal("ID_INVALIDO", e.Code);
    }

    [Fact]
    public async Task AdicionarDespesaAsync_QuandoEntradaValida_Adiciona()
    {
        var caixa = caixas.AddCaixa(new DateOnly(2026, 7, 7), 100m);
        var tipo = tipos.Add("Combustível");

        await sut.AdicionarDespesaAsync(caixa.Id, tipo.Id, 10m, null, CancellationToken.None);
    }

    [Fact]
    public async Task AbrirAsync_QuandoSaldoPositivo_AbreCaixa()
    {
        var data = new DateOnly(2026, 7, 8);

        var caixa = await sut.AbrirAsync(data, 50m, CancellationToken.None);

        Assert.Equal(data, caixa.Data);
        Assert.Equal(50m, caixa.SaldoInicial);
        Assert.NotNull(await caixas.GetByDataAsync(data, CancellationToken.None));
    }

    [Fact]
    public async Task AbrirAsync_QuandoSaldoZero_Aceita()
    {
        var caixa = await sut.AbrirAsync(new DateOnly(2026, 7, 8), 0m, CancellationToken.None);

        Assert.Equal(0m, caixa.SaldoInicial);
    }

    [Fact]
    public async Task AbrirAsync_QuandoSaldoNegativo_LancaSaldoInvalido()
    {
        var e = await Assert.ThrowsAsync<RequestValidationException>(
            () => sut.AbrirAsync(new DateOnly(2026, 7, 8), -0.01m, CancellationToken.None));

        Assert.Equal("SALDO_INVALIDO", e.Code);
    }

    [Fact]
    public async Task ObterResumoAsync_QuandoSemCaixa_LancaNaoEncontrado()
    {
        var e = await Assert.ThrowsAsync<EntityNotFoundException>(
            () => sut.ObterResumoAsync(new DateOnly(2026, 7, 8), CancellationToken.None));

        Assert.Equal("CAIXA_NAO_ENCONTRADO", e.Code);
    }

    [Fact]
    public async Task ObterResumoAsync_CalculaSaldoInicialMaisEntradasMenosDespesas()
    {
        var data = new DateOnly(2026, 7, 8);
        var caixa = caixas.AddCaixa(data, 100m);
        caixas.Entradas = 30m;
        caixas.AddDespesa(caixa.Id, 20m);
        caixas.AddDespesa(caixa.Id, 5m);

        var r = await sut.ObterResumoAsync(data, CancellationToken.None);

        Assert.Equal(30m, r.Entradas);
        Assert.Equal(25m, r.TotalDespesas);
        Assert.Equal(105m, r.SaldoParcial);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public async Task AdicionarDespesaAsync_QuandoValorNaoPositivo_LancaValorInvalido(int valor)
    {
        var caixa = caixas.AddCaixa(new DateOnly(2026, 7, 8), 100m);
        var tipo = tipos.Add("Combustível");

        var e = await Assert.ThrowsAsync<RequestValidationException>(
            () => sut.AdicionarDespesaAsync(caixa.Id, tipo.Id, valor, null, CancellationToken.None));

        Assert.Equal("VALOR_INVALIDO", e.Code);
    }

    [Fact]
    public async Task AdicionarDespesaAsync_QuandoCaixaInexistente_LancaNaoEncontrado()
    {
        var tipo = tipos.Add("Combustível");

        var e = await Assert.ThrowsAsync<EntityNotFoundException>(
            () => sut.AdicionarDespesaAsync(Guid.NewGuid(), tipo.Id, 10m, null, CancellationToken.None));

        Assert.Equal("CAIXA_NAO_ENCONTRADO", e.Code);
    }
}
