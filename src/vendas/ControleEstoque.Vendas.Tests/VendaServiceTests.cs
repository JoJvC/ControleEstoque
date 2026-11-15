using ControleEstoque.Shared.Results;
using ControleEstoque.Vendas.Domain;

namespace ControleEstoque.Vendas.Tests;

public sealed class VendaServiceTests
{
    private readonly FakeVendaRepository vendas;
    private readonly FakeVendaLookup lookup = new();
    private readonly FakeCupomFiscalRepository cupons = new();
    private readonly VendaService sut;

    private readonly Guid clienteId = Guid.NewGuid();
    private readonly Guid funcionarioId = Guid.NewGuid();
    private readonly TipoCascoVenda cascoG;   // genérico do produto: vasilhame 30, aceita sucata
    private readonly TipoCascoVenda cascoE;   // específico da marca Y: vasilhame 40, não aceita sucata
    private readonly ProdutoVenda agua;       // marca X: sem casco próprio, usa o genérico G
    private readonly ProdutoVenda aguaY;      // marca Y: o específico E vence o genérico
    private readonly ProdutoVenda descartavel;

    public VendaServiceTests()
    {
        vendas = new FakeVendaRepository(lookup.SaldosEstoque);
        sut = new VendaService(vendas, lookup, cupons);
        lookup.Clientes.Add(clienteId);
        lookup.Funcionarios.Add(funcionarioId);
        cascoG = lookup.AddTipoCasco(30m, aceitaSucata: true);
        cascoE = lookup.AddTipoCasco(40m, aceitaSucata: false);
        agua = lookup.AddProduto(TipoProduto.RETORNAVEL, "Água Marca X 20L", 20, cascoG.Id);
        aguaY = lookup.AddProduto(TipoProduto.RETORNAVEL, "Água Marca Y 20L", 20, cascoG.Id, cascoE.Id);
        descartavel = lookup.AddProduto(TipoProduto.DESCARTAVEL, "Carvão 5kg", 30);
    }

    [Fact]
    public async Task CriarAsync_QuandoTroca_EmprestaNoTipoResolvido()
    {
        await sut.CriarAsync(NovaVendaDe(agua, 5, 50m), CancellationToken.None);

        var g = vendas.UltimaGravacao!;
        Assert.Equal([new CascoQuantidade(cascoG.Id, 5)], g.CascosEmprestados);
        var item = Assert.Single(g.Itens);
        Assert.Equal(agua.ProdutoMarcaId, item.ProdutoMarcaId);
        Assert.Equal(cascoG.Id, item.TipoCascoId);
        Assert.False(item.PagouVasilhame);
        Assert.Null(item.PrecoVasilhame);
    }

    [Fact]
    public async Task CriarAsync_QuandoPagouVasilhame_SomaVasilhameAoBrutoESemEmprestimo()
    {
        await sut.CriarAsync(NovaVendaDe(agua, 2, 12m, pagouVasilhame: true), CancellationToken.None);

        var g = vendas.UltimaGravacao!;
        Assert.Equal(84m, g.TotalBruto); // 2 × 12 + 2 × 30
        Assert.Equal(84m, g.TotalLiquido);
        Assert.Empty(g.CascosEmprestados);
        var item = Assert.Single(g.Itens);
        Assert.True(item.PagouVasilhame);
        Assert.Equal(cascoG.Id, item.TipoCascoId);
        Assert.Equal(30m, item.PrecoVasilhame);
    }

    [Fact]
    public async Task CriarAsync_QuandoPagouVasilhameComDesconto_AplicaSobreOBrutoComVasilhame()
    {
        var desconto = new Desconto(TipoDesconto.PERCENTUAL, 10m, "promoção");
        var venda = NovaVendaDe(agua, 2, 12m) with
        {
            Itens = [new ItemVenda(agua.ProdutoId, agua.MarcaId, 2, 12m, desconto, true)]
        };

        await sut.CriarAsync(venda, CancellationToken.None);

        var item = vendas.UltimaGravacao!.Itens[0];
        Assert.Equal(84m, item.TotalBruto);
        Assert.Equal(8.40m, item.ValorDesconto);
        Assert.Equal(75.60m, item.TotalItem);
    }

    [Fact]
    public async Task CriarAsync_QuandoTrocaEPagouVasilhameNaMesmaVenda_EmprestaSoATroca()
    {
        var venda = NovaVendaDe(agua, 5, 50m) with
        {
            Itens =
            [
                new ItemVenda(agua.ProdutoId, agua.MarcaId, 5, 50m, null),
                new ItemVenda(agua.ProdutoId, agua.MarcaId, 2, 50m, null, true),
                new ItemVenda(aguaY.ProdutoId, aguaY.MarcaId, 1, 50m, null),
            ]
        };

        await sut.CriarAsync(venda, CancellationToken.None);

        Assert.Equal(
            [new CascoQuantidade(cascoG.Id, 5), new CascoQuantidade(cascoE.Id, 1)],
            vendas.UltimaGravacao!.CascosEmprestados);
    }

    [Fact]
    public async Task CriarAsync_QuandoCascoEspecificoDaMarca_VenceOGenerico()
    {
        await sut.CriarAsync(NovaVendaDe(aguaY, 2, 50m), CancellationToken.None);

        var g = vendas.UltimaGravacao!;
        Assert.Equal([new CascoQuantidade(cascoE.Id, 2)], g.CascosEmprestados);
        Assert.Equal(cascoE.Id, g.Itens[0].TipoCascoId);
    }

    [Fact]
    public async Task CriarAsync_QuandoDevolucaoParcial_GravaDevolucaoNoTipoEFicaSaldo()
    {
        var resultado = await sut.CriarAsync(
            NovaVendaDe(agua, 5, 50m, devolvidos: [new CascoQuantidade(cascoG.Id, 3)]),
            CancellationToken.None);

        var g = vendas.UltimaGravacao!;
        Assert.Equal([new CascoQuantidade(cascoG.Id, 5)], g.CascosEmprestados);
        Assert.Equal([new CascoQuantidade(cascoG.Id, 3)], g.CascosDevolvidos);
        Assert.Empty(g.SucataEntregue);
        Assert.Equal(2, resultado.SaldoCascoCliente);
    }

    [Fact]
    public async Task CriarAsync_QuandoDevolucaoTotal_ZeraOSaldo()
    {
        var resultado = await sut.CriarAsync(
            NovaVendaDe(agua, 5, 50m, devolvidos: [new CascoQuantidade(cascoG.Id, 5)]),
            CancellationToken.None);

        Assert.Equal([new CascoQuantidade(cascoG.Id, 5)], vendas.UltimaGravacao!.CascosDevolvidos);
        Assert.Equal(0, resultado.SaldoCascoCliente);
        Assert.Empty(resultado.SaldoCascoClientePorTipo);
    }

    [Fact]
    public async Task CriarAsync_QuandoDevolveMaisQueOVendido_ViraCredito()
    {
        var resultado = await sut.CriarAsync(
            NovaVendaDe(agua, 5, 50m, devolvidos: [new CascoQuantidade(cascoG.Id, 7)]),
            CancellationToken.None);

        var saldo = Assert.Single(resultado.SaldoCascoClientePorTipo);
        Assert.Equal(cascoG.Id, saldo.TipoCascoId);
        Assert.Equal(-2, saldo.Saldo);
        Assert.Equal(-2, resultado.SaldoCascoCliente);
    }

    [Fact]
    public async Task CriarAsync_QuandoDevolucoesDoMesmoTipo_SomaPorTipo()
    {
        await sut.CriarAsync(
            NovaVendaDe(agua, 5, 50m, devolvidos: [new CascoQuantidade(cascoG.Id, 2), new CascoQuantidade(cascoG.Id, 1)]),
            CancellationToken.None);

        Assert.Equal([new CascoQuantidade(cascoG.Id, 3)], vendas.UltimaGravacao!.CascosDevolvidos);
    }

    [Fact]
    public async Task CriarAsync_QuandoSucataEmTipoQueAceita_GravaSucataDoTipoSemMexerNosCascos()
    {
        await sut.CriarAsync(
            NovaVendaDe(agua, 2, 50m, sucata: [new CascoQuantidade(cascoG.Id, 1)]), CancellationToken.None);

        var g = vendas.UltimaGravacao!;
        Assert.Equal([new CascoQuantidade(cascoG.Id, 1)], g.SucataEntregue);
        Assert.Equal([new CascoQuantidade(cascoG.Id, 2)], g.CascosEmprestados);
        Assert.Empty(g.CascosDevolvidos); // sucata não conta como devolução
    }

    [Fact]
    public async Task CriarAsync_QuandoSucataEmTipoQueNaoAceita_LancaSucataNaoAceitaENaoGrava()
    {
        var e = await Assert.ThrowsAsync<BusinessRuleException>(() => sut.CriarAsync(
            NovaVendaDe(aguaY, 1, 50m, sucata: [new CascoQuantidade(cascoE.Id, 1)]), CancellationToken.None));

        Assert.Equal("SUCATA_NAO_ACEITA", e.Code);
        Assert.Null(vendas.UltimaGravacao);
    }

    [Fact]
    public async Task CriarAsync_QuandoDevolucaoEmTipoForaDaVenda_LancaTipoCascoForaDaVenda()
    {
        // O específico E só entra na venda com uma linha da marca Y.
        var e = await Assert.ThrowsAsync<BusinessRuleException>(() => sut.CriarAsync(
            NovaVendaDe(agua, 1, 50m, devolvidos: [new CascoQuantidade(cascoE.Id, 1)]), CancellationToken.None));

        Assert.Equal("TIPO_CASCO_FORA_DA_VENDA", e.Code);
        Assert.Null(vendas.UltimaGravacao);
    }

    [Fact]
    public async Task CriarAsync_QuandoSucataEmTipoForaDaVenda_LancaTipoCascoForaDaVenda()
    {
        var e = await Assert.ThrowsAsync<BusinessRuleException>(() => sut.CriarAsync(
            NovaVendaDe(agua, 1, 50m, sucata: [new CascoQuantidade(cascoE.Id, 1)]), CancellationToken.None));

        Assert.Equal("TIPO_CASCO_FORA_DA_VENDA", e.Code);
        Assert.Null(vendas.UltimaGravacao);
    }

    [Fact]
    public async Task CriarAsync_QuandoDevolucaoEmVendaSoDeDescartavel_LancaTipoCascoForaDaVenda()
    {
        var e = await Assert.ThrowsAsync<BusinessRuleException>(() => sut.CriarAsync(
            NovaVendaDe(descartavel, 1, 8m, devolvidos: [new CascoQuantidade(cascoG.Id, 1)]),
            CancellationToken.None));

        Assert.Equal("TIPO_CASCO_FORA_DA_VENDA", e.Code);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public async Task CriarAsync_QuandoQuantidadeNasListasNaoPositiva_LancaQuantidadeInvalida(int quantidade)
    {
        var devolucao = await Assert.ThrowsAsync<RequestValidationException>(() => sut.CriarAsync(
            NovaVendaDe(agua, 1, 50m, devolvidos: [new CascoQuantidade(cascoG.Id, quantidade)]),
            CancellationToken.None));
        var sucata = await Assert.ThrowsAsync<RequestValidationException>(() => sut.CriarAsync(
            NovaVendaDe(agua, 1, 50m, sucata: [new CascoQuantidade(cascoG.Id, quantidade)]),
            CancellationToken.None));

        Assert.Equal("QUANTIDADE_INVALIDA", devolucao.Code);
        Assert.Equal("QUANTIDADE_INVALIDA", sucata.Code);
        Assert.Null(vendas.UltimaGravacao);
    }

    [Fact]
    public async Task CriarAsync_QuandoPagamentoParcial_GeraDebitoFiado()
    {
        await sut.CriarAsync(
            NovaVendaDe(agua, 5, 50m, pagamentos: [new PagamentoVenda(FormaPagamento.PIX, 200m)]),
            CancellationToken.None);

        Assert.Equal(50m, vendas.UltimaGravacao!.DebitoFiado);
        Assert.Equal(StatusPagamento.PARCIAL, vendas.UltimaGravacao.Status);
    }

    [Fact]
    public async Task CriarAsync_QuandoEstoqueInsuficiente_LancaInsufficientStock()
    {
        lookup.SaldosEstoque[agua.ProdutoMarcaId] = 3;

        var e = await Assert.ThrowsAsync<InsufficientStockException>(
            () => sut.CriarAsync(NovaVendaDe(agua, 5, 50m), CancellationToken.None));

        Assert.Contains("Água Marca X 20L", e.Message);
    }

    [Fact]
    public async Task CriarAsync_EstoqueEPorMarca_OutraMarcaComSaldoNaoCobre()
    {
        lookup.SaldosEstoque[agua.ProdutoMarcaId] = 3; // a marca Y tem 20, mas a venda é da marca X

        await Assert.ThrowsAsync<InsufficientStockException>(
            () => sut.CriarAsync(NovaVendaDe(agua, 5, 50m), CancellationToken.None));
    }

    [Fact]
    public async Task CriarAsync_QuandoParProdutoMarcaNaoExiste_LancaProdutoMarcaNaoEncontrado()
    {
        var marcaSemAssociacao = NovaVendaDe(agua, 1, 50m) with
        {
            Itens = [new ItemVenda(agua.ProdutoId, Guid.NewGuid(), 1, 50m, null)]
        };
        var paresCruzados = NovaVendaDe(agua, 1, 50m) with
        {
            Itens = [new ItemVenda(agua.ProdutoId, aguaY.MarcaId, 1, 50m, null)]
        };

        foreach (var venda in new[] { marcaSemAssociacao, paresCruzados })
        {
            var e = await Assert.ThrowsAsync<EntityNotFoundException>(
                () => sut.CriarAsync(venda, CancellationToken.None));
            Assert.Equal("PRODUTO_MARCA_NAO_ENCONTRADO", e.Code);
        }

        Assert.Null(vendas.UltimaGravacao);
    }

    [Fact]
    public async Task CriarAsync_QuandoClienteNaoExiste_LancaNotFound()
    {
        var venda = NovaVendaDe(agua, 1, 50m) with { ClienteId = Guid.NewGuid() };

        var e = await Assert.ThrowsAsync<EntityNotFoundException>(
            () => sut.CriarAsync(venda, CancellationToken.None));

        Assert.Equal("CLIENTE_NAO_ENCONTRADO", e.Code);
    }

    [Fact]
    public async Task CriarAsync_QuandoEnderecoDeOutroCliente_LancaBusinessRule()
    {
        var enderecoId = Guid.NewGuid();
        lookup.EnderecosPorCliente[enderecoId] = Guid.NewGuid(); // pertence a outro cliente
        var venda = NovaVendaDe(agua, 1, 50m) with { EnderecoEntregaId = enderecoId };

        var e = await Assert.ThrowsAsync<BusinessRuleException>(
            () => sut.CriarAsync(venda, CancellationToken.None));

        Assert.Equal("ENDERECO_NAO_PERTENCE_AO_CLIENTE", e.Code);
    }

    [Fact]
    public async Task CriarAsync_QuandoDescartavel_NaoMovimentaCasco()
    {
        await sut.CriarAsync(NovaVendaDe(descartavel, 10, 8m), CancellationToken.None);

        var g = vendas.UltimaGravacao!;
        Assert.Empty(g.CascosEmprestados);
        Assert.Empty(g.CascosDevolvidos);
        Assert.Empty(g.SucataEntregue);
        Assert.Null(g.Itens[0].TipoCascoId);
    }

    [Fact]
    public async Task CriarAsync_QuandoPagouVasilhameEmDescartavel_LancaVasilhameEmDescartavelENaoGrava()
    {
        var e = await Assert.ThrowsAsync<BusinessRuleException>(() => sut.CriarAsync(
            NovaVendaDe(descartavel, 1, 8m, pagouVasilhame: true), CancellationToken.None));

        Assert.Equal("VASILHAME_EM_DESCARTAVEL", e.Code);
        Assert.Null(vendas.UltimaGravacao);
    }

    [Fact]
    public async Task EditarAsync_QuandoCupomJaEmitido_LancaVendaJaFaturada()
    {
        var criada = await sut.CriarAsync(NovaVendaDe(agua, 1, 50m), CancellationToken.None);
        cupons.Emitidos.Add(criada.Id);

        var e = await Assert.ThrowsAsync<BusinessRuleException>(
            () => sut.EditarAsync(criada.Id, NovaVendaDe(agua, 2, 50m), CancellationToken.None));

        Assert.Equal("VENDA_JA_FATURADA", e.Code);
    }

    [Fact]
    public async Task EditarAsync_QuandoPagouVasilhame_ReleOPrecoDoTipo()
    {
        var criada = await sut.CriarAsync(NovaVendaDe(agua, 2, 12m, pagouVasilhame: true), CancellationToken.None);
        Assert.Equal(30m, vendas.UltimaGravacao!.Itens[0].PrecoVasilhame);
        lookup.TiposCasco[cascoG.Id] = cascoG with { PrecoVasilhame = 35m };

        await sut.EditarAsync(criada.Id, NovaVendaDe(agua, 2, 12m, pagouVasilhame: true), CancellationToken.None);

        var item = vendas.UltimaEdicao!.Itens[0];
        Assert.Equal(35m, item.PrecoVasilhame);
        Assert.Equal(94m, item.TotalBruto); // 2 × 12 + 2 × 35
    }

    [Fact]
    public async Task EditarAsync_QuandoTrocaDevolucao_RecalculaSaldoPorTipo()
    {
        var criada = await sut.CriarAsync(NovaVendaDe(agua, 5, 50m), CancellationToken.None);
        Assert.Equal(5, criada.SaldoCascoCliente);

        var editada = await sut.EditarAsync(
            criada.Id,
            NovaVendaDe(agua, 5, 50m, devolvidos: [new CascoQuantidade(cascoG.Id, 3)]),
            CancellationToken.None);

        Assert.Equal(2, editada.SaldoCascoCliente); // o replay não soma o empréstimo duas vezes
    }

    [Fact]
    public async Task EditarAsync_QuandoVendaNaoExiste_LancaNotFound()
    {
        await Assert.ThrowsAsync<EntityNotFoundException>(
            () => sut.EditarAsync(Guid.NewGuid(), NovaVendaDe(agua, 1, 50m), CancellationToken.None));
    }

    [Fact]
    public async Task CriarAsync_QuandoUsaCredito_ContaComoPagoEGravaUsoCredito()
    {
        lookup.Creditos[clienteId] = 50m;

        var resultado = await sut.CriarAsync(
            NovaVendaDe(agua, 2, 40m, pagamentos:
                [new PagamentoVenda(FormaPagamento.CREDITO_CLIENTE, 50m), new PagamentoVenda(FormaPagamento.PIX, 30m)]),
            CancellationToken.None);

        Assert.Equal(StatusPagamento.PAGA, resultado.StatusPagamento);
        Assert.Equal(80m, resultado.TotalPago);
        Assert.Equal(0m, resultado.SaldoFiadoGerado);
        var g = vendas.UltimaGravacao!;
        Assert.Equal(50m, g.UsoCredito);
        Assert.Equal(0m, g.DebitoFiado);
    }

    [Fact]
    public async Task CriarAsync_QuandoSemCredito_UsoCreditoZeroENaoConsultaLimite()
    {
        await sut.CriarAsync(
            NovaVendaDe(agua, 1, 40m, pagamentos: [new PagamentoVenda(FormaPagamento.PIX, 40m)]),
            CancellationToken.None);

        Assert.Equal(0m, vendas.UltimaGravacao!.UsoCredito);
        Assert.Null(lookup.UltimaVendaIgnorada);
    }

    [Fact]
    public async Task CriarAsync_QuandoUsoAcimaDoCredito_LancaCreditoInsuficienteENaoGrava()
    {
        lookup.Creditos[clienteId] = 20m;

        var e = await Assert.ThrowsAsync<BusinessRuleException>(
            () => sut.CriarAsync(
                NovaVendaDe(agua, 1, 40m, pagamentos: [new PagamentoVenda(FormaPagamento.CREDITO_CLIENTE, 30m)]),
                CancellationToken.None));

        Assert.Equal("CREDITO_INSUFICIENTE", e.Code);
        Assert.Null(vendas.UltimaGravacao);
    }

    [Fact]
    public async Task CriarAsync_QuandoClienteEmFiado_CreditoDisponivelEZeroERecusaUso()
    {
        lookup.Creditos[clienteId] = -30m; // deve 30: sem crédito

        var e = await Assert.ThrowsAsync<BusinessRuleException>(
            () => sut.CriarAsync(
                NovaVendaDe(agua, 1, 40m, pagamentos: [new PagamentoVenda(FormaPagamento.CREDITO_CLIENTE, 1m)]),
                CancellationToken.None));

        Assert.Equal("CREDITO_INSUFICIENTE", e.Code);
    }

    [Fact]
    public async Task EditarAsync_QuandoUsoAnteriorDaPropriaVenda_NaoContaContraOLimite()
    {
        // Crédito 50 todo usado na venda: o saldo atual é 0, mas a edição ignora o uso da própria venda.
        lookup.Creditos[clienteId] = 50m;
        var criada = await sut.CriarAsync(
            NovaVendaDe(agua, 2, 40m, pagamentos:
                [new PagamentoVenda(FormaPagamento.CREDITO_CLIENTE, 50m), new PagamentoVenda(FormaPagamento.PIX, 30m)]),
            CancellationToken.None);
        lookup.Creditos[clienteId] = 0m;
        lookup.UsoCreditoPorVenda[criada.Id] = 50m;

        await sut.EditarAsync(
            criada.Id,
            NovaVendaDe(agua, 2, 40m, pagamentos:
                [new PagamentoVenda(FormaPagamento.CREDITO_CLIENTE, 50m), new PagamentoVenda(FormaPagamento.PIX, 30m)]),
            CancellationToken.None);

        Assert.Equal(criada.Id, lookup.UltimaVendaIgnorada);
        Assert.Equal(50m, vendas.UltimaEdicao!.UsoCredito);
    }

    [Fact]
    public async Task EditarAsync_QuandoUsoPassaDoCreditoMaisOUsoAnterior_LancaCreditoInsuficiente()
    {
        var criada = await sut.CriarAsync(NovaVendaDe(agua, 2, 40m), CancellationToken.None);
        lookup.Creditos[clienteId] = 20m;
        lookup.UsoCreditoPorVenda[criada.Id] = 10m; // disponível = 30

        var e = await Assert.ThrowsAsync<BusinessRuleException>(
            () => sut.EditarAsync(
                criada.Id,
                NovaVendaDe(agua, 2, 40m, pagamentos: [new PagamentoVenda(FormaPagamento.CREDITO_CLIENTE, 31m)]),
                CancellationToken.None));

        Assert.Equal("CREDITO_INSUFICIENTE", e.Code);
        Assert.Null(vendas.UltimaEdicao);
    }

    [Fact]
    public async Task AdicionarPagamentoAsync_QuandoCreditoCliente_LancaFormaNaoPermitida()
    {
        var criada = await sut.CriarAsync(
            NovaVendaDe(agua, 5, 50m, pagamentos: [new PagamentoVenda(FormaPagamento.PIX, 200m)]),
            CancellationToken.None);
        vendas.InfoPagamento = new InfoPagamentoVenda(250m, 200m, 50m, StatusPagamento.PARCIAL);

        var e = await Assert.ThrowsAsync<BusinessRuleException>(
            () => sut.AdicionarPagamentoAsync(
                criada.Id, FormaPagamento.CREDITO_CLIENTE, 10m, CancellationToken.None));

        Assert.Equal("FORMA_NAO_PERMITIDA", e.Code);
    }

    [Fact]
    public async Task AdicionarPagamentoAsync_QuandoExcedeSaldo_LancaPagamentoExcedeSaldo()
    {
        var criada = await sut.CriarAsync(
            NovaVendaDe(agua, 5, 50m, pagamentos: [new PagamentoVenda(FormaPagamento.PIX, 200m)]),
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
            NovaVendaDe(agua, 5, 50m, pagamentos: [new PagamentoVenda(FormaPagamento.PIX, 200m)]),
            CancellationToken.None);
        vendas.InfoPagamento = new InfoPagamentoVenda(250m, 200m, 50m, StatusPagamento.PARCIAL);

        var resultado = await sut.AdicionarPagamentoAsync(
            criada.Id, FormaPagamento.DINHEIRO, 50m, CancellationToken.None);

        Assert.Equal(StatusPagamento.PAGA, resultado.StatusPagamento);
        Assert.Equal((FormaPagamento.DINHEIRO, 50m), vendas.UltimoPagamento);
    }

    [Fact]
    public async Task AdicionarPagamentoAsync_QuandoRepositorioRecusaPorExcesso_LancaPagamentoExcedeSaldo()
    {
        // A pré-checagem passa (restam 50), mas outro pagamento esgota o saldo antes da trava da venda.
        var criada = await sut.CriarAsync(
            NovaVendaDe(agua, 5, 50m, pagamentos: [new PagamentoVenda(FormaPagamento.PIX, 200m)]),
            CancellationToken.None);
        vendas.InfoPagamento = new InfoPagamentoVenda(250m, 200m, 50m, StatusPagamento.PARCIAL);
        vendas.RecusarPagamentoPorExcesso = true;

        var e = await Assert.ThrowsAsync<BusinessRuleException>(
            () => sut.AdicionarPagamentoAsync(
                criada.Id, FormaPagamento.DINHEIRO, 50m, CancellationToken.None));

        Assert.Equal("PAGAMENTO_EXCEDE_SALDO", e.Code);
        Assert.Null(vendas.UltimoPagamento);
    }

    [Fact]
    public async Task AdicionarPagamentoAsync_QuandoCaixaFechado_LancaCaixaFechadoENaoGrava()
    {
        var criada = await sut.CriarAsync(
            NovaVendaDe(agua, 5, 50m, pagamentos: [new PagamentoVenda(FormaPagamento.PIX, 200m)]),
            CancellationToken.None);
        vendas.InfoPagamento = new InfoPagamentoVenda(250m, 200m, 50m, StatusPagamento.PARCIAL);
        vendas.CaixaHojeFechado = true;

        var e = await Assert.ThrowsAsync<ConflictException>(
            () => sut.AdicionarPagamentoAsync(
                criada.Id, FormaPagamento.DINHEIRO, 50m, CancellationToken.None));

        Assert.Equal("CAIXA_FECHADO", e.Code);
        Assert.Null(vendas.UltimoPagamento);
    }

    [Fact]
    public async Task CriarAsync_ComPagamentoEmCaixaFechado_LancaCaixaFechadoENaoGrava()
    {
        vendas.CaixaHojeFechado = true;

        var e = await Assert.ThrowsAsync<ConflictException>(
            () => sut.CriarAsync(
                NovaVendaDe(agua, 5, 50m, pagamentos: [new PagamentoVenda(FormaPagamento.PIX, 250m)]),
                CancellationToken.None));

        Assert.Equal("CAIXA_FECHADO", e.Code);
        Assert.Null(vendas.UltimaGravacao);
    }

    [Fact]
    public async Task CriarAsync_SemPagamentoEmCaixaFechado_Grava()
    {
        vendas.CaixaHojeFechado = true;

        var resultado = await sut.CriarAsync(NovaVendaDe(agua, 5, 50m), CancellationToken.None);

        Assert.NotNull(vendas.UltimaGravacao);
        Assert.Equal(StatusPagamento.PENDENTE, resultado.StatusPagamento);
    }

    [Fact]
    public async Task EditarAsync_ComPagamentoAtualEmCaixaFechado_LancaCaixaFechadoENaoGrava()
    {
        var criada = await sut.CriarAsync(
            NovaVendaDe(agua, 5, 50m, pagamentos: [new PagamentoVenda(FormaPagamento.PIX, 250m)]),
            CancellationToken.None);
        vendas.VendaTemPagamentoEmCaixaFechado = true;

        var e = await Assert.ThrowsAsync<ConflictException>(
            () => sut.EditarAsync(criada.Id, NovaVendaDe(agua, 4, 50m), CancellationToken.None));

        Assert.Equal("CAIXA_FECHADO", e.Code);
        Assert.Null(vendas.UltimaEdicao);
    }

    [Fact]
    public async Task EditarAsync_ReinserindoPagamentoComCaixaDeHojeFechado_LancaCaixaFechado()
    {
        var criada = await sut.CriarAsync(NovaVendaDe(agua, 5, 50m), CancellationToken.None);
        vendas.CaixaHojeFechado = true;

        var e = await Assert.ThrowsAsync<ConflictException>(
            () => sut.EditarAsync(
                criada.Id,
                NovaVendaDe(agua, 5, 50m, pagamentos: [new PagamentoVenda(FormaPagamento.PIX, 250m)]),
                CancellationToken.None));

        Assert.Equal("CAIXA_FECHADO", e.Code);
        Assert.Null(vendas.UltimaEdicao);
    }

    [Fact]
    public async Task EmitirCupomAsync_QuandoJaEmitido_LancaConflict()
    {
        var criada = await sut.CriarAsync(NovaVendaDe(agua, 1, 50m), CancellationToken.None);
        await sut.EmitirCupomAsync(criada.Id, CancellationToken.None);

        var e = await Assert.ThrowsAsync<ConflictException>(
            () => sut.EmitirCupomAsync(criada.Id, CancellationToken.None));

        Assert.Equal("CUPOM_JA_EMITIDO", e.Code);
    }

    [Fact]
    public async Task CriarAsync_QuandoSemSaldo_LancaInsufficientStockENaoGrava()
    {
        lookup.SaldosEstoque[agua.ProdutoMarcaId] = 0;

        await Assert.ThrowsAsync<InsufficientStockException>(
            () => sut.CriarAsync(NovaVendaDe(agua, 1, 50m), CancellationToken.None));

        Assert.Null(vendas.UltimaGravacao);
    }

    [Fact]
    public async Task CriarAsync_ConcorrenteComSaldo3_AceitaSo3De5()
    {
        lookup.SaldosEstoque[agua.ProdutoMarcaId] = 3;

        var resultados = await Task.WhenAll(Enumerable.Range(0, 5).Select(async _ =>
        {
            try
            {
                await sut.CriarAsync(NovaVendaDe(agua, 1, 50m), CancellationToken.None);
                return true;
            }
            catch (InsufficientStockException)
            {
                return false;
            }
        }));

        Assert.Equal(3, resultados.Count(sucesso => sucesso));
        Assert.Equal(0, lookup.SaldosEstoque[agua.ProdutoMarcaId]);
    }

    [Fact]
    public async Task CriarAsync_QuandoGravacaoAtomicaRecusa_LancaInsufficientStockMesmoComLeituraAlta()
    {
        lookup.SaldosEstoque[agua.ProdutoMarcaId] = 100; // leitura avulsa desatualizada: a gravação atômica é quem decide
        vendas.RecusarSempre = true;

        await Assert.ThrowsAsync<InsufficientStockException>(
            () => sut.CriarAsync(NovaVendaDe(agua, 1, 50m), CancellationToken.None));
    }

    [Fact]
    public async Task EditarAsync_QuandoMantemQuantidadeComSaldoZeradoPelaPropriaVenda_Aceita()
    {
        lookup.SaldosEstoque[agua.ProdutoMarcaId] = 4;
        var criada = await sut.CriarAsync(NovaVendaDe(agua, 4, 50m), CancellationToken.None);
        Assert.Equal(0, lookup.SaldosEstoque[agua.ProdutoMarcaId]);

        await sut.EditarAsync(criada.Id, NovaVendaDe(agua, 4, 50m), CancellationToken.None);

        Assert.NotNull(vendas.UltimaEdicao);
        Assert.Equal(0, lookup.SaldosEstoque[agua.ProdutoMarcaId]);
    }

    [Fact]
    public async Task CriarAsync_QuandoClienteIdVazio_LancaIdInvalido()
    {
        var venda = NovaVendaDe(agua, 1, 50m) with { ClienteId = Guid.Empty };

        var e = await Assert.ThrowsAsync<RequestValidationException>(
            () => sut.CriarAsync(venda, CancellationToken.None));

        Assert.Equal("ID_INVALIDO", e.Code);
    }

    [Fact]
    public async Task CriarAsync_QuandoFuncionarioIdVazio_LancaIdInvalido()
    {
        var venda = NovaVendaDe(agua, 1, 50m) with { FuncionarioId = Guid.Empty };

        var e = await Assert.ThrowsAsync<RequestValidationException>(
            () => sut.CriarAsync(venda, CancellationToken.None));

        Assert.Equal("ID_INVALIDO", e.Code);
    }

    [Fact]
    public async Task CriarAsync_QuandoProdutoIdDoItemVazio_LancaIdInvalido()
    {
        var e = await Assert.ThrowsAsync<RequestValidationException>(
            () => sut.CriarAsync(
                NovaVendaDe(agua, 1, 50m) with { Itens = [new ItemVenda(Guid.Empty, agua.MarcaId, 1, 50m, null)] },
                CancellationToken.None));

        Assert.Equal("ID_INVALIDO", e.Code);
    }

    [Fact]
    public async Task CriarAsync_QuandoMarcaIdDoItemVazio_LancaIdInvalido()
    {
        var e = await Assert.ThrowsAsync<RequestValidationException>(
            () => sut.CriarAsync(
                NovaVendaDe(agua, 1, 50m) with { Itens = [new ItemVenda(agua.ProdutoId, Guid.Empty, 1, 50m, null)] },
                CancellationToken.None));

        Assert.Equal("ID_INVALIDO", e.Code);
    }

    [Fact]
    public async Task AdicionarPagamentoAsync_QuandoFormaForaDaFaixa_LancaValorEnumInvalido()
    {
        var e = await Assert.ThrowsAsync<RequestValidationException>(
            () => sut.AdicionarPagamentoAsync(Guid.NewGuid(), (FormaPagamento)99, 10m, CancellationToken.None));

        Assert.Equal("VALOR_ENUM_INVALIDO", e.Code);
    }

    [Fact]
    public async Task ListarAsync_QuandoInicioDepoisDoFim_LancaPeriodoInvalido()
    {
        var e = await Assert.ThrowsAsync<RequestValidationException>(() => sut.ListarAsync(
            null, new DateOnly(2026, 2, 1), new DateOnly(2026, 1, 1), 1, 50, CancellationToken.None));

        Assert.Equal("PERIODO_INVALIDO", e.Code);
    }

    [Fact]
    public async Task ListarAsync_QuandoPeriodoValido_Lista()
    {
        var lista = await sut.ListarAsync(
            null, new DateOnly(2026, 1, 1), new DateOnly(2026, 1, 1), 1, 50, CancellationToken.None);

        Assert.Empty(lista);
    }

    private NovaVenda NovaVendaDe(
        ProdutoVenda produto,
        int quantidade,
        decimal preco,
        bool pagouVasilhame = false,
        IReadOnlyList<CascoQuantidade>? devolvidos = null,
        IReadOnlyList<CascoQuantidade>? sucata = null,
        IReadOnlyList<PagamentoVenda>? pagamentos = null) => new(
        clienteId, funcionarioId, null,
        [new ItemVenda(produto.ProdutoId, produto.MarcaId, quantidade, preco, null, pagouVasilhame)],
        pagamentos ?? [],
        devolvidos ?? [], sucata ?? [], null);
}
