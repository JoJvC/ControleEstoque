using ControleEstoque.Financeiro.Domain;

namespace ControleEstoque.Financeiro.Tests;

public sealed class FiadoFifoTests
{
    private static DateTimeOffset Dia(int dia) => new(2026, 11, dia, 0, 0, 0, TimeSpan.Zero);

    private static VendaPendente Venda(int dia, decimal liquido, decimal pago) =>
        new(Guid.NewGuid(), Dia(dia), liquido, pago);

    [Fact]
    public void Distribuir_AbateSoAMaisAntiga()
    {
        var a = Venda(1, 50m, 0m);
        var b = Venda(5, 80m, 20m);

        var r = FiadoFifo.Distribuir(30m, [b, a]);

        var x = Assert.Single(r.Abatimentos);
        Assert.Equal(a.VendaId, x.VendaId);
        Assert.Equal(30m, x.ValorAbatido);
        Assert.Equal(StatusPagamento.PARCIAL, x.NovoStatus);
        Assert.Equal(20m, x.Restante);
        Assert.Equal(0m, r.Sobra);
    }

    [Fact]
    public void Distribuir_QuitaVariasESobra()
    {
        var a = Venda(1, 50m, 0m);
        var b = Venda(5, 80m, 20m);

        var r = FiadoFifo.Distribuir(150m, [a, b]);

        Assert.Equal([50m, 60m], r.Abatimentos.Select(x => x.ValorAbatido));
        Assert.All(r.Abatimentos, x =>
        {
            Assert.Equal(StatusPagamento.PAGA, x.NovoStatus);
            Assert.Equal(0m, x.Restante);
        });
        Assert.Equal(40m, r.Sobra);
    }

    [Fact]
    public void Distribuir_SemVendas_TudoSobra()
    {
        var r = FiadoFifo.Distribuir(25m, []);

        Assert.Empty(r.Abatimentos);
        Assert.Equal(25m, r.Sobra);
    }

    [Fact]
    public void Distribuir_EmpateDeData_MantemOrdemDeEntrada()
    {
        var primeira = Venda(3, 10m, 0m);
        var segunda = Venda(3, 10m, 0m);

        var r = FiadoFifo.Distribuir(15m, [primeira, segunda]);

        Assert.Equal([primeira.VendaId, segunda.VendaId], r.Abatimentos.Select(x => x.VendaId));
        Assert.Equal([10m, 5m], r.Abatimentos.Select(x => x.ValorAbatido));
    }

    [Fact]
    public void Distribuir_IgnoraVendaSemRestante()
    {
        var quitada = Venda(1, 40m, 40m);
        var excedida = Venda(2, 40m, 45m);
        var aberta = Venda(3, 30m, 0m);

        var r = FiadoFifo.Distribuir(10m, [quitada, excedida, aberta]);

        var x = Assert.Single(r.Abatimentos);
        Assert.Equal(aberta.VendaId, x.VendaId);
        Assert.Equal(10m, x.ValorAbatido);
    }

    [Theory]
    [InlineData(40, 40, 40)]  // sem outro débito: o saldo final é a sobra, toda crédito
    [InlineData(40, 15, 15)]  // outro débito (casco) absorve 25: só 15 viram crédito
    [InlineData(40, -10, 0)]  // saldo ainda devedor: nada vira crédito
    public void CreditoGerado_LimitaAoSaldoPositivo(decimal sobra, decimal novoSaldo, decimal esperado) =>
        Assert.Equal(esperado, FiadoFifo.CreditoGerado(sobra, novoSaldo));
}
