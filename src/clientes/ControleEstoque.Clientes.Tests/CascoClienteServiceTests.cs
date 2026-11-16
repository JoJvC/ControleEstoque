using ControleEstoque.Clientes.Domain;
using ControleEstoque.Shared.Results;

namespace ControleEstoque.Clientes.Tests;

public sealed class CascoClienteServiceTests
{
    private readonly FakeClienteRepository clientes = new();
    private readonly FakeCascoClienteRepository cascos = new();
    private readonly FakeTipoCascoLeituraRepository tipos = new();
    private readonly CascoClienteService sut;

    public CascoClienteServiceTests() => sut = new CascoClienteService(cascos, clientes, tipos);

    private static LinhaDevolucaoCasco[] Linhas(params (Guid Tipo, int Qtd)[] l) =>
        l.Select(x => new LinhaDevolucaoCasco(x.Tipo, x.Qtd)).ToArray();

    [Fact]
    public async Task DevolverAsync_QuandoDoisTipos_GravaAsDuasLinhasERetornaSaldoPorTipoETotal()
    {
        var cliente = clientes.Add("Cliente X");
        var a = tipos.Add("20L A");
        var b = tipos.Add("20L B");
        cascos.SetSaldo(cliente.Id, a.Id, 3);

        var resultado = await sut.DevolverAsync(
            cliente.Id, Linhas((a.Id, 2), (b.Id, 1)), CancellationToken.None);

        Assert.Equal(1, resultado.NovoSaldoCascos);
        Assert.Equal(1, resultado.SaldoPorTipo.Single(s => s.TipoCascoId == a.Id).Saldo);
        Assert.Equal(-1, resultado.SaldoPorTipo.Single(s => s.TipoCascoId == b.Id).Saldo);
        Assert.Equal(1, await cascos.GetSaldoAsync(cliente.Id, a.Id, CancellationToken.None));
        Assert.Equal(-1, await cascos.GetSaldoAsync(cliente.Id, b.Id, CancellationToken.None));
    }

    [Fact]
    public async Task DevolverAsync_QuandoTipoSemDivida_AceitaEFicaNegativo()
    {
        var cliente = clientes.Add("Cliente X");
        var tipo = tipos.Add("20L Genérico");

        var resultado = await sut.DevolverAsync(cliente.Id, Linhas((tipo.Id, 3)), CancellationToken.None);

        Assert.Equal(0, resultado.NovoSaldoCascos);
    }

    [Fact]
    public async Task DevolverAsync_QuandoDevolveMaisQueDeve_GeraCredito()
    {
        var cliente = clientes.Add("Cliente X");
        var tipo = tipos.Add("20L Genérico");
        cascos.SetSaldo(cliente.Id, tipo.Id, 1);

        var resultado = await sut.DevolverAsync(cliente.Id, Linhas((tipo.Id, 3)), CancellationToken.None);

        Assert.Equal(0, resultado.NovoSaldoCascos);
    }

    [Fact]
    public async Task DevolverAsync_QuandoTipoRepetido_LancaTipoCascoDuplicadoESemGravar()
    {
        var cliente = clientes.Add("Cliente X");
        var tipo = tipos.Add("20L Genérico");

        var e = await Assert.ThrowsAsync<RequestValidationException>(
            () => sut.DevolverAsync(cliente.Id, Linhas((tipo.Id, 1), (tipo.Id, 2)), CancellationToken.None));

        Assert.Equal("TIPO_CASCO_DUPLICADO", e.Code);
        Assert.Equal(0, cascos.TotalChamadasDeEscrita);
    }

    [Fact]
    public async Task DevolverAsync_QuandoQuantidadeZero_LancaQuantidadeInvalida()
    {
        var cliente = clientes.Add("Cliente X");
        var tipo = tipos.Add("20L Genérico");

        var e = await Assert.ThrowsAsync<RequestValidationException>(
            () => sut.DevolverAsync(cliente.Id, Linhas((tipo.Id, 0)), CancellationToken.None));

        Assert.Equal("QUANTIDADE_INVALIDA", e.Code);
        Assert.Equal(0, cascos.TotalChamadasDeEscrita);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task DevolverAsync_QuandoListaVaziaOuNula_LancaItensObrigatorios(bool nula)
    {
        var cliente = clientes.Add("Cliente X");

        var e = await Assert.ThrowsAsync<RequestValidationException>(
            () => sut.DevolverAsync(cliente.Id, nula ? null : Linhas(), CancellationToken.None));

        Assert.Equal("ITENS_OBRIGATORIOS", e.Code);
    }

    [Fact]
    public async Task DevolverAsync_QuandoClienteNaoExiste_LancaNotFound()
    {
        var tipo = tipos.Add("20L Genérico");

        var e = await Assert.ThrowsAsync<EntityNotFoundException>(
            () => sut.DevolverAsync(Guid.NewGuid(), Linhas((tipo.Id, 1)), CancellationToken.None));

        Assert.Equal("CLIENTE_NAO_ENCONTRADO", e.Code);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task DevolverAsync_QuandoTipoNaoExisteOuApagado_LancaTipoCascoNaoEncontradoESemGravar(bool guidVazio)
    {
        var cliente = clientes.Add("Cliente X");
        var existente = tipos.Add("20L A");
        var tipoId = guidVazio ? Guid.Empty : Guid.NewGuid();

        var e = await Assert.ThrowsAsync<EntityNotFoundException>(
            () => sut.DevolverAsync(cliente.Id, Linhas((existente.Id, 1), (tipoId, 1)), CancellationToken.None));

        Assert.Equal("TIPO_CASCO_NAO_ENCONTRADO", e.Code);
        Assert.Equal(0, cascos.TotalChamadasDeEscrita);
    }
}
