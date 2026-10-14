using ControleEstoque.Estoque.Domain;
using ControleEstoque.Shared.Results;

namespace ControleEstoque.Estoque.Tests;

public sealed class EstoqueServiceTests
{
    private readonly FakeProdutoRepository produtos = new();
    private readonly FakeEstoqueRepository estoque = new();
    private readonly FakeBaixaCascoRepository baixas = new();
    private readonly EstoqueService sut;

    private readonly Produto casco;
    private readonly Produto sucata;

    public EstoqueServiceTests()
    {
        sut = new EstoqueService(estoque, produtos, baixas);
        casco = CreateProduto(TipoProduto.CASCO, "Casco vazio 20L");
        sucata = CreateProduto(TipoProduto.SUCATA, "Galão sucata");
        produtos.Add(casco);
        produtos.Add(sucata);
    }

    [Fact]
    public async Task BaixarCascoAsync_QuandoSemResponsavel_LancaValidacao()
    {
        var baixa = new NovaBaixaCasco(2, "quebrou", []);

        var e = await Assert.ThrowsAsync<RequestValidationException>(
            () => sut.BaixarCascoAsync(baixa, CancellationToken.None));

        Assert.Equal("RESPONSAVEL_OBRIGATORIO", e.Code);
    }

    [Fact]
    public async Task BaixarCascoAsync_QuandoSaldoInsuficiente_LancaInsufficientStock()
    {
        estoque.SetSaldo(casco.Id, 1);
        var baixa = new NovaBaixaCasco(5, null, [Guid.NewGuid()]);

        await Assert.ThrowsAsync<InsufficientStockException>(
            () => sut.BaixarCascoAsync(baixa, CancellationToken.None));
    }

    [Fact]
    public async Task BaixarCascoAsync_QuandoValida_RegistraBaixa()
    {
        estoque.SetSaldo(casco.Id, 10);
        var baixa = new NovaBaixaCasco(3, "queda", [Guid.NewGuid()]);

        var id = await sut.BaixarCascoAsync(baixa, CancellationToken.None);

        Assert.NotEqual(Guid.Empty, id);
        Assert.Equal(baixa, baixas.UltimaBaixa);
    }

    [Fact]
    public async Task AjustarAsync_QuandoQuantidadeZero_LancaValidacao()
    {
        var e = await Assert.ThrowsAsync<RequestValidationException>(
            () => sut.AjustarAsync(casco.Id, 0, null, CancellationToken.None));

        Assert.Equal("QUANTIDADE_INVALIDA", e.Code);
    }

    [Fact]
    public async Task AjustarAsync_QuandoProdutoNaoExiste_LancaNotFound()
    {
        await Assert.ThrowsAsync<EntityNotFoundException>(
            () => sut.AjustarAsync(Guid.NewGuid(), 5, null, CancellationToken.None));
    }

    private static Produto CreateProduto(TipoProduto tipo, string nome) => new(
        Guid.NewGuid(), tipo, nome, null, null, null, null, null, 0m, 0);
}
