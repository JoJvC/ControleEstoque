using ControleEstoque.Estoque.Domain;
using ControleEstoque.Shared.Results;

namespace ControleEstoque.Estoque.Tests;

public sealed class AbastecimentoServiceTests
{
    private readonly FakeProdutoRepository produtos = new();
    private readonly FakeAbastecimentoRepository abastecimentos = new();
    private readonly AbastecimentoService sut;
    private readonly Produto produto = new(
        Guid.NewGuid(), TipoProduto.AGUA, "Água 20L", null, null, null, "20L", null, 10m, 0);

    public AbastecimentoServiceTests()
    {
        sut = new AbastecimentoService(abastecimentos, produtos);
        produtos.Add(produto);
    }

    [Fact]
    public async Task RegistrarAsync_QuandoTipoFreteForaDaFaixa_LancaValorEnumInvalido()
    {
        var e = await Assert.ThrowsAsync<RequestValidationException>(
            () => sut.RegistrarAsync(Novo(frete: (TipoFrete)99), CancellationToken.None));

        Assert.Equal("VALOR_ENUM_INVALIDO", e.Code);
    }

    [Fact]
    public async Task RegistrarAsync_QuandoFuncionarioIdVazio_LancaIdInvalido()
    {
        var e = await Assert.ThrowsAsync<RequestValidationException>(
            () => sut.RegistrarAsync(Novo(funcionarioId: Guid.Empty), CancellationToken.None));

        Assert.Equal("ID_INVALIDO", e.Code);
    }

    [Fact]
    public async Task RegistrarAsync_QuandoProdutoIdVazio_LancaIdInvalido()
    {
        var e = await Assert.ThrowsAsync<RequestValidationException>(
            () => sut.RegistrarAsync(Novo(new AbastecimentoItem(Guid.Empty, 1, 1m)), CancellationToken.None));

        Assert.Equal("ID_INVALIDO", e.Code);
    }

    [Fact]
    public async Task RegistrarAsync_QuandoCustoUnitarioNegativo_LancaValorInvalido()
    {
        var e = await Assert.ThrowsAsync<RequestValidationException>(
            () => sut.RegistrarAsync(Novo(new AbastecimentoItem(produto.Id, 1, -1m)), CancellationToken.None));

        Assert.Equal("VALOR_INVALIDO", e.Code);
    }

    [Fact]
    public async Task RegistrarAsync_QuandoEntradaValida_Registra()
    {
        var id = await sut.RegistrarAsync(Novo(), CancellationToken.None);

        Assert.NotEqual(Guid.Empty, id);
    }

    private NovoAbastecimento Novo(
        AbastecimentoItem? item = null, TipoFrete frete = default, Guid? funcionarioId = null) => new(
        frete, 10m, funcionarioId, null, [item ?? new AbastecimentoItem(produto.Id, 1, 2m)]);

    private sealed class FakeAbastecimentoRepository : IAbastecimentoRepository
    {
        public Task<Guid> CreateAsync(NovoAbastecimento abastecimento, CancellationToken cancellationToken) =>
            Task.FromResult(Guid.NewGuid());
    }
}
