using ControleEstoque.Clientes.Domain;
using ControleEstoque.Shared.Results;

namespace ControleEstoque.Clientes.Tests;

public sealed class ClienteServiceTests
{
    private readonly FakeClienteRepository clientes = new();
    private readonly ClienteService sut;

    // O repositório de saldos não participa da validação de nome.
    public ClienteServiceTests() => sut = new ClienteService(clientes, null!);

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public async Task CriarAsync_QuandoNomeVazioOuEmBranco_LancaNomeObrigatorio(string nome)
    {
        var e = await Assert.ThrowsAsync<RequestValidationException>(
            () => sut.CriarAsync(new Cliente(Guid.Empty, nome, null, null, []), CancellationToken.None));

        Assert.Equal("NOME_OBRIGATORIO", e.Code);
    }
}
