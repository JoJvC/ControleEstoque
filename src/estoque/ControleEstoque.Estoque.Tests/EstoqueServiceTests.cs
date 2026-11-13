using ControleEstoque.Estoque.Domain;
using ControleEstoque.Shared.Results;

namespace ControleEstoque.Estoque.Tests;

public sealed class EstoqueServiceTests
{
    private readonly FakeProdutoRepository produtos = new();
    private readonly FakeEstoqueRepository estoque = new();
    private readonly FakeBaixaCascoRepository baixas;
    private readonly EstoqueService sut;

    private readonly Produto casco;
    private readonly Produto sucata;

    public EstoqueServiceTests()
    {
        baixas = new FakeBaixaCascoRepository(estoque);
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
    public async Task BaixarCascoAsync_QuandoResponsavelIdVazio_LancaIdInvalido()
    {
        var baixa = new NovaBaixaCasco(2, "quebrou", [Guid.NewGuid(), Guid.Empty]);

        var e = await Assert.ThrowsAsync<RequestValidationException>(
            () => sut.BaixarCascoAsync(baixa, CancellationToken.None));

        Assert.Equal("ID_INVALIDO", e.Code);
    }

    [Fact]
    public async Task AjustarAsync_QuandoProdutoIdVazio_LancaIdInvalido()
    {
        var e = await Assert.ThrowsAsync<RequestValidationException>(
            () => sut.AjustarAsync(Guid.Empty, 1, null, CancellationToken.None));

        Assert.Equal("ID_INVALIDO", e.Code);
    }

    [Fact]
    public async Task AjustarAsync_QuandoProdutoValido_Ajusta()
    {
        await sut.AjustarAsync(casco.Id, 3, null, CancellationToken.None);

        Assert.Equal(3, estoque.GetSaldo(casco.Id));
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

    [Fact]
    public async Task AjustarAsync_QuandoNegativoAlemDoSaldo_LancaInsufficientStockESaldoNaoMuda()
    {
        estoque.SetSaldo(casco.Id, 2);

        await Assert.ThrowsAsync<InsufficientStockException>(
            () => sut.AjustarAsync(casco.Id, -3, null, CancellationToken.None));

        Assert.Equal(2, estoque.GetSaldo(casco.Id));
    }

    [Fact]
    public async Task AjustarAsync_QuandoNegativoDentroDoSaldo_Grava()
    {
        estoque.SetSaldo(casco.Id, 5);

        await sut.AjustarAsync(casco.Id, -5, null, CancellationToken.None);

        Assert.Equal(0, estoque.GetSaldo(casco.Id));
    }

    [Fact]
    public async Task AjustarAsync_ConcorrenteComSaldo5_AceitaSo5De10()
    {
        estoque.SetSaldo(casco.Id, 5);

        var resultados = await Task.WhenAll(Enumerable.Range(0, 10).Select(_ => TentarAsync(
            () => sut.AjustarAsync(casco.Id, -1, null, CancellationToken.None))));

        Assert.Equal(5, resultados.Count(sucesso => sucesso));
        Assert.Equal(5, resultados.Count(sucesso => !sucesso));
        Assert.Equal(0, estoque.GetSaldo(casco.Id));
    }

    [Fact]
    public async Task BaixarCascoAsync_ConcorrenteComSaldo5_AceitaSo5De10()
    {
        estoque.SetSaldo(casco.Id, 5);
        var baixa = new NovaBaixaCasco(1, null, [Guid.NewGuid()]);

        var resultados = await Task.WhenAll(Enumerable.Range(0, 10).Select(_ => TentarAsync(
            () => sut.BaixarCascoAsync(baixa, CancellationToken.None))));

        Assert.Equal(5, resultados.Count(sucesso => sucesso));
        Assert.Equal(5, resultados.Count(sucesso => !sucesso));
        Assert.Equal(0, estoque.GetSaldo(casco.Id));
        Assert.Equal(5, estoque.GetSaldo(sucata.Id));
    }

    [Fact]
    public async Task AjustarEBaixar_QuandoGravacaoAtomicaRecusa_LancamInsufficientStockMesmoComLeituraAlta()
    {
        estoque.SetSaldo(casco.Id, 100); // leitura avulsa desatualizada: a gravação atômica é quem decide
        estoque.RecusarSempre = true;

        await Assert.ThrowsAsync<InsufficientStockException>(
            () => sut.AjustarAsync(casco.Id, -1, null, CancellationToken.None));
        await Assert.ThrowsAsync<InsufficientStockException>(
            () => sut.BaixarCascoAsync(new NovaBaixaCasco(1, null, [Guid.NewGuid()]), CancellationToken.None));
        Assert.Null(baixas.UltimaBaixa);
    }

    private static async Task<bool> TentarAsync(Func<Task> acao)
    {
        try
        {
            await acao();
            return true;
        }
        catch (InsufficientStockException)
        {
            return false;
        }
    }

    private static Produto CreateProduto(TipoProduto tipo, string nome) => new(
        Guid.NewGuid(), tipo, nome, null, null, null, null, null, 0m, 0);
}
