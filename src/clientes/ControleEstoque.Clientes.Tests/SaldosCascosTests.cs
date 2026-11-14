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
}
