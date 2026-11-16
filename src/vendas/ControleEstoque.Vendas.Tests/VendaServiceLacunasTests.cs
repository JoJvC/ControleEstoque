using ControleEstoque.Shared.Results;
using ControleEstoque.Vendas.Contracts;
using ControleEstoque.Vendas.Domain;

namespace ControleEstoque.Vendas.Tests;

/// <summary>Lacunas de VendaService: pagamento inválido, ObterAsync, cupom fiscal e totais da gravação.</summary>
public sealed class VendaServiceLacunasTests
{
    private readonly FakeVendaRepository vendas;
    private readonly FakeVendaLookup lookup = new();
    private readonly FakeCupomFiscalRepository cupons = new();
    private readonly FakePedidoRepository pedidos;
    private readonly VendaService sut;

    private readonly Guid clienteId = Guid.NewGuid();
    private readonly Guid funcionarioId = Guid.NewGuid();
    private readonly TipoCascoVenda cascoG;   // genérico: vasilhame 30, aceita sucata
    private readonly ProdutoVenda agua;
    private readonly ProdutoVenda descartavel;

    public VendaServiceLacunasTests()
    {
        vendas = new FakeVendaRepository(lookup.SaldosEstoque);
        pedidos = new FakePedidoRepository(lookup.SaldosEstoque, vendas.Reservas);
        vendas.Pedidos = pedidos;
        sut = new VendaService(vendas, lookup, cupons, new FakePermissaoLookup(), pedidos);
        lookup.Clientes.Add(clienteId);
        lookup.Funcionarios.Add(funcionarioId);
        cascoG = lookup.AddTipoCasco(30m, aceitaSucata: true);
        agua = lookup.AddProduto(TipoProduto.RETORNAVEL, "Água Marca A 20L", 20, cascoG.Id);
        descartavel = lookup.AddProduto(TipoProduto.DESCARTAVEL, "Carvão 5kg", 30);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-10)]
    public async Task AdicionarPagamentoAsync_QuandoValorNaoPositivo_LancaPagamentoInvalidoENaoGrava(int valor)
    {
        var criada = await sut.CriarAsync(NovaVendaDe(agua, 1, 50m), CancellationToken.None);
        vendas.InfoPagamento = new InfoPagamentoVenda(50m, 0m, 50m, StatusPagamento.PENDENTE);

        var e = await Assert.ThrowsAsync<RequestValidationException>(
            () => sut.AdicionarPagamentoAsync(criada.Id, FormaPagamento.PIX, valor, CancellationToken.None));

        Assert.Equal("PAGAMENTO_INVALIDO", e.Code);
        Assert.Null(vendas.UltimoPagamento);
    }

    [Fact]
    public async Task ObterAsync_QuandoVendaExiste_DevolveVendaComMesmoId()
    {
        var criada = await sut.CriarAsync(NovaVendaDe(agua, 1, 50m), CancellationToken.None);

        var venda = await sut.ObterAsync(criada.Id, CancellationToken.None);

        Assert.Equal(criada.Id, venda.Id);
    }

    [Fact]
    public async Task ObterAsync_QuandoVendaTemCascosESucata_DevolveAsListasPorTipo()
    {
        var nova = NovaVendaDe(agua, 1, 50m) with
        {
            CascosDevolvidos = [new CascoQuantidade(cascoG.Id, 2)],
            SucataEntregue = [new SucataVenda(cascoG.Id, 1, 2m)]
        };
        var criada = await sut.CriarAsync(nova, CancellationToken.None);

        var venda = await sut.ObterAsync(criada.Id, CancellationToken.None);
        var resposta = VendaDetalheResponse.From(venda);

        Assert.Equal([new CascoQuantidade(cascoG.Id, 2)], venda.CascosDevolvidos);
        Assert.Equal([new SucataVenda(cascoG.Id, 1, 2m)], venda.SucataEntregue);
        Assert.Equal([new CascoQuantidadeResponse(cascoG.Id, 2)], resposta.CascosDevolvidos);
        Assert.Equal([new SucataEntregueResponse(cascoG.Id, 1, 2m)], resposta.SucataEntregue);
    }

    [Fact]
    public async Task ObterAsync_QuandoVendaTemVasilhame_DevolveItemComCascoELista()
    {
        var nova = NovaVendaDe(agua, 2, 12m) with
        {
            Vasilhames = [new VasilhameVenda(cascoG.Id, 1, 15m, ModoCreditoVasilhame.COMPRAR)]
        };
        var criada = await sut.CriarAsync(nova, CancellationToken.None);

        var resposta = VendaDetalheResponse.From(await sut.ObterAsync(criada.Id, CancellationToken.None));

        var item = Assert.Single(resposta.Itens);
        Assert.Equal(agua.ProdutoId, item.ProdutoId);
        Assert.Equal(agua.MarcaId, item.MarcaId);
        Assert.Equal(cascoG.Id, item.TipoCascoId);
        Assert.Equal(
            [new VasilhameResponse(cascoG.Id, 1, 0, 15m, ModoCreditoVasilhame.COMPRAR, 15m)], resposta.Vasilhames);
    }

    [Fact]
    public async Task ObterAsync_QuandoItemDescartavel_SemCascoNemVasilhame()
    {
        var criada = await sut.CriarAsync(NovaVendaDe(descartavel, 1, 8m), CancellationToken.None);

        var item = Assert.Single(
            VendaDetalheResponse.From(await sut.ObterAsync(criada.Id, CancellationToken.None)).Itens);

        Assert.Equal(descartavel.MarcaId, item.MarcaId);
        Assert.Null(item.TipoCascoId);
    }

    [Fact]
    public async Task VendaResponseFrom_SaldoCascoClienteEASomaDaListaPorTipo()
    {
        var outroTipo = lookup.AddTipoCasco(40m, aceitaSucata: false);
        var resultado = new ResultadoVenda(
            Guid.NewGuid(), 0m, 0m, 0m, 0m, 0m, 0m, 0m, StatusPagamento.PENDENTE,
            [new SaldoCascoTipo(cascoG.Id, "Genérico", 5), new SaldoCascoTipo(outroTipo.Id, "Específico", -2)]);

        var resposta = VendaResponse.From(resultado);

        Assert.Equal(3, resposta.SaldoCascoCliente);
        Assert.Equal(resposta.SaldoCascoCliente, resposta.SaldoCascoClientePorTipo.Sum(s => s.Saldo));
        Assert.Equal(
            [new CascoPorTipoResponse(cascoG.Id, "Genérico", 5), new CascoPorTipoResponse(outroTipo.Id, "Específico", -2)],
            resposta.SaldoCascoClientePorTipo);
    }

    [Fact]
    public async Task ObterAsync_QuandoVendaSemLancamento_ListasDeCascosESucataVazias()
    {
        var criada = await sut.CriarAsync(NovaVendaDe(agua, 1, 50m), CancellationToken.None);

        var resposta = VendaDetalheResponse.From(await sut.ObterAsync(criada.Id, CancellationToken.None));

        Assert.Empty(resposta.CascosDevolvidos);
        Assert.Empty(resposta.SucataEntregue);
    }

    [Fact]
    public void VendaDetalheResponseFrom_LevaCascosESucataDoDominio()
    {
        var venda = new Venda(Guid.NewGuid(), clienteId, funcionarioId, null, DateTimeOffset.UtcNow,
            0m, 0m, 0m, StatusPagamento.PENDENTE, null, false, [], [],
            [new CascoQuantidade(cascoG.Id, 3)], [new SucataVenda(cascoG.Id, 4, 1.5m)], []);

        var resposta = VendaDetalheResponse.From(venda);

        Assert.Equal([new CascoQuantidadeResponse(cascoG.Id, 3)], resposta.CascosDevolvidos);
        Assert.Equal([new SucataEntregueResponse(cascoG.Id, 4, 1.5m)], resposta.SucataEntregue);
    }

    [Fact]
    public void VendaDetalheResponseFrom_ComCupom_LevaNumeroEData()
    {
        var emitidoEm = DateTimeOffset.UtcNow;
        var venda = new Venda(Guid.NewGuid(), clienteId, funcionarioId, null, DateTimeOffset.UtcNow,
            0m, 0m, 0m, StatusPagamento.PENDENTE, null, true, [], [], [], [], [], "CF-00000007", emitidoEm);

        var resposta = VendaDetalheResponse.From(venda);

        Assert.True(resposta.CupomEmitido);
        Assert.Equal("CF-00000007", resposta.CupomNumero);
        Assert.Equal(emitidoEm, resposta.CupomEmitidoEm);
    }

    [Fact]
    public void VendaDetalheResponseFrom_SemCupom_NumeroEDataNulos()
    {
        var venda = new Venda(Guid.NewGuid(), clienteId, funcionarioId, null, DateTimeOffset.UtcNow,
            0m, 0m, 0m, StatusPagamento.PENDENTE, null, false, [], [], [], [], []);

        var resposta = VendaDetalheResponse.From(venda);

        Assert.False(resposta.CupomEmitido);
        Assert.Null(resposta.CupomNumero);
        Assert.Null(resposta.CupomEmitidoEm);
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
        var criada = await sut.CriarAsync(NovaVendaDe(agua, 1, 50m), CancellationToken.None);

        var cupom = await sut.EmitirCupomAsync(criada.Id, CancellationToken.None);

        Assert.Contains(criada.Id, cupons.Emitidos);
        Assert.Equal("CF-00000001", cupom.Numero);
    }

    [Fact]
    public async Task CriarAsync_VendaComVariosItens_GravaTotaisCascosEFiado()
    {
        // água 3 x 10 (desconto VALOR 5) = 25 | descartável 2 x 15 (desconto 10%) = 27
        // água 1 x 20 = 20 | vasilhame comprado: 1 x 30
        var itens = new List<ItemVenda>
        {
            new(agua.ProdutoId, agua.MarcaId, 3, 10m, new Desconto(TipoDesconto.VALOR, 5m, "cliente antigo")),
            new(descartavel.ProdutoId, descartavel.MarcaId, 2, 15m,
                new Desconto(TipoDesconto.PERCENTUAL, 10m, "promoção")),
            new(agua.ProdutoId, agua.MarcaId, 1, 20m, null),
        };
        var venda = new NovaVenda(
            clienteId, funcionarioId, null, itens,
            [new VasilhameVenda(cascoG.Id, 1, 30m, ModoCreditoVasilhame.COMPRAR)],
            [new PagamentoVenda(FormaPagamento.DINHEIRO, 30m)],
            [new CascoQuantidade(cascoG.Id, 3)], [], null);

        var resultado = await sut.CriarAsync(venda, CancellationToken.None);

        var g = vendas.UltimaGravacao!;
        Assert.Equal(110m, g.TotalBruto);
        Assert.Equal(8m, g.TotalDesconto);
        Assert.Equal(102m, g.TotalLiquido);
        Assert.Equal(StatusPagamento.PARCIAL, g.Status);
        Assert.Equal([new CascoQuantidade(cascoG.Id, 3)], g.CascosEmprestados); // 4 galões - 1 vasilhame comprado
        Assert.Equal([new CascoQuantidade(cascoG.Id, 3)], g.CascosDevolvidos);  // devolvidos informados (3)
        Assert.Equal(72m, g.DebitoFiado);     // 102 - 30 pago

        Assert.Equal(102m, resultado.TotalLiquido);
        Assert.Equal(72m, resultado.SaldoFiadoGerado);
        Assert.Equal(30m, resultado.TotalPago);
        Assert.Equal(0, resultado.SaldoCascoCliente);
    }

    private NovaVenda NovaVendaDe(
        ProdutoVenda produto, int quantidade, decimal preco) => new(
        clienteId, funcionarioId, null,
        [new ItemVenda(produto.ProdutoId, produto.MarcaId, quantidade, preco, null)],
        [], [], [], [], null);
}
