using ControleEstoque.Shared.Results;
using ControleEstoque.Vendas.Domain;

namespace ControleEstoque.Vendas.Tests;

public sealed class VendaServiceTests
{
    private readonly FakeVendaRepository vendas = new();
    private readonly FakeVendaLookup lookup = new();
    private readonly FakeCupomFiscalRepository cupons = new();
    private readonly VendaService sut;

    private readonly Guid clienteId = Guid.NewGuid();
    private readonly Guid funcionarioId = Guid.NewGuid();
    private readonly ProdutoVenda agua;
    private readonly ProdutoVenda galaoCompleto;
    private readonly ProdutoVenda descartavel;

    public VendaServiceTests()
    {
        sut = new VendaService(vendas, lookup, cupons);
        lookup.Clientes.Add(clienteId);
        lookup.Funcionarios.Add(funcionarioId);
        agua = lookup.AddProduto(TipoProduto.AGUA, "Água Marca A 20L", 20);
        galaoCompleto = lookup.AddProduto(TipoProduto.GALAO_COMPLETO, "Galão Completo A", 10);
        descartavel = lookup.AddProduto(TipoProduto.DESCARTAVEL, "Carvão 5kg", 30);
        lookup.AddProduto(TipoProduto.CASCO, "Casco vazio", 10);
        lookup.AddProduto(TipoProduto.SUCATA, "Galão sucata", 2);
    }

    [Fact]
    public async Task CriarAsync_QuandoVendaDeAgua_EmprestaCascoNaQuantidadeVendida()
    {
        await sut.CriarAsync(NovaVendaDe(agua.Id, 5, 50m, cascosDevolvidos: 3), CancellationToken.None);

        Assert.NotNull(vendas.UltimaGravacao);
        Assert.Equal(5, vendas.UltimaGravacao.CascosEmprestados);
        Assert.Equal(3, vendas.UltimaGravacao.CascosDevolvidos);
    }

    [Fact]
    public async Task CriarAsync_QuandoGalaoCompleto_NaoEmprestaCasco()
    {
        // Regra crítica 1: galão completo é propriedade do cliente — sem débito.
        await sut.CriarAsync(NovaVendaDe(galaoCompleto.Id, 4, 80m), CancellationToken.None);

        Assert.Equal(0, vendas.UltimaGravacao!.CascosEmprestados);
    }

    [Fact]
    public async Task CriarAsync_QuandoCascosDevolvidosNaHora_IgualaDevolvidosAoVendido()
    {
        await sut.CriarAsync(
            NovaVendaDe(agua.Id, 7, 50m, cascosDevolvidos: 0, devolvidosNaHora: true),
            CancellationToken.None);

        Assert.Equal(7, vendas.UltimaGravacao!.CascosDevolvidos);
    }

    [Fact]
    public async Task CriarAsync_QuandoSucataEntregue_NaoAlteraCascos()
    {
        await sut.CriarAsync(NovaVendaDe(agua.Id, 2, 50m, sucataEntregue: 3), CancellationToken.None);

        Assert.Equal(3, vendas.UltimaGravacao!.SucataEntregue);
        Assert.Equal(2, vendas.UltimaGravacao.CascosEmprestados);
        Assert.Equal(0, vendas.UltimaGravacao.CascosDevolvidos); // sucata não conta como devolução
    }

    [Fact]
    public async Task CriarAsync_QuandoPagamentoParcial_GeraDebitoFiado()
    {
        await sut.CriarAsync(
            NovaVendaDe(agua.Id, 5, 50m, pagamentos: [new PagamentoVenda(FormaPagamento.PIX, 200m)]),
            CancellationToken.None);

        Assert.Equal(50m, vendas.UltimaGravacao!.DebitoFiado);
        Assert.Equal(StatusPagamento.PARCIAL, vendas.UltimaGravacao.Status);
    }

    [Fact]
    public async Task CriarAsync_QuandoEstoqueInsuficiente_LancaInsufficientStock()
    {
        lookup.SaldosEstoque[agua.Id] = 3;

        await Assert.ThrowsAsync<InsufficientStockException>(
            () => sut.CriarAsync(NovaVendaDe(agua.Id, 5, 50m), CancellationToken.None));
    }

    [Fact]
    public async Task CriarAsync_QuandoClienteNaoExiste_LancaNotFound()
    {
        var venda = NovaVendaDe(agua.Id, 1, 50m) with { ClienteId = Guid.NewGuid() };

        var e = await Assert.ThrowsAsync<EntityNotFoundException>(
            () => sut.CriarAsync(venda, CancellationToken.None));

        Assert.Equal("CLIENTE_NAO_ENCONTRADO", e.Code);
    }

    [Fact]
    public async Task CriarAsync_QuandoEnderecoDeOutroCliente_LancaBusinessRule()
    {
        var enderecoId = Guid.NewGuid();
        lookup.EnderecosPorCliente[enderecoId] = Guid.NewGuid(); // pertence a outro cliente
        var venda = NovaVendaDe(agua.Id, 1, 50m) with { EnderecoEntregaId = enderecoId };

        var e = await Assert.ThrowsAsync<BusinessRuleException>(
            () => sut.CriarAsync(venda, CancellationToken.None));

        Assert.Equal("ENDERECO_NAO_PERTENCE_AO_CLIENTE", e.Code);
    }

    [Fact]
    public async Task CriarAsync_QuandoDescartavel_NaoMovimentaCasco()
    {
        await sut.CriarAsync(NovaVendaDe(descartavel.Id, 10, 8m), CancellationToken.None);

        Assert.Equal(0, vendas.UltimaGravacao!.CascosEmprestados);
        Assert.Equal(0, vendas.UltimaGravacao.SucataEntregue);
    }

    [Fact]
    public async Task EditarAsync_QuandoCupomJaEmitido_LancaVendaJaFaturada()
    {
        var criada = await sut.CriarAsync(NovaVendaDe(agua.Id, 1, 50m), CancellationToken.None);
        cupons.Emitidos.Add(criada.Id);

        var e = await Assert.ThrowsAsync<BusinessRuleException>(
            () => sut.EditarAsync(criada.Id, NovaVendaDe(agua.Id, 2, 50m), CancellationToken.None));

        Assert.Equal("VENDA_JA_FATURADA", e.Code);
    }

    [Fact]
    public async Task EditarAsync_QuandoVendaNaoExiste_LancaNotFound()
    {
        await Assert.ThrowsAsync<EntityNotFoundException>(
            () => sut.EditarAsync(Guid.NewGuid(), NovaVendaDe(agua.Id, 1, 50m), CancellationToken.None));
    }

    [Fact]
    public async Task AdicionarPagamentoAsync_QuandoExcedeSaldo_LancaPagamentoExcedeSaldo()
    {
        var criada = await sut.CriarAsync(
            NovaVendaDe(agua.Id, 5, 50m, pagamentos: [new PagamentoVenda(FormaPagamento.PIX, 200m)]),
            CancellationToken.None);
        vendas.InfoPagamento = new InfoPagamentoVenda(250m, 200m, 50m, StatusPagamento.PARCIAL);

        var e = await Assert.ThrowsAsync<BusinessRuleException>(
            () => sut.AdicionarPagamentoAsync(
                criada.Id, FormaPagamento.DINHEIRO, 100m, CancellationToken.None));

        Assert.Equal("PAGAMENTO_EXCEDE_SALDO", e.Code);
    }

    [Fact]
    public async Task AdicionarPagamentoAsync_QuandoQuitaVenda_AbateFiadoEMarcaPaga()
    {
        var criada = await sut.CriarAsync(
            NovaVendaDe(agua.Id, 5, 50m, pagamentos: [new PagamentoVenda(FormaPagamento.PIX, 200m)]),
            CancellationToken.None);
        vendas.InfoPagamento = new InfoPagamentoVenda(250m, 200m, 50m, StatusPagamento.PARCIAL);

        var resultado = await sut.AdicionarPagamentoAsync(
            criada.Id, FormaPagamento.DINHEIRO, 50m, CancellationToken.None);

        Assert.Equal(StatusPagamento.PAGA, resultado.StatusPagamento);
        Assert.Equal(50m, vendas.UltimoPagamento!.Value.Abatimento);
    }

    [Fact]
    public async Task EmitirCupomAsync_QuandoJaEmitido_LancaConflict()
    {
        var criada = await sut.CriarAsync(NovaVendaDe(agua.Id, 1, 50m), CancellationToken.None);
        await sut.EmitirCupomAsync(criada.Id, CancellationToken.None);

        var e = await Assert.ThrowsAsync<ConflictException>(
            () => sut.EmitirCupomAsync(criada.Id, CancellationToken.None));

        Assert.Equal("CUPOM_JA_EMITIDO", e.Code);
    }

    private NovaVenda NovaVendaDe(
        Guid produtoId,
        int quantidade,
        decimal preco,
        int cascosDevolvidos = 0,
        bool devolvidosNaHora = false,
        int sucataEntregue = 0,
        IReadOnlyList<PagamentoVenda>? pagamentos = null) => new(
        clienteId, funcionarioId, null,
        [new ItemVenda(produtoId, quantidade, preco, null)],
        pagamentos ?? [],
        cascosDevolvidos, devolvidosNaHora, sucataEntregue, null);
}
