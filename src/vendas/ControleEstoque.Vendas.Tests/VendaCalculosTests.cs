using ControleEstoque.Shared.Results;
using ControleEstoque.Vendas.Domain;

namespace ControleEstoque.Vendas.Tests;

public sealed class VendaCalculosTests
{
    private static readonly Guid ProdutoA = Guid.NewGuid();

    [Fact]
    public void Calcular_QuandoSemDesconto_TotaisBatemComItens()
    {
        var totais = VendaCalculos.Calcular(
            [new ItemVenda(ProdutoA, 5, 50m, null)],
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
        var totais = VendaCalculos.Calcular(
            [new ItemVenda(ProdutoA, 2, 50m, new Desconto(TipoDesconto.VALOR, 10m, "cliente antigo"))],
            []);

        Assert.Equal(100m, totais.TotalBruto);
        Assert.Equal(10m, totais.TotalDesconto);
        Assert.Equal(90m, totais.TotalLiquido);
        Assert.Equal(StatusPagamento.PENDENTE, totais.Status);
    }

    [Fact]
    public void Calcular_QuandoDescontoPercentual_SistemaCalculaValor()
    {
        var totais = VendaCalculos.Calcular(
            [new ItemVenda(ProdutoA, 4, 25m, new Desconto(TipoDesconto.PERCENTUAL, 10m, "promoção"))],
            [new PagamentoVenda(FormaPagamento.DINHEIRO, 90m)]);

        Assert.Equal(100m, totais.TotalBruto);
        Assert.Equal(10m, totais.TotalDesconto);
        Assert.Equal(90m, totais.TotalLiquido);
        Assert.Equal(StatusPagamento.PAGA, totais.Status);
    }

    [Fact]
    public void Calcular_QuandoPagamentosCobremTotal_StatusPaga()
    {
        var totais = VendaCalculos.Calcular(
            [new ItemVenda(ProdutoA, 1, 100m, null)],
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
        var e = Assert.Throws<RequestValidationException>(() => VendaCalculos.Calcular(
            [new ItemVenda(ProdutoA, 1, 100m, new Desconto(TipoDesconto.VALOR, 10m, " "))],
            []));

        Assert.Equal("DESCONTO_SEM_MOTIVO", e.Code);
    }

    [Fact]
    public void Calcular_QuandoPagamentoExcedeTotal_Lanca()
    {
        var e = Assert.Throws<RequestValidationException>(() => VendaCalculos.Calcular(
            [new ItemVenda(ProdutoA, 1, 100m, null)],
            [new PagamentoVenda(FormaPagamento.PIX, 150m)]));

        Assert.Equal("PAGAMENTO_EXCEDE_TOTAL", e.Code);
    }

    [Fact]
    public void Calcular_QuandoDescontoMaiorQueItem_Lanca()
    {
        var e = Assert.Throws<RequestValidationException>(() => VendaCalculos.Calcular(
            [new ItemVenda(ProdutoA, 1, 50m, new Desconto(TipoDesconto.VALOR, 60m, "erro"))],
            []));

        Assert.Equal("DESCONTO_MAIOR_QUE_ITEM", e.Code);
    }

    [Fact]
    public void Calcular_QuandoSemItens_Lanca()
    {
        var e = Assert.Throws<RequestValidationException>(() => VendaCalculos.Calcular([], []));

        Assert.Equal("ITENS_OBRIGATORIOS", e.Code);
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
}
