using ControleEstoque.Clientes.Domain;
using ControleEstoque.Shared.Results;

namespace ControleEstoque.Clientes.Tests;

public sealed class SucataClienteServiceTests
{
    private readonly FakeClienteRepository clientes = new();
    private readonly FakeCascoClienteRepository cascos = new();
    private readonly FakeSucataClienteRepository sucatas = new();
    private readonly SucataClienteService sut;

    public SucataClienteServiceTests() => sut = new SucataClienteService(sucatas, clientes);

    [Fact]
    public async Task EntregarAsync_NuncaMovimentaLedgerDeCascoNormal()
    {
        // Regra crítica: cliente deve 5 cascos, entrega 3 sucatas — continua devendo 5.
        var cliente = clientes.Add("Cliente X");
        cascos.SetSaldo(cliente.Id, 5);

        await sut.EntregarAsync(cliente.Id, 3, null, CancellationToken.None);

        Assert.Equal(0, cascos.TotalChamadasDeEscrita);
        Assert.Equal(5, await cascos.GetSaldoAsync(cliente.Id, CancellationToken.None));
    }

    [Fact]
    public async Task EntregarAsync_QuandoComValorConversao_CreditaFiado()
    {
        var cliente = clientes.Add("Cliente X");

        var resultado = await sut.EntregarAsync(cliente.Id, 2, 10m, CancellationToken.None);

        Assert.Equal(2, resultado.TotalSucataEntregue);
        Assert.Equal(-10m, resultado.NovoSaldoFiado);
    }

    [Fact]
    public async Task EntregarAsync_QuandoQuantidadeInvalida_LancaValidacao()
    {
        var cliente = clientes.Add("Cliente X");

        await Assert.ThrowsAsync<RequestValidationException>(
            () => sut.EntregarAsync(cliente.Id, 0, null, CancellationToken.None));
    }

    [Fact]
    public async Task EntregarAsync_QuandoValorConversaoNegativo_LancaValidacao()
    {
        var cliente = clientes.Add("Cliente X");

        await Assert.ThrowsAsync<RequestValidationException>(
            () => sut.EntregarAsync(cliente.Id, 1, -5m, CancellationToken.None));
    }

    [Fact]
    public async Task EntregarAsync_QuandoClienteNaoExiste_LancaNotFound()
    {
        await Assert.ThrowsAsync<EntityNotFoundException>(
            () => sut.EntregarAsync(Guid.NewGuid(), 1, null, CancellationToken.None));
    }
}
