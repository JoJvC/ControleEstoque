using ControleEstoque.Financeiro.Domain;

namespace ControleEstoque.Financeiro.Tests;

public sealed class FiadoTotalTests
{
    [Fact]
    public void FiadoAReceber_IgnoraSaldosPositivos()
    {
        // −40 e −10 são fiado; +25 é crédito e não abate.
        Assert.Equal(50m, SaldoCliente.FiadoAReceber([-40m, 25m, -10m]));
    }

    [Fact]
    public void FiadoAReceber_SemFiado_RetornaZero()
    {
        Assert.Equal(0m, SaldoCliente.FiadoAReceber([25m, 0m]));
        Assert.Equal(0m, SaldoCliente.FiadoAReceber([]));
    }

    [Fact]
    public void ListSaldosDevedoresAsync_SegueContratoDaRotaLista()
    {
        // Contrato de GET /v1/relatorios/fiado: array de SaldoFiadoCliente, sem DTO novo.
        var metodo = typeof(IFiadoRepository).GetMethod(nameof(IFiadoRepository.ListSaldosDevedoresAsync));
        Assert.Equal(typeof(Task<IReadOnlyList<SaldoFiadoCliente>>), metodo!.ReturnType);

        var campos = typeof(SaldoFiadoCliente).GetProperties().Select(p => p.Name).Order();
        Assert.Equal(new[] { "ClienteId", "Nome", "Saldo", "SaldoDevedor" }, campos);
    }
}
