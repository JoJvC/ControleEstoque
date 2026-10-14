using ControleEstoque.Estoque.Domain;
using ControleEstoque.Shared.Results;

namespace ControleEstoque.Estoque.Tests;

public sealed class ProdutoServiceTests
{
    private readonly FakeProdutoRepository produtos = new();
    private readonly FakeMarcaRepository marcas = new();
    private readonly ProdutoService sut;

    public ProdutoServiceTests() => sut = new ProdutoService(produtos, marcas, new FakeFotoStorage());

    [Fact]
    public async Task CriarAsync_QuandoAguaSemMarca_LancaMarcaObrigatoria()
    {
        var produto = CreateProduto(TipoProduto.AGUA, marcaId: null);

        var e = await Assert.ThrowsAsync<RequestValidationException>(
            () => sut.CriarAsync(produto, CancellationToken.None));

        Assert.Equal("MARCA_OBRIGATORIA", e.Code);
    }

    [Fact]
    public async Task CriarAsync_QuandoDescartavelSemMarca_Cria()
    {
        // Carvão, gelo etc. entram como DESCARTAVEL sem marca.
        var produto = CreateProduto(TipoProduto.DESCARTAVEL, marcaId: null) with { Nome = "Carvão 5kg" };

        var criado = await sut.CriarAsync(produto, CancellationToken.None);

        Assert.NotEqual(Guid.Empty, criado.Id);
        Assert.Equal("Carvão 5kg", criado.Nome);
    }

    [Fact]
    public async Task CriarAsync_QuandoMarcaInexistente_LancaMarcaInexistente()
    {
        var produto = CreateProduto(TipoProduto.AGUA, marcaId: Guid.NewGuid());

        var e = await Assert.ThrowsAsync<BusinessRuleException>(
            () => sut.CriarAsync(produto, CancellationToken.None));

        Assert.Equal("MARCA_INEXISTENTE", e.Code);
    }

    [Fact]
    public async Task CriarAsync_QuandoAguaComMarcaValida_Cria()
    {
        var marca = marcas.Add("Marca A");
        var produto = CreateProduto(TipoProduto.AGUA, marca.Id);

        var criado = await sut.CriarAsync(produto, CancellationToken.None);

        Assert.Equal(marca.Id, criado.MarcaId);
    }

    [Fact]
    public async Task AtualizarAsync_QuandoProdutoNaoExiste_LancaNotFound()
    {
        var produto = CreateProduto(TipoProduto.DESCARTAVEL, null) with { Id = Guid.NewGuid() };

        await Assert.ThrowsAsync<EntityNotFoundException>(
            () => sut.AtualizarAsync(produto, CancellationToken.None));
    }

    private static Produto CreateProduto(TipoProduto tipo, Guid? marcaId) => new(
        Guid.Empty, tipo, "Produto Teste", marcaId, null, null, "20L", null, 50m, 5);
}
