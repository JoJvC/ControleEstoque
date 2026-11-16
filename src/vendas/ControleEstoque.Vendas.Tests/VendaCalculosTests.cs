using ControleEstoque.Shared.Results;
using ControleEstoque.Vendas.Domain;

namespace ControleEstoque.Vendas.Tests;

public sealed class VendaCalculosTests
{
    private static readonly Guid ProdutoA = Guid.NewGuid();
    private static readonly Guid MarcaA = Guid.NewGuid();
    private static readonly Guid TipoT = Guid.NewGuid();

    private static TotaisVenda Calc(IReadOnlyList<ItemVenda> itens, IReadOnlyList<PagamentoVenda> pagamentos) =>
        VendaCalculos.Calcular(itens, [], [], pagamentos);

    [Fact]
    public void Calcular_QuandoSemDesconto_TotaisBatemComItens()
    {
        var totais = Calc(
            [new ItemVenda(ProdutoA, MarcaA, 5, 50m, null)],
            [new PagamentoVenda(FormaPagamento.PIX, 200m)]);

        Assert.Equal(250m, totais.TotalBruto);
        Assert.Equal(0m, totais.TotalDesconto);
        Assert.Equal(250m, totais.TotalLiquido);
        Assert.Equal(200m, totais.TotalPago);
        Assert.Equal(50m, totais.Faltante);
        Assert.Equal(StatusPagamento.PARCIAL, totais.Status);
    }

    [Fact]
    public void Calcular_QuandoDescontoValor_AbateDoItem()
    {
        var totais = Calc(
            [new ItemVenda(ProdutoA, MarcaA, 2, 50m, new Desconto(TipoDesconto.VALOR, 10m, "cliente antigo"))],
            []);

        Assert.Equal(100m, totais.TotalBruto);
        Assert.Equal(10m, totais.TotalDesconto);
        Assert.Equal(90m, totais.TotalLiquido);
        Assert.Equal(StatusPagamento.PENDENTE, totais.Status);
    }

    [Fact]
    public void Calcular_QuandoDescontoPercentual_SistemaCalculaValor()
    {
        var totais = Calc(
            [new ItemVenda(ProdutoA, MarcaA, 4, 25m, new Desconto(TipoDesconto.PERCENTUAL, 10m, "promoção"))],
            [new PagamentoVenda(FormaPagamento.DINHEIRO, 90m)]);

        Assert.Equal(100m, totais.TotalBruto);
        Assert.Equal(10m, totais.TotalDesconto);
        Assert.Equal(90m, totais.TotalLiquido);
        Assert.Equal(StatusPagamento.PAGA, totais.Status);
    }

    [Fact]
    public void Calcular_QuandoDescontoPercentualTerceiroDecimalCinco_ArredondaParaCima()
    {
        // 5% de 0,10 = 0,005: o ponto médio arredonda para 0,01 (AwayFromZero), não para 0,00.
        var totais = Calc(
            [new ItemVenda(ProdutoA, MarcaA, 1, 0.10m, new Desconto(TipoDesconto.PERCENTUAL, 5m, "promoção"))],
            []);

        Assert.Equal(0.01m, totais.TotalDesconto);
        Assert.Equal(0.09m, totais.TotalLiquido);
    }

    [Fact]
    public void Calcular_QuandoPagamentosExcedemTotalLiquido_SobraViraCreditoGeradoEStatusPaga()
    {
        var totais = Calc(
            [new ItemVenda(ProdutoA, MarcaA, 1, 50m, null)],
            [new PagamentoVenda(FormaPagamento.DINHEIRO, 60m)]);

        Assert.Equal(50m, totais.TotalLiquido);
        Assert.Equal(60m, totais.TotalPago);
        Assert.Equal(10m, totais.CreditoGerado);
        Assert.Equal(0m, totais.Faltante);
        Assert.Equal(StatusPagamento.PAGA, totais.Status);
    }

    [Fact]
    public void Calcular_QuandoPagamentosCobremTotal_StatusPaga()
    {
        var totais = Calc(
            [new ItemVenda(ProdutoA, MarcaA, 1, 100m, null)],
            [
                new PagamentoVenda(FormaPagamento.PIX, 40m),
                new PagamentoVenda(FormaPagamento.CARTAO_DEBITO, 35m),
                new PagamentoVenda(FormaPagamento.DINHEIRO, 25m)
            ]);

        Assert.Equal(StatusPagamento.PAGA, totais.Status);
        Assert.Equal(0m, totais.Faltante);
    }

    [Fact]
    public void Calcular_QuandoDescontoSemMotivo_Lanca()
    {
        var e = Assert.Throws<RequestValidationException>(() => Calc(
            [new ItemVenda(ProdutoA, MarcaA, 1, 100m, new Desconto(TipoDesconto.VALOR, 10m, " "))],
            []));

        Assert.Equal("DESCONTO_SEM_MOTIVO", e.Code);
    }

    [Fact]
    public void Calcular_QuandoUsoDeCreditoPassaDoTotalLiquido_LancaCreditoExcedeTotal()
    {
        var e = Assert.Throws<BusinessRuleException>(() => Calc(
            [new ItemVenda(ProdutoA, MarcaA, 1, 100m, null)],
            [new PagamentoVenda(FormaPagamento.CREDITO_CLIENTE, 100.01m)]));

        Assert.Equal("CREDITO_EXCEDE_TOTAL", e.Code);
    }

    [Fact]
    public void Calcular_QuandoDescontoMaiorQueItem_Lanca()
    {
        var e = Assert.Throws<RequestValidationException>(() => Calc(
            [new ItemVenda(ProdutoA, MarcaA, 1, 50m, new Desconto(TipoDesconto.VALOR, 60m, "erro"))],
            []));

        Assert.Equal("DESCONTO_MAIOR_QUE_ITEM", e.Code);
    }

    [Fact]
    public void Calcular_QuandoSemItensESemVasilhames_LancaItensObrigatorios()
    {
        var e = Assert.Throws<RequestValidationException>(() => Calc([], []));

        Assert.Equal("ITENS_OBRIGATORIOS", e.Code);
    }

    [Fact]
    public void Calcular_QuandoSoVasilhame_Aceita()
    {
        var vasilhame = VendaCalculos.CalcularVasilhame(
            new VasilhameVenda(TipoT, 2, 15m, ModoCreditoVasilhame.COMPRAR), 0);

        var totais = VendaCalculos.Calcular([], [vasilhame], [], []);

        Assert.Equal(30m, totais.TotalBruto);
        Assert.Equal(30m, totais.TotalLiquido);
        Assert.Equal(StatusPagamento.PENDENTE, totais.Status);
    }

    [Fact]
    public void Calcular_QuandoSucata_DescontoEntraNoTotalDescontoEAbateOLiquido()
    {
        var totais = VendaCalculos.Calcular(
            [new ItemVenda(ProdutoA, MarcaA, 1, 50m, new Desconto(TipoDesconto.VALOR, 4m, "promoção"))],
            [], [new SucataVenda(TipoT, 2, 3m)], []);

        Assert.Equal(50m, totais.TotalBruto);
        Assert.Equal(6m, totais.DescontoSucata);
        Assert.Equal(10m, totais.TotalDesconto);
        Assert.Equal(40m, totais.TotalLiquido);
    }

    [Fact]
    public void Calcular_QuandoDescontoSucataPassaDoLiquidoDosItens_LancaDescontoSucataExcedeTotal()
    {
        var e = Assert.Throws<BusinessRuleException>(() => VendaCalculos.Calcular(
            [new ItemVenda(ProdutoA, MarcaA, 1, 50m, null)], [], [new SucataVenda(TipoT, 17, 3m)], []));

        Assert.Equal("DESCONTO_SUCATA_EXCEDE_TOTAL", e.Code);
    }

    [Theory]
    [InlineData(0, 3)]
    [InlineData(-1, 3)]
    [InlineData(2, -0.01)]
    public void Calcular_QuandoSucataInvalida_LancaSucataInvalida(int quantidade, double valor)
    {
        var e = Assert.Throws<RequestValidationException>(() => VendaCalculos.Calcular(
            [new ItemVenda(ProdutoA, MarcaA, 1, 50m, null)], [], [new SucataVenda(TipoT, quantidade, (decimal)valor)], []));

        Assert.Equal("SUCATA_INVALIDA", e.Code);
    }

    // Preço do vasilhame R$ 15 (exemplos 1, 2 e 4 da spec).
    [Theory]
    [InlineData(ModoCreditoVasilhame.ABATER_CREDITO, 2, 2, 2, 0)]  // crédito 2, compra 2: abate tudo
    [InlineData(ModoCreditoVasilhame.COMPRAR, 2, 2, 0, 30)]         // comprar: cobra tudo e o crédito segue
    [InlineData(ModoCreditoVasilhame.ABATER_CREDITO, 3, 1, 1, 30)]  // crédito 1, compra 3: cobre 1
    [InlineData(ModoCreditoVasilhame.ABATER_CREDITO, 2, 0, 0, 30)]  // sem crédito: cobra tudo
    public void CalcularVasilhame_AbateSoOCreditoDoTipo(
        ModoCreditoVasilhame modo, int quantidade, long credito, int abatidaEsperada, int cobradoEsperado)
    {
        var v = VendaCalculos.CalcularVasilhame(new VasilhameVenda(TipoT, quantidade, 15m, modo), credito);

        Assert.Equal(abatidaEsperada, v.QuantidadeAbatida);
        Assert.Equal(cobradoEsperado, v.Total);
    }

    [Theory]
    [InlineData(0, 15)]
    [InlineData(-1, 15)]
    [InlineData(1, -1)]
    public void CalcularVasilhame_QuandoInvalido_LancaVasilhameInvalido(int quantidade, int preco)
    {
        var e = Assert.Throws<RequestValidationException>(() => VendaCalculos.CalcularVasilhame(
            new VasilhameVenda(TipoT, quantidade, preco, ModoCreditoVasilhame.COMPRAR), 0));

        Assert.Equal("VASILHAME_INVALIDO", e.Code);
    }

    [Theory]
    [InlineData(100, 0, "PENDENTE")]
    [InlineData(100, 50, "PARCIAL")]
    [InlineData(100, 100, "PAGA")]
    [InlineData(0, 0, "PAGA")] // venda 100% descontada já nasce paga
    public void CalcularStatus_ClassificaCorretamente(decimal liquido, decimal pago, string esperado)
    {
        var status = VendaCalculos.CalcularStatus(liquido, pago);

        Assert.Equal(esperado, status.ToString());
    }

    [Fact]
    public void Calcular_QuandoTipoDescontoForaDaFaixa_LancaValorEnumInvalido()
    {
        var e = Assert.Throws<RequestValidationException>(() => Calc(
            [new ItemVenda(ProdutoA, MarcaA, 1, 50m, new Desconto((TipoDesconto)99, 10m, "motivo"))], []));

        Assert.Equal("VALOR_ENUM_INVALIDO", e.Code);
    }

    [Fact]
    public void Calcular_QuandoFormaPagamentoForaDaFaixa_LancaValorEnumInvalido()
    {
        var e = Assert.Throws<RequestValidationException>(() => Calc(
            [new ItemVenda(ProdutoA, MarcaA, 1, 50m, null)], [new PagamentoVenda((FormaPagamento)99, 10m)]));

        Assert.Equal("VALOR_ENUM_INVALIDO", e.Code);
    }
}
