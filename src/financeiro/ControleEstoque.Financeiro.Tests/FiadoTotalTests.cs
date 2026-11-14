using ControleEstoque.Financeiro.Domain;

namespace ControleEstoque.Financeiro.Tests;

public sealed class FiadoTotalTests
{
    private readonly FakeFiadoRepository fiado = new();

    [Fact]
    public async Task GetTotalAReceberAsync_SomaSomenteSaldosPositivos()
    {
        fiado.Saldos[Guid.NewGuid()] = 30m;
        fiado.Saldos[Guid.NewGuid()] = 20m;
        fiado.Saldos[Guid.NewGuid()] = 0m;

        var total = await fiado.GetTotalAReceberAsync(CancellationToken.None);

        Assert.Equal(50m, total);
    }

    [Fact]
    public async Task GetTotalAReceberAsync_CreditoDoClienteNaoAbateTotal()
    {
        fiado.Saldos[Guid.NewGuid()] = 30m;
        fiado.Saldos[Guid.NewGuid()] = -15m;

        var total = await fiado.GetTotalAReceberAsync(CancellationToken.None);

        Assert.Equal(30m, total);
    }

    [Fact]
    public async Task GetTotalAReceberAsync_SemSaldosPositivos_RetornaZero()
    {
        fiado.Saldos[Guid.NewGuid()] = -10m;

        var total = await fiado.GetTotalAReceberAsync(CancellationToken.None);

        Assert.Equal(0m, total);
    }

    [Fact]
    public void ListSaldosDevedoresAsync_SegueContratoDaRotaLista()
    {
        // Contrato de GET /v1/relatorios/fiado: array de SaldoFiadoCliente, sem DTO novo.
        var metodo = typeof(IFiadoRepository).GetMethod(nameof(IFiadoRepository.ListSaldosDevedoresAsync));
        Assert.Equal(typeof(Task<IReadOnlyList<SaldoFiadoCliente>>), metodo!.ReturnType);

        var campos = typeof(SaldoFiadoCliente).GetProperties().Select(p => p.Name).Order();
        Assert.Equal(new[] { "ClienteId", "Nome", "SaldoDevedor" }, campos);
    }
}
