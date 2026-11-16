using ControleEstoque.Vendas.Domain;

namespace ControleEstoque.Vendas.Tests;

public sealed class SerieDiariaFaturamentoTests
{
    private static readonly DateOnly D15 = new(2026, 11, 15);
    private static readonly DateOnly D16 = new(2026, 11, 16);

    [Fact]
    public void UneDiasDasTresFontesZeraAusentesEOrdena()
    {
        var serie = SerieDiariaFaturamento.Montar(
            new Dictionary<DateOnly, decimal> { [D15] = 100m },
            new Dictionary<DateOnly, decimal> { [D16] = 20m, [D15] = 90m },
            new Dictionary<DateOnly, decimal> { [D15] = 40m });

        Assert.Equal(
            [new FaturamentoPorDia(D15, 100m, 90m, 40m), new FaturamentoPorDia(D16, 0m, 20m, 0m)],
            serie);
    }

    [Fact]
    public void FontesVaziasDevolvemListaVazia()
    {
        var vazio = new Dictionary<DateOnly, decimal>();
        Assert.Empty(SerieDiariaFaturamento.Montar(vazio, vazio, vazio));
    }

    [Fact]
    public async Task ListarComPageSize1RepassaClienteELimite1()
    {
        var lookup = new FakeVendaLookup();
        var vendas = new FakeVendaRepository(lookup.SaldosEstoque);
        var sut = new VendaService(vendas, lookup, new FakeCupomFiscalRepository(), new FakePermissaoLookup());
        var clienteId = Guid.NewGuid();

        await sut.ListarAsync(clienteId, null, null, 1, 1, CancellationToken.None);

        Assert.Equal((clienteId, 1), vendas.UltimaListagem);
    }
}
