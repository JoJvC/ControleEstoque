using ControleEstoque.Financeiro.Domain;
using ControleEstoque.Shared.Results;

namespace ControleEstoque.Financeiro.Tests;

public sealed class FiadoServiceTests
{
    private readonly FakeFiadoRepository fiado = new();
    private readonly FiadoService sut;

    public FiadoServiceTests() => sut = new FiadoService(fiado);

    [Fact]
    public async Task PagarAsync_QuandoPagaAcimaDoDevido_AceitaEGeraCredito()
    {
        // Saldo −30 (deve 30), paga 50: saldo devedor −20 = crédito de 20 (NovoSaldo +20).
        var cliente = Guid.NewGuid();
        fiado.Clientes.Add(cliente);
        fiado.Saldos[cliente] = 30m;

        var novoSaldoDevedor = (await sut.PagarAsync(cliente, 50m, "PIX", CancellationToken.None)).NovoSaldoDevedor;

        Assert.Equal(-20m, novoSaldoDevedor);
        Assert.Equal(20m, 0m - novoSaldoDevedor);
        Assert.Equal(50m, fiado.PagamentosLancados.Sum());
    }

    [Fact]
    public async Task PagarAsync_QuandoSemDivida_GeraCredito()
    {
        var cliente = Guid.NewGuid();
        fiado.Clientes.Add(cliente);

        var novoSaldoDevedor = (await sut.PagarAsync(cliente, 40m, "DINHEIRO", CancellationToken.None)).NovoSaldoDevedor;

        Assert.Equal(-40m, novoSaldoDevedor);
    }

    [Fact]
    public async Task PagarAsync_QuandoCaixaFechado_LancaCaixaFechadoENaoBaixaSaldo()
    {
        var cliente = Guid.NewGuid();
        fiado.Clientes.Add(cliente);
        fiado.Saldos[cliente] = 50m;
        fiado.CaixaHojeFechado = true;

        var e = await Assert.ThrowsAsync<ConflictException>(
            () => sut.PagarAsync(cliente, 50m, "PIX", CancellationToken.None));

        Assert.Equal("CAIXA_FECHADO", e.Code);
        Assert.Equal(50m, fiado.Saldos[cliente]);
    }

    [Fact]
    public async Task PagarAsync_QuandoDentroDoSaldo_BaixaSaldo()
    {
        var cliente = Guid.NewGuid();
        fiado.Clientes.Add(cliente);
        fiado.Saldos[cliente] = 50m;

        var novoSaldo = (await sut.PagarAsync(cliente, 50m, "DINHEIRO", CancellationToken.None)).NovoSaldoDevedor;

        Assert.Equal(0m, novoSaldo);
    }

    [Fact]
    public async Task PagarAsync_QuandoClienteNaoExiste_LancaNotFound()
    {
        await Assert.ThrowsAsync<EntityNotFoundException>(
            () => sut.PagarAsync(Guid.NewGuid(), 10m, "PIX", CancellationToken.None));
    }

    [Fact]
    public async Task PagarAsync_QuandoValorInvalido_LancaValidacao()
    {
        await Assert.ThrowsAsync<RequestValidationException>(
            () => sut.PagarAsync(Guid.NewGuid(), 0m, "PIX", CancellationToken.None));
    }

    [Fact]
    public async Task PagarAsync_ComVendasPendentes_AbateAMaisAntigaEDevolveAbatimentos()
    {
        var cliente = Guid.NewGuid();
        fiado.Clientes.Add(cliente);
        var a = Guid.NewGuid();
        fiado.VendasPendentes[cliente] = new List<VendaPendente>
        {
            new(a, new DateTimeOffset(2026, 11, 1, 0, 0, 0, TimeSpan.Zero), 50m, 0m),
            new(Guid.NewGuid(), new DateTimeOffset(2026, 11, 5, 0, 0, 0, TimeSpan.Zero), 80m, 20m),
        };
        fiado.Saldos[cliente] = 110m;

        var r = await sut.PagarAsync(cliente, 30m, "PIX", CancellationToken.None);

        var abatimento = Assert.Single(r.Abatimentos);
        Assert.Equal(a, abatimento.VendaId);
        Assert.Equal(30m, abatimento.ValorAbatido);
        Assert.Equal(StatusPagamento.PARCIAL, abatimento.NovoStatus);
        Assert.Equal(20m, abatimento.Restante);
        Assert.Equal(0m, r.ValorEmCredito);
        Assert.Equal(FormaPagamento.PIX, Assert.Single(fiado.FormasRecebidas));
    }

    [Fact]
    public async Task PagarAsync_QuandoSobra_ValorEmCreditoCorresponde()
    {
        var cliente = Guid.NewGuid();
        fiado.Clientes.Add(cliente);
        fiado.VendasPendentes[cliente] = new List<VendaPendente>
        {
            new(Guid.NewGuid(), new DateTimeOffset(2026, 11, 1, 0, 0, 0, TimeSpan.Zero), 50m, 0m),
            new(Guid.NewGuid(), new DateTimeOffset(2026, 11, 5, 0, 0, 0, TimeSpan.Zero), 80m, 20m),
        };
        fiado.Saldos[cliente] = 110m;

        var r = await sut.PagarAsync(cliente, 150m, "DINHEIRO", CancellationToken.None);

        Assert.Equal(2, r.Abatimentos.Count);
        Assert.All(r.Abatimentos, x => Assert.Equal(StatusPagamento.PAGA, x.NovoStatus));
        Assert.Equal(40m, r.ValorEmCredito);
        Assert.Equal(-40m, r.NovoSaldoDevedor);
    }

    [Fact]
    public async Task PagarAsync_SemVendaPendente_TudoViraCredito()
    {
        var cliente = Guid.NewGuid();
        fiado.Clientes.Add(cliente);

        var r = await sut.PagarAsync(cliente, 25m, "PIX", CancellationToken.None);

        Assert.Empty(r.Abatimentos);
        Assert.Equal(25m, r.ValorEmCredito);
    }

    [Fact]
    public async Task PagarAsync_FormaAusente_Lanca400FormaObrigatoria()
    {
        foreach (var forma in new string?[] { null, "", "  " })
        {
            var e = await Assert.ThrowsAsync<RequestValidationException>(
                () => sut.PagarAsync(Guid.NewGuid(), 10m, forma, CancellationToken.None));
            Assert.Equal("FORMA_OBRIGATORIA", e.Code);
        }
    }

    [Theory]
    [InlineData("BOLETO")]
    [InlineData("1")]
    [InlineData("pix")]
    public async Task PagarAsync_FormaInvalida_Lanca400ValorEnumInvalido(string forma)
    {
        var e = await Assert.ThrowsAsync<RequestValidationException>(
            () => sut.PagarAsync(Guid.NewGuid(), 10m, forma, CancellationToken.None));
        Assert.Equal("VALOR_ENUM_INVALIDO", e.Code);
    }

    [Fact]
    public async Task PagarAsync_CreditoCliente_Lanca422FormaNaoPermitida()
    {
        var e = await Assert.ThrowsAsync<BusinessRuleException>(
            () => sut.PagarAsync(Guid.NewGuid(), 10m, "CREDITO_CLIENTE", CancellationToken.None));
        Assert.Equal("FORMA_NAO_PERMITIDA", e.Code);
    }
}
