using ControleEstoque.Clientes.Domain;
using ControleEstoque.Shared.Results;

namespace ControleEstoque.Clientes.Tests;

public sealed class CascoClienteServiceTests
{
    private readonly FakeClienteRepository clientes = new();
    private readonly FakeCascoClienteRepository cascos = new();
    private readonly CascoClienteService sut;

    public CascoClienteServiceTests() => sut = new CascoClienteService(cascos, clientes);

    [Fact]
    public async Task ConverterAsync_QuandoQuantidadeMaiorQueSaldo_LancaConversaoMaiorQueSaldo()
    {
        var cliente = clientes.Add("Cliente X");
        cascos.SetSaldo(cliente.Id, 2);

        var e = await Assert.ThrowsAsync<BusinessRuleException>(
            () => sut.ConverterAsync(cliente.Id, 5, 15m, CancellationToken.None));

        Assert.Equal("CONVERSAO_MAIOR_QUE_SALDO", e.Code);
    }

    [Fact]
    public async Task ConverterAsync_QuandoDentroDoSaldo_ConverteEDebitaFiado()
    {
        var cliente = clientes.Add("Cliente X");
        cascos.SetSaldo(cliente.Id, 5);

        var resultado = await sut.ConverterAsync(cliente.Id, 3, 15m, CancellationToken.None);

        Assert.Equal(2, resultado.NovoSaldoCascos);
        Assert.Equal(45m, resultado.NovoSaldoFiado);
    }

    [Fact]
    public async Task DevolverAsync_QuandoDevolveMaisQueDeve_GeraCredito()
    {
        // Devolução acima do débito gera saldo negativo (crédito para vendas futuras).
        var cliente = clientes.Add("Cliente X");
        cascos.SetSaldo(cliente.Id, 1);

        var resultado = await sut.DevolverAsync(cliente.Id, 3, CancellationToken.None);

        Assert.Equal(-2, resultado.NovoSaldoCascos);
    }

    [Fact]
    public async Task DevolverAsync_QuandoQuantidadeInvalida_LancaValidacao()
    {
        var cliente = clientes.Add("Cliente X");

        await Assert.ThrowsAsync<RequestValidationException>(
            () => sut.DevolverAsync(cliente.Id, 0, CancellationToken.None));
    }

    [Fact]
    public async Task DevolverAsync_QuandoClienteNaoExiste_LancaNotFound()
    {
        await Assert.ThrowsAsync<EntityNotFoundException>(
            () => sut.DevolverAsync(Guid.NewGuid(), 1, CancellationToken.None));
    }
}
