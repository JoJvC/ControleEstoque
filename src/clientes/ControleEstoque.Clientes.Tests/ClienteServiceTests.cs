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

    private Task<Endereco> Adicionar(Guid clienteId, string logradouro, bool principal = false) =>
        sut.AdicionarEnderecoAsync(
            new Endereco(Guid.Empty, clienteId, logradouro, null, null, null, null, principal),
            CancellationToken.None);

    private Task<Endereco> Atualizar(Guid clienteId, Guid id, bool principal) =>
        sut.AtualizarEnderecoAsync(
            new Endereco(id, clienteId, "Rua X", null, null, null, null, principal), CancellationToken.None);

    private Guid[] Principais() => clientes.Enderecos.Where(e => e.Principal).Select(e => e.Id).ToArray();

    [Fact]
    public async Task AdicionarEndereco_PrimeiroViraPrincipalMesmoSemFlag()
    {
        var c = clientes.Add("Ana");
        var a = await Adicionar(c.Id, "A");

        Assert.True(a.Principal);
        Assert.Equal([a.Id], Principais());
    }

    [Fact]
    public async Task AdicionarEndereco_SegundoSemFlagNaoRoubaPrincipal()
    {
        var c = clientes.Add("Ana");
        var a = await Adicionar(c.Id, "A");
        var b = await Adicionar(c.Id, "B");

        Assert.False(b.Principal);
        Assert.Equal([a.Id], Principais());
    }

    [Fact]
    public async Task AdicionarEndereco_ComPrincipalDesmarcaOAnterior()
    {
        var c = clientes.Add("Ana");
        await Adicionar(c.Id, "A");
        var b = await Adicionar(c.Id, "B", principal: true);

        Assert.Equal([b.Id], Principais());
    }

    [Fact]
    public async Task AtualizarEndereco_ComPrincipalDesmarcaOAnterior()
    {
        var c = clientes.Add("Ana");
        await Adicionar(c.Id, "A");
        var b = await Adicionar(c.Id, "B");

        var atualizado = await Atualizar(c.Id, b.Id, principal: true);

        Assert.True(atualizado.Principal);
        Assert.Equal([b.Id], Principais());
    }

    [Fact]
    public async Task AtualizarEndereco_SemPrincipalNoPrincipalMantemPrincipal()
    {
        var c = clientes.Add("Ana");
        var a = await Adicionar(c.Id, "A");

        var atualizado = await Atualizar(c.Id, a.Id, principal: false);

        Assert.True(atualizado.Principal);
        Assert.Equal([a.Id], Principais());
    }

    [Fact]
    public async Task RemoverEndereco_DoPrincipalPromoveOMaisAntigo()
    {
        var c = clientes.Add("Ana");
        var a = await Adicionar(c.Id, "A");
        var b = await Adicionar(c.Id, "B");
        await Adicionar(c.Id, "C");

        await sut.RemoverEnderecoAsync(c.Id, a.Id, CancellationToken.None);

        Assert.Equal([b.Id], Principais());
        Assert.Equal(2, clientes.Enderecos.Count);
    }

    [Fact]
    public async Task RemoverEndereco_NaoPrincipalMantemPrincipal()
    {
        var c = clientes.Add("Ana");
        var a = await Adicionar(c.Id, "A");
        var b = await Adicionar(c.Id, "B");

        await sut.RemoverEnderecoAsync(c.Id, b.Id, CancellationToken.None);

        Assert.Equal([a.Id], Principais());
    }

    [Fact]
    public async Task RemoverEndereco_UltimoDeixaClienteSemEndereco()
    {
        var c = clientes.Add("Ana");
        var a = await Adicionar(c.Id, "A");

        await sut.RemoverEnderecoAsync(c.Id, a.Id, CancellationToken.None);

        Assert.Empty(clientes.Enderecos);
    }

    [Fact]
    public async Task EnderecoDeOutroClienteOuInexistente_Da404()
    {
        var c1 = clientes.Add("Ana");
        var c2 = clientes.Add("Bia");
        var a = await Adicionar(c1.Id, "A");

        foreach (var id in new[] { a.Id, Guid.NewGuid() })
        {
            var e1 = await Assert.ThrowsAsync<EntityNotFoundException>(() => Atualizar(c2.Id, id, false));
            var e2 = await Assert.ThrowsAsync<EntityNotFoundException>(
                () => sut.RemoverEnderecoAsync(c2.Id, id, CancellationToken.None));
            Assert.Equal("ENDERECO_NAO_ENCONTRADO", e1.Code);
            Assert.Equal("ENDERECO_NAO_ENCONTRADO", e2.Code);
        }

        Assert.Single(clientes.Enderecos);
    }
}
