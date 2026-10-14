using ControleEstoque.Financeiro.Domain;
using ControleEstoque.Shared.Results;

namespace ControleEstoque.Financeiro.Tests;

public sealed class FiadoServiceTests
{
    private readonly FakeFiadoRepository fiado = new();
    private readonly FiadoService sut;

    public FiadoServiceTests() => sut = new FiadoService(fiado);

    [Fact]
    public async Task PagarAsync_QuandoExcedeSaldo_LancaPagamentoExcedeSaldo()
    {
        var cliente = Guid.NewGuid();
        fiado.Clientes.Add(cliente);
        fiado.Saldos[cliente] = 30m;

        var e = await Assert.ThrowsAsync<BusinessRuleException>(
            () => sut.PagarAsync(cliente, 50m, "PIX", CancellationToken.None));

        Assert.Equal("PAGAMENTO_EXCEDE_SALDO", e.Code);
    }

    [Fact]
    public async Task PagarAsync_QuandoDentroDoSaldo_BaixaSaldo()
    {
        var cliente = Guid.NewGuid();
        fiado.Clientes.Add(cliente);
        fiado.Saldos[cliente] = 50m;

        var novoSaldo = await sut.PagarAsync(cliente, 50m, "DINHEIRO", CancellationToken.None);

        Assert.Equal(0m, novoSaldo);
    }

    [Fact]
    public async Task PagarAsync_QuandoClienteNaoExiste_LancaNotFound()
    {
        await Assert.ThrowsAsync<EntityNotFoundException>(
            () => sut.PagarAsync(Guid.NewGuid(), 10m, null, CancellationToken.None));
    }

    [Fact]
    public async Task PagarAsync_QuandoValorInvalido_LancaValidacao()
    {
        await Assert.ThrowsAsync<RequestValidationException>(
            () => sut.PagarAsync(Guid.NewGuid(), 0m, null, CancellationToken.None));
    }
}
