using ControleEstoque.Clientes.Domain;
using ControleEstoque.Shared.Results;

namespace ControleEstoque.Clientes.Tests;

public sealed class SucataClienteServiceTests
{
    private readonly FakeClienteRepository clientes = new();
    private readonly FakeCascoClienteRepository cascos = new();
    private readonly FakeSucataClienteRepository sucatas = new();
    private readonly FakeTipoCascoLeituraRepository tipos = new();
    private readonly TipoCascoCliente tipo;
    private readonly SucataClienteService sut;

    public SucataClienteServiceTests()
    {
        sut = new SucataClienteService(sucatas, clientes, tipos);
        tipo = tipos.Add("20L Genérico", 25m, aceitaSucata: true);
    }

    [Fact]
    public async Task EntregarAsync_NuncaMovimentaLedgerDeCascoNormal()
    {
        // Regra crítica: cliente deve 5 cascos, entrega 3 sucatas — continua devendo 5.
        var cliente = clientes.Add("Cliente X");
        cascos.SetSaldo(cliente.Id, tipo.Id, 5);

        await sut.EntregarAsync(cliente.Id, tipo.Id, 3, null, CancellationToken.None);

        Assert.Equal(0, cascos.TotalChamadasDeEscrita);
        Assert.Equal(5, await cascos.GetSaldoAsync(cliente.Id, tipo.Id, CancellationToken.None));
    }

    [Fact]
    public async Task EntregarAsync_QuandoComValorConversao_CreditaFiado()
    {
        var cliente = clientes.Add("Cliente X");

        var resultado = await sut.EntregarAsync(cliente.Id, tipo.Id, 2, 10m, CancellationToken.None);

        Assert.Equal(2, resultado.TotalSucataEntregue);
        Assert.Equal(-10m, resultado.NovoSaldoFiado);
    }

    [Fact]
    public async Task EntregarAsync_QuandoQuantidadeInvalida_LancaValidacao()
    {
        var cliente = clientes.Add("Cliente X");

        await Assert.ThrowsAsync<RequestValidationException>(
            () => sut.EntregarAsync(cliente.Id, tipo.Id, 0, null, CancellationToken.None));
    }

    [Fact]
    public async Task EntregarAsync_QuandoValorConversaoNegativo_LancaValidacao()
    {
        var cliente = clientes.Add("Cliente X");

        await Assert.ThrowsAsync<RequestValidationException>(
            () => sut.EntregarAsync(cliente.Id, tipo.Id, 1, -5m, CancellationToken.None));
    }

    [Fact]
    public async Task EntregarAsync_QuandoClienteNaoExiste_LancaNotFound()
    {
        await Assert.ThrowsAsync<EntityNotFoundException>(
            () => sut.EntregarAsync(Guid.NewGuid(), tipo.Id, 1, null, CancellationToken.None));
    }

    [Fact]
    public async Task EntregarAsync_GravaNoTipoInformado()
    {
        var cliente = clientes.Add("Cliente X");

        await sut.EntregarAsync(cliente.Id, tipo.Id, 2, null, CancellationToken.None);

        Assert.Equal([(tipo.Id, 2)], sucatas.Entregas);
    }

    [Fact]
    public async Task EntregarAsync_QuandoTipoNaoAceitaSucata_LancaSucataNaoAceita()
    {
        var cliente = clientes.Add("Cliente X");
        var semSucata = tipos.Add("20L Marca X", 25m, aceitaSucata: false);

        var e = await Assert.ThrowsAsync<BusinessRuleException>(
            () => sut.EntregarAsync(cliente.Id, semSucata.Id, 1, null, CancellationToken.None));

        Assert.Equal("SUCATA_NAO_ACEITA", e.Code);
        Assert.Empty(sucatas.Entregas);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task EntregarAsync_QuandoTipoNaoExisteOuApagado_LancaTipoCascoNaoEncontrado(bool guidVazio)
    {
        // Tipo apagado não é cadastrado no dublê (a leitura devolve null, como deleted_at no Postgres).
        var cliente = clientes.Add("Cliente X");

        var e = await Assert.ThrowsAsync<EntityNotFoundException>(
            () => sut.EntregarAsync(
                cliente.Id, guidVazio ? Guid.Empty : Guid.NewGuid(), 1, null, CancellationToken.None));

        Assert.Equal("TIPO_CASCO_NAO_ENCONTRADO", e.Code);
        Assert.Empty(sucatas.Entregas);
    }
}
