using ControleEstoque.Shared.Results;
using ControleEstoque.Vendas.Domain;

namespace ControleEstoque.Vendas.Tests;

/// <summary>Lacunas de VendaService: pagamento inválido, ObterAsync, cupom fiscal e totais da gravação.</summary>
public sealed class VendaServiceLacunasTests
{
    private readonly FakeVendaRepository vendas;
    private readonly FakeVendaLookup lookup = new();
    private readonly FakeCupomFiscalRepository cupons = new();
    private readonly VendaService sut;

    private readonly Guid clienteId = Guid.NewGuid();
    private readonly Guid funcionarioId = Guid.NewGuid();
    private readonly ProdutoVenda agua;
    private readonly ProdutoVenda galaoCompleto;
    private readonly ProdutoVenda descartavel;

    public VendaServiceLacunasTests()
    {
        vendas = new FakeVendaRepository(lookup.SaldosEstoque);
        sut = new VendaService(vendas, lookup, cupons);
        lookup.Clientes.Add(clienteId);
        lookup.Funcionarios.Add(funcionarioId);
        agua = lookup.AddProduto(TipoProduto.AGUA, "Água Marca A 20L", 20);
        galaoCompleto = lookup.AddProduto(TipoProduto.GALAO_COMPLETO, "Galão Completo A", 10);
        descartavel = lookup.AddProduto(TipoProduto.DESCARTAVEL, "Carvão 5kg", 30);
        lookup.AddProduto(TipoProduto.CASCO, "Casco vazio", 10);
        lookup.AddProduto(TipoProduto.SUCATA, "Galão sucata", 2);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-10)]
    public async Task AdicionarPagamentoAsync_QuandoValorNaoPositivo_LancaPagamentoInvalidoENaoGrava(int valor)
    {
        var criada = await sut.CriarAsync(NovaVendaDe(agua.Id, 1, 50m), CancellationToken.None);
        vendas.InfoPagamento = new InfoPagamentoVenda(50m, 0m, 50m, StatusPagamento.PENDENTE);

        var e = await Assert.ThrowsAsync<RequestValidationException>(
            () => sut.AdicionarPagamentoAsync(criada.Id, FormaPagamento.PIX, valor, CancellationToken.None));

        Assert.Equal("PAGAMENTO_INVALIDO", e.Code);
        Assert.Null(vendas.UltimoPagamento);
    }

    [Fact]
    public async Task ObterAsync_QuandoVendaExiste_DevolveVendaComMesmoId()
    {
        var criada = await sut.CriarAsync(NovaVendaDe(agua.Id, 1, 50m), CancellationToken.None);

        var venda = await sut.ObterAsync(criada.Id, CancellationToken.None);

        Assert.Equal(criada.Id, venda.Id);
    }

    [Fact]
    public async Task ObterAsync_QuandoVendaInexistente_LancaVendaNaoEncontrada()
    {
        var e = await Assert.ThrowsAsync<EntityNotFoundException>(
            () => sut.ObterAsync(Guid.NewGuid(), CancellationToken.None));

        Assert.Equal("VENDA_NAO_ENCONTRADA", e.Code);
    }

    [Fact]
    public async Task EmitirCupomAsync_QuandoVendaInexistente_LancaVendaNaoEncontrada()
    {
        var e = await Assert.ThrowsAsync<EntityNotFoundException>(
            () => sut.EmitirCupomAsync(Guid.NewGuid(), CancellationToken.None));

        Assert.Equal("VENDA_NAO_ENCONTRADA", e.Code);
        Assert.Empty(cupons.Emitidos);
    }

    [Fact]
    public async Task EmitirCupomAsync_QuandoVendaExiste_GravaCupomEDevolveNumero()
    {
        var criada = await sut.CriarAsync(NovaVendaDe(agua.Id, 1, 50m), CancellationToken.None);

        var cupom = await sut.EmitirCupomAsync(criada.Id, CancellationToken.None);

        Assert.Contains(criada.Id, cupons.Emitidos);
        Assert.Equal("CF-00000001", cupom.Numero);
    }

    [Fact]
    public async Task CriarAsync_VendaComVariosItens_GravaTotaisCascosEFiado()
    {
        // água 3 x 10 (desconto VALOR 5) = 25 | descartável 2 x 15 (desconto 10%) = 27 | galão completo 1 x 20 = 20
        var itens = new List<ItemVenda>
        {
            new(agua.Id, 3, 10m, new Desconto(TipoDesconto.VALOR, 5m, "cliente antigo")),
            new(descartavel.Id, 2, 15m, new Desconto(TipoDesconto.PERCENTUAL, 10m, "promoção")),
            new(galaoCompleto.Id, 1, 20m, null),
        };
        var venda = new NovaVenda(
            clienteId, funcionarioId, null, itens,
            [new PagamentoVenda(FormaPagamento.DINHEIRO, 30m)],
            0, true, 0, null);

        var resultado = await sut.CriarAsync(venda, CancellationToken.None);

        var g = vendas.UltimaGravacao!;
        Assert.Equal(80m, g.TotalBruto);
        Assert.Equal(8m, g.TotalDesconto);
        Assert.Equal(72m, g.TotalLiquido);
        Assert.Equal(StatusPagamento.PARCIAL, g.Status);
        Assert.Equal(3, g.CascosEmprestados); // só a água empresta casco
        Assert.Equal(3, g.CascosDevolvidos);  // devolvidos na hora = água vendida
        Assert.Equal(42m, g.DebitoFiado);     // 72 - 30 pago

        Assert.Equal(72m, resultado.TotalLiquido);
        Assert.Equal(42m, resultado.SaldoFiadoGerado);
        Assert.Equal(30m, resultado.TotalPago);
    }

    private NovaVenda NovaVendaDe(Guid produtoId, int quantidade, decimal preco) => new(
        clienteId, funcionarioId, null,
        [new ItemVenda(produtoId, quantidade, preco, null)],
        [], 0, false, 0, null);
}
