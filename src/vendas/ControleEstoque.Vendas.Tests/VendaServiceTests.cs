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
        sut = new VendaService(vendas, lookup, cupons, new FakePermissaoLookup());
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
        Assert.Empty(g.Vasilhames);
    }

    private VasilhameVenda Converter(int quantidade, decimal preco = 12.5m) =>
        new(cascoG.Id, quantidade, preco, ModoCreditoVasilhame.CONVERTER_CASCO);

    [Fact]
    public async Task CriarAsync_ConverterCasco_BaixaOCascoCobraPrecoEditadoEViraFiadoPendente()
    {
        lookup.SaldosCasco[(clienteId, cascoG.Id)] = 3;

        await sut.CriarAsync(NovaVendaSoVasilhame([Converter(2)]), CancellationToken.None);

        var g = vendas.UltimaGravacao!;
        Assert.Equal([new CascoQuantidade(cascoG.Id, 2)], g.CascosConvertidos);
        Assert.Equal(25m, g.TotalLiquido); // 2 x 12,50, não o preço do tipo (30)
        Assert.Equal(StatusPagamento.PENDENTE, g.Status);
        Assert.Equal(25m, g.DebitoFiado);
        Assert.Empty(g.VaziosSaidos);
    }

    [Fact]
    public async Task CriarAsync_ConverterCasco_AcimaDoSaldo_LancaConversaoMaiorQueSaldo()
    {
        lookup.SaldosCasco[(clienteId, cascoG.Id)] = 3;

        var e = await Assert.ThrowsAsync<BusinessRuleException>(
            () => sut.CriarAsync(NovaVendaSoVasilhame([Converter(4)]), CancellationToken.None));

        Assert.Equal("CONVERSAO_MAIOR_QUE_SALDO", e.Code);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-2)]
    public async Task CriarAsync_ConverterCasco_ComSaldoZeroOuNegativo_Recusa(long saldo)
    {
        lookup.SaldosCasco[(clienteId, cascoG.Id)] = saldo;

        var e = await Assert.ThrowsAsync<BusinessRuleException>(
            () => sut.CriarAsync(NovaVendaSoVasilhame([Converter(1)]), CancellationToken.None));

        Assert.Equal("CONVERSAO_MAIOR_QUE_SALDO", e.Code);
    }

    [Fact]
    public async Task CriarAsync_ConverterCasco_ComCheioRetornavelDoMesmoTipo_NaoGeraVaziosSaidos()
    {
        lookup.SaldosCasco[(clienteId, cascoG.Id)] = 3;
        var venda = NovaVendaDe(agua, 2, 40m) with { Vasilhames = [Converter(2)] };

        await sut.CriarAsync(venda, CancellationToken.None);

        var g = vendas.UltimaGravacao!;
        Assert.Empty(g.VaziosSaidos);
        Assert.Equal([new CascoQuantidade(cascoG.Id, 2)], g.CascosConvertidos);
    }

    [Fact]
    public async Task EditarAsync_ConverterCasco_IgnoraAPropriaVendaNoSaldo()
    {
        var vendaId = Guid.NewGuid();
        vendas.VendasExistentes.Add(vendaId);
        // Saldo atual 1 (já sem os 2 convertidos pela própria venda): converter 3 só vale se a venda for ignorada.
        lookup.SaldosCasco[(clienteId, cascoG.Id)] = 1;
        lookup.ConvertidoPorVenda[(vendaId, cascoG.Id)] = 2;

        await sut.EditarAsync(vendaId, NovaVendaSoVasilhame([Converter(3)]), CancellationToken.None);

        Assert.Equal(vendaId, lookup.UltimaVendaIgnoradaSaldoCasco);
        Assert.Equal([new CascoQuantidade(cascoG.Id, 3)], vendas.UltimaEdicao!.CascosConvertidos);
    }

    // Preço do vasilhame do tipo G nos exemplos da spec: R$ 15 (informado na venda).
    private static VasilhameVenda Vasilhame(TipoCascoVenda tipo, int quantidade, ModoCreditoVasilhame modo = ModoCreditoVasilhame.ABATER_CREDITO) =>
        new(tipo.Id, quantidade, 15m, modo);

    [Fact]
    public async Task CriarAsync_Exemplo1_CreditoCobreOsVasilhamesNoAbater_NaoCobraEAbateOCredito()
    {
        lookup.CreditosCasco[(clienteId, cascoG.Id)] = 2;

        await sut.CriarAsync(NovaVendaSoVasilhame([Vasilhame(cascoG, 2)]), CancellationToken.None);

        var g = vendas.UltimaGravacao!;
        var v = Assert.Single(g.Vasilhames);
        Assert.Equal(2, v.QuantidadeAbatida);
        Assert.Equal(0m, v.Total);
        Assert.Equal(0m, g.TotalLiquido);
        Assert.Empty(g.CascosEmprestados);
        Assert.Equal([new CascoQuantidade(cascoG.Id, 2)], g.VaziosSaidos);
    }

    [Fact]
    public async Task CriarAsync_Exemplo2_Comprar_CobraTudoESeguraOCredito()
    {
        lookup.CreditosCasco[(clienteId, cascoG.Id)] = 2;

        await sut.CriarAsync(
            NovaVendaSoVasilhame([Vasilhame(cascoG, 2, ModoCreditoVasilhame.COMPRAR)]), CancellationToken.None);

        var g = vendas.UltimaGravacao!;
        var v = Assert.Single(g.Vasilhames);
        Assert.Equal(0, v.QuantidadeAbatida);
        Assert.Equal(30m, v.Total);
        Assert.Equal(30m, g.TotalLiquido);
        Assert.Equal([new CascoQuantidade(cascoG.Id, 2)], g.VaziosSaidos);
    }

    [Fact]
    public async Task CriarAsync_Exemplo3_VasilhameMenorQueOsGaloes_EmprestaOResto()
    {
        var venda = NovaVendaDe(agua, 3, 12m) with { Vasilhames = [Vasilhame(cascoG, 2)] };

        await sut.CriarAsync(venda, CancellationToken.None);

        var g = vendas.UltimaGravacao!;
        Assert.Equal(66m, g.TotalBruto); // 3 × 12 + 2 × 15
        Assert.Equal([new CascoQuantidade(cascoG.Id, 1)], g.CascosEmprestados);
        Assert.Empty(g.VaziosSaidos);
        Assert.Equal(0, g.Vasilhames[0].QuantidadeAbatida);
    }

    [Fact]
    public async Task CriarAsync_Exemplo4_CreditoMenorQueOsVasilhames_AbateSoOCredito()
    {
        lookup.CreditosCasco[(clienteId, cascoG.Id)] = 1;

        await sut.CriarAsync(NovaVendaSoVasilhame([Vasilhame(cascoG, 3)]), CancellationToken.None);

        var g = vendas.UltimaGravacao!;
        var v = Assert.Single(g.Vasilhames);
        Assert.Equal(1, v.QuantidadeAbatida);
        Assert.Equal(30m, v.Total);
        Assert.Equal([new CascoQuantidade(cascoG.Id, 3)], g.VaziosSaidos);
    }

    [Fact]
    public async Task CriarAsync_Exemplo5_SucataComValor_ViraDescontoSemSucataDoCliente()
    {
        var venda = NovaVendaDe(agua, 1, 50m) with { SucataEntregue = [new SucataVenda(cascoG.Id, 2, 3m)] };

        var resultado = await sut.CriarAsync(venda, CancellationToken.None);

        var g = vendas.UltimaGravacao!;
        Assert.Equal([new SucataVenda(cascoG.Id, 2, 3m)], g.SucataEntregue); // vai para venda_sucatas + estoque de sucata
        Assert.Equal(6m, g.DescontoSucata);
        Assert.Equal(6m, g.TotalDesconto);
        Assert.Equal(44m, g.TotalLiquido);
        Assert.Equal(6m, resultado.DescontoSucata);
        Assert.Empty(g.CascosDevolvidos); // nada no ledger de casco do cliente
    }

    [Fact]
    public async Task CriarAsync_Exemplo6_PagamentoAcimaDoLiquido_SobraViraCredito()
    {
        var resultado = await sut.CriarAsync(
            NovaVendaDe(agua, 1, 50m, pagamentos: [new PagamentoVenda(FormaPagamento.DINHEIRO, 60m)]),
            CancellationToken.None);

        var g = vendas.UltimaGravacao!;
        Assert.Equal(StatusPagamento.PAGA, g.Status);
        Assert.Equal(10m, g.CreditoGerado);
        Assert.Equal(0m, g.DebitoFiado);
        Assert.Equal(10m, resultado.CreditoGerado);
        Assert.Equal(60m, resultado.TotalPago); // soma real dos pagamentos
        Assert.Equal(0m, resultado.SaldoFiadoGerado);
    }

    [Fact]
    public async Task CriarAsync_QuandoModoOmitidoNoComando_AbateComoPadrao()
    {
        // O padrão do request omitido é testado na API (VendasApiTests); aqui, o do enum (default = ABATER_CREDITO).
        lookup.CreditosCasco[(clienteId, cascoG.Id)] = 1;

        await sut.CriarAsync(
            NovaVendaSoVasilhame([new VasilhameVenda(cascoG.Id, 1, 15m, default)]), CancellationToken.None);

        Assert.Equal(1, vendas.UltimaGravacao!.Vasilhames[0].QuantidadeAbatida);
    }

    [Fact]
    public async Task CriarAsync_QuandoSoVasilhame_Aceita()
    {
        await sut.CriarAsync(NovaVendaSoVasilhame([Vasilhame(cascoG, 1)]), CancellationToken.None);

        Assert.Empty(vendas.UltimaGravacao!.Itens);
        Assert.Equal(15m, vendas.UltimaGravacao.TotalLiquido);
    }

    [Fact]
    public async Task CriarAsync_QuandoSemItensESemVasilhames_LancaItensObrigatorios()
    {
        var e = await Assert.ThrowsAsync<RequestValidationException>(
            () => sut.CriarAsync(NovaVendaSoVasilhame([]), CancellationToken.None));

        Assert.Equal("ITENS_OBRIGATORIOS", e.Code);
    }

    [Fact]
    public async Task CriarAsync_QuandoTipoRepetidoNosVasilhames_LancaTipoCascoDuplicado()
    {
        var e = await Assert.ThrowsAsync<RequestValidationException>(() => sut.CriarAsync(
            NovaVendaSoVasilhame([Vasilhame(cascoG, 1), Vasilhame(cascoG, 2, ModoCreditoVasilhame.COMPRAR)]),
            CancellationToken.None));

        Assert.Equal("TIPO_CASCO_DUPLICADO", e.Code);
        Assert.Null(vendas.UltimaGravacao);
    }

    [Fact]
    public async Task CriarAsync_QuandoVasilhameInvalido_LancaVasilhameInvalido()
    {
        var e = await Assert.ThrowsAsync<RequestValidationException>(() => sut.CriarAsync(
            NovaVendaSoVasilhame([new VasilhameVenda(cascoG.Id, 0, 15m, ModoCreditoVasilhame.COMPRAR)]),
            CancellationToken.None));

        Assert.Equal("VASILHAME_INVALIDO", e.Code);
    }

    [Fact]
    public async Task CriarAsync_QuandoSucataInvalida_LancaSucataInvalida()
    {
        var e = await Assert.ThrowsAsync<RequestValidationException>(() => sut.CriarAsync(
            NovaVendaDe(agua, 1, 50m) with { SucataEntregue = [new SucataVenda(cascoG.Id, 1, -1m)] },
            CancellationToken.None));

        Assert.Equal("SUCATA_INVALIDA", e.Code);
    }

    [Fact]
    public async Task CriarAsync_QuandoDescontoSucataPassaDoTotal_LancaDescontoSucataExcedeTotal()
    {
        var e = await Assert.ThrowsAsync<BusinessRuleException>(() => sut.CriarAsync(
            NovaVendaDe(agua, 1, 50m) with { SucataEntregue = [new SucataVenda(cascoG.Id, 1, 50.01m)] },
            CancellationToken.None));

        Assert.Equal("DESCONTO_SUCATA_EXCEDE_TOTAL", e.Code);
        Assert.Null(vendas.UltimaGravacao);
    }

    [Fact]
    public async Task CriarAsync_QuandoCreditoClientePassaDoLiquido_LancaCreditoExcedeTotal()
    {
        lookup.Creditos[clienteId] = 500m;

        var e = await Assert.ThrowsAsync<BusinessRuleException>(() => sut.CriarAsync(
            NovaVendaDe(agua, 1, 50m, pagamentos: [new PagamentoVenda(FormaPagamento.CREDITO_CLIENTE, 60m)]),
            CancellationToken.None));

        Assert.Equal("CREDITO_EXCEDE_TOTAL", e.Code);
    }

    [Fact]
    public async Task CriarAsync_QuandoSucataNoTipoDoVasilhame_AceitaComoTipoDaVenda()
    {
        var venda = NovaVendaSoVasilhame([Vasilhame(cascoG, 1)]) with
        {
            SucataEntregue = [new SucataVenda(cascoG.Id, 1, 2m)]
        };

        await sut.CriarAsync(venda, CancellationToken.None);

        Assert.Equal(13m, vendas.UltimaGravacao!.TotalLiquido);
    }

    [Fact]
    public async Task CriarAsync_QuandoTipoDoVasilhameNaoExiste_LancaTipoCascoNaoEncontrado()
    {
        var e = await Assert.ThrowsAsync<EntityNotFoundException>(() => sut.CriarAsync(
            NovaVendaSoVasilhame([new VasilhameVenda(Guid.NewGuid(), 1, 15m, ModoCreditoVasilhame.COMPRAR)]),
            CancellationToken.None));

        Assert.Equal("TIPO_CASCO_NAO_ENCONTRADO", e.Code);
    }

    [Fact]
    public async Task EditarAsync_CreditoDeGalaoIgnoraOsEfeitosDaPropriaVenda()
    {
        // Crédito 2 antes da venda; a venda abateu 2 (crédito atual 0). Na edição o abate da própria venda volta.
        lookup.CreditosCasco[(clienteId, cascoG.Id)] = 0;
        var criada = await sut.CriarAsync(NovaVendaSoVasilhame([Vasilhame(cascoG, 2)]), CancellationToken.None);
        lookup.AbatePorVenda[(criada.Id, cascoG.Id)] = 2;

        await sut.EditarAsync(criada.Id, NovaVendaSoVasilhame([Vasilhame(cascoG, 2)]), CancellationToken.None);

        Assert.Equal(criada.Id, lookup.UltimaVendaIgnoradaCasco);
        Assert.Equal(2, vendas.UltimaEdicao!.Vasilhames[0].QuantidadeAbatida);
        Assert.Equal(0m, vendas.UltimaEdicao.TotalLiquido);
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
            NovaVendaDe(agua, 2, 50m, sucata: [new SucataVenda(cascoG.Id, 1, 2m)]), CancellationToken.None);

        var g = vendas.UltimaGravacao!;
        Assert.Equal([new SucataVenda(cascoG.Id, 1, 2m)], g.SucataEntregue);
        Assert.Equal([new CascoQuantidade(cascoG.Id, 2)], g.CascosEmprestados);
        Assert.Empty(g.CascosDevolvidos); // sucata não conta como devolução
    }

    [Fact]
    public async Task CriarAsync_QuandoSucataEmTipoQueNaoAceita_LancaSucataNaoAceitaENaoGrava()
    {
        var e = await Assert.ThrowsAsync<BusinessRuleException>(() => sut.CriarAsync(
            NovaVendaDe(aguaY, 1, 50m, sucata: [new SucataVenda(cascoE.Id, 1, 2m)]), CancellationToken.None));

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
            NovaVendaDe(agua, 1, 50m, sucata: [new SucataVenda(cascoE.Id, 1, 2m)]), CancellationToken.None));

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
    public async Task CriarAsync_QuandoQuantidadeNaoPositiva_LancaQuantidadeInvalidaNaDevolucaoESucataInvalidaNaSucata(int quantidade)
    {
        var devolucao = await Assert.ThrowsAsync<RequestValidationException>(() => sut.CriarAsync(
            NovaVendaDe(agua, 1, 50m, devolvidos: [new CascoQuantidade(cascoG.Id, quantidade)]),
            CancellationToken.None));
        var sucata = await Assert.ThrowsAsync<RequestValidationException>(() => sut.CriarAsync(
            NovaVendaDe(agua, 1, 50m, sucata: [new SucataVenda(cascoG.Id, quantidade, 2m)]),
            CancellationToken.None));

        Assert.Equal("QUANTIDADE_INVALIDA", devolucao.Code);
        Assert.Equal("SUCATA_INVALIDA", sucata.Code);
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
    public async Task EditarAsync_QuandoCupomJaEmitido_LancaVendaJaFaturada()
    {
        var criada = await sut.CriarAsync(NovaVendaDe(agua, 1, 50m), CancellationToken.None);
        cupons.Emitidos.Add(criada.Id);

        var e = await Assert.ThrowsAsync<BusinessRuleException>(
            () => sut.EditarAsync(criada.Id, NovaVendaDe(agua, 2, 50m), CancellationToken.None));

        Assert.Equal("VENDA_JA_FATURADA", e.Code);
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
    public async Task AdicionarPagamentoAsync_QuandoVendaTemSucata_DevolveODescontoSucataDaVenda()
    {
        var criada = await sut.CriarAsync(
            NovaVendaDe(agua, 1, 50m, sucata: [new SucataVenda(cascoG.Id, 2, 3m)]), CancellationToken.None);
        vendas.InfoPagamento = new InfoPagamentoVenda(44m, 0m, 44m, StatusPagamento.PENDENTE);

        var resultado = await sut.AdicionarPagamentoAsync(
            criada.Id, FormaPagamento.PIX, 10m, CancellationToken.None);

        Assert.Equal(6m, resultado.DescontoSucata);
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

    [Fact]
    public async Task ObterUltimoPrecoAsync_QuandoVariasCompras_DevolveAMaisRecenteSemAsDeletadas()
    {
        var antiga = new UltimoPrecoVenda(Guid.NewGuid(), new DateTimeOffset(2026, 1, 1, 0, 0, 0, TimeSpan.Zero), 10m);
        var recente = new UltimoPrecoVenda(Guid.NewGuid(), new DateTimeOffset(2026, 2, 1, 0, 0, 0, TimeSpan.Zero), 12m);
        var deletada = new UltimoPrecoVenda(Guid.NewGuid(), new DateTimeOffset(2026, 3, 1, 0, 0, 0, TimeSpan.Zero), 99m);
        vendas.Compras.Add((clienteId, agua.ProdutoId, agua.MarcaId, antiga, false));
        vendas.Compras.Add((clienteId, agua.ProdutoId, agua.MarcaId, recente, false));
        vendas.Compras.Add((clienteId, agua.ProdutoId, agua.MarcaId, deletada, true));

        var ultimo = await sut.ObterUltimoPrecoAsync(clienteId, agua.ProdutoId, agua.MarcaId, CancellationToken.None);

        Assert.Equal(recente, ultimo);
    }

    [Fact]
    public async Task ObterUltimoPrecoAsync_QuandoNuncaComprou_DevolveNulo()
    {
        vendas.Compras.Add((clienteId, agua.ProdutoId, agua.MarcaId,
            new UltimoPrecoVenda(Guid.NewGuid(), DateTimeOffset.UtcNow, 10m), false));

        Assert.Null(await sut.ObterUltimoPrecoAsync(clienteId, aguaY.ProdutoId, aguaY.MarcaId, CancellationToken.None));
        Assert.Null(await sut.ObterUltimoPrecoAsync(Guid.NewGuid(), agua.ProdutoId, agua.MarcaId, CancellationToken.None));
    }

    private NovaVenda NovaVendaDe(
        ProdutoVenda produto,
        int quantidade,
        decimal preco,
        IReadOnlyList<CascoQuantidade>? devolvidos = null,
        IReadOnlyList<SucataVenda>? sucata = null,
        IReadOnlyList<PagamentoVenda>? pagamentos = null) => new(
        clienteId, funcionarioId, null,
        [new ItemVenda(produto.ProdutoId, produto.MarcaId, quantidade, preco, null)],
        [],
        pagamentos ?? [],
        devolvidos ?? [], sucata ?? [], null);

    private NovaVenda NovaVendaSoVasilhame(IReadOnlyList<VasilhameVenda> vasilhames) => new(
        clienteId, funcionarioId, null, [], vasilhames, [], [], [], null);
}
