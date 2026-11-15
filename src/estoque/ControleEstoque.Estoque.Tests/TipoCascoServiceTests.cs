using ControleEstoque.Estoque.Domain;
using ControleEstoque.Shared.Results;

namespace ControleEstoque.Estoque.Tests;

public sealed class TipoCascoServiceTests
{
    private readonly FakeTipoCascoRepository tiposCasco = new();
    private readonly FakeMarcaRepository marcas = new();
    private readonly TipoCascoService sut;

    public TipoCascoServiceTests() => sut = new TipoCascoService(tiposCasco, marcas);

    [Fact]
    public async Task CriarAsync_QuandoGenerico_CriaSemMarca()
    {
        var criado = await sut.CriarAsync(Novo("Galão 20L", null), CancellationToken.None);

        Assert.NotEqual(Guid.Empty, criado.Id);
        Assert.Null(criado.MarcaId);
        Assert.Equal(criado, Assert.Single(await sut.ListarAsync(CancellationToken.None)));
    }

    [Fact]
    public async Task CriarAsync_QuandoEspecificoComMarcaCadastrada_Cria()
    {
        var marca = marcas.Add("Marca A");

        var criado = await sut.CriarAsync(Novo("Galão 20L A", marca.Id), CancellationToken.None);

        Assert.Equal(marca.Id, criado.MarcaId);
    }

    [Fact]
    public async Task CriarAsync_QuandoMarcaInexistente_LancaMarcaInexistente()
    {
        var e = await Assert.ThrowsAsync<BusinessRuleException>(
            () => sut.CriarAsync(Novo("Galão 20L A", Guid.NewGuid()), CancellationToken.None));

        Assert.Equal("MARCA_INEXISTENTE", e.Code);
    }

    [Fact]
    public async Task CriarAsync_QuandoNomeEmBranco_LancaNomeObrigatorio()
    {
        var e = await Assert.ThrowsAsync<RequestValidationException>(
            () => sut.CriarAsync(Novo("  ", null), CancellationToken.None));

        Assert.Equal("NOME_OBRIGATORIO", e.Code);
    }

    [Fact]
    public async Task CriarAsync_QuandoPrecoVasilhameNegativo_LancaValorInvalido()
    {
        var e = await Assert.ThrowsAsync<RequestValidationException>(
            () => sut.CriarAsync(Novo("Galão 20L", null) with { PrecoVasilhame = -1m }, CancellationToken.None));

        Assert.Equal("VALOR_INVALIDO", e.Code);
    }

    [Fact]
    public async Task AtualizarAsync_QuandoNaoExiste_LancaNotFound()
    {
        var e = await Assert.ThrowsAsync<EntityNotFoundException>(
            () => sut.AtualizarAsync(Novo("Galão 20L", null) with { Id = Guid.NewGuid() }, CancellationToken.None));

        Assert.Equal("TIPO_CASCO_NAO_ENCONTRADO", e.Code);
    }

    [Fact]
    public async Task AtualizarAsync_QuandoExiste_TrocaPrecoEAceitaSucata()
    {
        var criado = await sut.CriarAsync(Novo("Galão 20L", null), CancellationToken.None);

        await sut.AtualizarAsync(criado with { PrecoVasilhame = 30m, AceitaSucata = true }, CancellationToken.None);

        var atual = Assert.Single(await sut.ListarAsync(CancellationToken.None));
        Assert.Equal(30m, atual.PrecoVasilhame);
        Assert.True(atual.AceitaSucata);
    }

    [Fact]
    public async Task AtualizarAsync_QuandoTrocaAMarcaDeTipoEmUso_LancaTipoCascoEmUso()
    {
        var marca = marcas.Add("Marca A");
        var generico = await sut.CriarAsync(Novo("Galão 20L", null), CancellationToken.None);
        tiposCasco.EmUso.Add(generico.Id);

        var e = await Assert.ThrowsAsync<BusinessRuleException>(
            () => sut.AtualizarAsync(generico with { MarcaId = marca.Id }, CancellationToken.None));

        Assert.Equal("TIPO_CASCO_EM_USO", e.Code);
        Assert.Null(Assert.Single(await sut.ListarAsync(CancellationToken.None)).MarcaId);
    }

    [Fact]
    public async Task AtualizarAsync_QuandoTrocaAMarcaDeTipoEspecificoEmUso_LancaTipoCascoEmUso()
    {
        var marcaA = marcas.Add("Marca A");
        var marcaB = marcas.Add("Marca B");
        var especifico = await sut.CriarAsync(Novo("Galão 20L A", marcaA.Id), CancellationToken.None);
        tiposCasco.EmUso.Add(especifico.Id);

        var e = await Assert.ThrowsAsync<BusinessRuleException>(
            () => sut.AtualizarAsync(especifico with { MarcaId = marcaB.Id }, CancellationToken.None));

        Assert.Equal("TIPO_CASCO_EM_USO", e.Code);
    }

    [Fact]
    public async Task AtualizarAsync_QuandoTrocaAMarcaDeTipoSemUso_Atualiza()
    {
        var marca = marcas.Add("Marca A");
        var generico = await sut.CriarAsync(Novo("Galão 20L", null), CancellationToken.None);

        var atualizado = await sut.AtualizarAsync(generico with { MarcaId = marca.Id }, CancellationToken.None);

        Assert.Equal(marca.Id, atualizado.MarcaId);
    }

    [Fact]
    public async Task AtualizarAsync_QuandoMantemAMarcaDeTipoEmUso_AtualizaNomePrecoESucata()
    {
        var generico = await sut.CriarAsync(Novo("Galão 20L", null), CancellationToken.None);
        tiposCasco.EmUso.Add(generico.Id);

        var atualizado = await sut.AtualizarAsync(
            generico with { Nome = "Galão 20L v2", PrecoVasilhame = 40m, AceitaSucata = true }, CancellationToken.None);

        Assert.Equal("Galão 20L v2", atualizado.Nome);
        Assert.True(atualizado.AceitaSucata);
    }

    [Fact]
    public async Task AtualizarAsync_QuandoDeixaDeAceitarSucataComSaldo_LancaTipoCascoEmUso()
    {
        var criado = await sut.CriarAsync(Novo("Galão 20L", null) with { AceitaSucata = true }, CancellationToken.None);
        tiposCasco.SaldosSucata[criado.Id] = 3;

        var e = await Assert.ThrowsAsync<BusinessRuleException>(
            () => sut.AtualizarAsync(criado with { AceitaSucata = false }, CancellationToken.None));

        Assert.Equal("TIPO_CASCO_EM_USO", e.Code);
        Assert.True(Assert.Single(await sut.ListarAsync(CancellationToken.None)).AceitaSucata);
    }

    [Fact]
    public async Task AtualizarAsync_QuandoDeixaDeAceitarSucataSemSaldo_Atualiza()
    {
        var criado = await sut.CriarAsync(Novo("Galão 20L", null) with { AceitaSucata = true }, CancellationToken.None);

        var atualizado = await sut.AtualizarAsync(criado with { AceitaSucata = false }, CancellationToken.None);

        Assert.False(atualizado.AceitaSucata);
    }

    private static TipoCasco Novo(string nome, Guid? marcaId) => new(Guid.Empty, nome, marcaId, null, 0m, false);
}
