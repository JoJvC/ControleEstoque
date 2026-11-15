using ControleEstoque.Clientes.Domain;

namespace ControleEstoque.Clientes.Tests;

public sealed class SaldosCascosTests
{
    [Fact]
    public void TotalNaRua_QuandoMisturaComNegativo_SomaSomenteOsPositivos()
    {
        var total = SaldosCascos.TotalNaRua([5, -3, 0, 2]);

        Assert.Equal(7, total);
    }

    [Fact]
    public void TotalNaRua_QuandoSoNegativosOuZero_DaZero()
    {
        var total = SaldosCascos.TotalNaRua([-3, 0, -1]);

        Assert.Equal(0, total);
    }

    [Fact]
    public void TotalNaRua_QuandoListaVazia_DaZero()
    {
        var total = SaldosCascos.TotalNaRua([]);

        Assert.Equal(0, total);
    }

    [Fact]
    public void Montar_TotaisSaoASomaDasListasPorTipoOrdenadasPorNome()
    {
        var marcaX = Guid.NewGuid();
        var generico = Guid.NewGuid();
        var zerado = Guid.NewGuid();

        var saldos = SaldosCascos.Montar(
            [new(marcaX, "20L Marca X", 1), new(zerado, "10L", 0), new(generico, "20L Genérico", 3)],
            [new(marcaX, "20L Marca X", 2), new(generico, "20L Genérico", 0), new(zerado, "10L", 5)],
            12.5m);

        Assert.Equal(4, saldos.SaldoCascos);
        Assert.Equal(["20L Genérico", "20L Marca X"], saldos.CascosPorTipo.Select(c => c.Nome));
        Assert.Equal(7, saldos.SucataEntregue);
        Assert.Equal(["10L", "20L Marca X"], saldos.SucataPorTipo.Select(s => s.Nome));
        Assert.Equal(12.5m, saldos.SaldoFiado);
    }

    [Fact]
    public void Montar_QuandoSemLinhas_DaZeroEListasVazias()
    {
        var saldos = SaldosCascos.Montar([], [], 0m);

        Assert.Equal(0, saldos.SaldoCascos);
        Assert.Equal(0, saldos.SucataEntregue);
        Assert.Empty(saldos.CascosPorTipo);
        Assert.Empty(saldos.SucataPorTipo);
    }
}
