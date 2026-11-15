using ControleEstoque.Clientes.Domain;
using ControleEstoque.Shared.Results;

namespace ControleEstoque.Clientes.Tests;

public sealed class CascoClienteServiceTests
{
    private readonly FakeClienteRepository clientes = new();
    private readonly FakeCascoClienteRepository cascos = new();
    private readonly FakeTipoCascoLeituraRepository tipos = new();
    private readonly CascoClienteService sut;

    public CascoClienteServiceTests() => sut = new CascoClienteService(cascos, clientes, tipos);

    [Fact]
    public async Task ConverterAsync_QuandoQuantidadeMaiorQueSaldo_LancaConversaoMaiorQueSaldo()
    {
        var cliente = clientes.Add("Cliente X");
        var tipo = tipos.Add("20L Genérico", 15m);
        cascos.SetSaldo(cliente.Id, tipo.Id, 2);

        var e = await Assert.ThrowsAsync<BusinessRuleException>(
            () => sut.ConverterAsync(cliente.Id, tipo.Id, 5, CancellationToken.None));

        Assert.Equal("CONVERSAO_MAIOR_QUE_SALDO", e.Code);
    }

    [Fact]
    public async Task ConverterAsync_QuandoAcimaDoSaldoDoTipoMasTotalSuficiente_LancaConversaoMaiorQueSaldo()
    {
        var cliente = clientes.Add("Cliente X");
        var generico = tipos.Add("20L Genérico", 25m);
        var marcaX = tipos.Add("20L Marca X", 25m);
        cascos.SetSaldo(cliente.Id, generico.Id, 3);
        cascos.SetSaldo(cliente.Id, marcaX.Id, 1);

        var e = await Assert.ThrowsAsync<BusinessRuleException>(
            () => sut.ConverterAsync(cliente.Id, marcaX.Id, 2, CancellationToken.None));

        Assert.Equal("CONVERSAO_MAIOR_QUE_SALDO", e.Code);
        Assert.Empty(cascos.Conversoes);
    }

    [Fact]
    public async Task ConverterAsync_QuandoDentroDoSaldo_ConverteDebitaFiadoPeloPrecoDoVasilhame()
    {
        var cliente = clientes.Add("Cliente X");
        var tipo = tipos.Add("20L Genérico", 25m);
        cascos.SetSaldo(cliente.Id, tipo.Id, 3);

        var resultado = await sut.ConverterAsync(cliente.Id, tipo.Id, 2, CancellationToken.None);

        Assert.Equal(1, resultado.NovoSaldoCascos);
        Assert.Equal(50m, resultado.NovoSaldoFiado);
        Assert.Equal([(tipo.Id, 2, 25m)], cascos.Conversoes);
    }

    [Fact]
    public async Task ConverterAsync_QuandoPrecoVasilhameZero_LancaPrecoVasilhameNaoDefinido()
    {
        var cliente = clientes.Add("Cliente X");
        var tipo = tipos.Add("20L Genérico", 0m);
        cascos.SetSaldo(cliente.Id, tipo.Id, 3);

        var e = await Assert.ThrowsAsync<BusinessRuleException>(
            () => sut.ConverterAsync(cliente.Id, tipo.Id, 1, CancellationToken.None));

        Assert.Equal("PRECO_VASILHAME_NAO_DEFINIDO", e.Code);
        Assert.Equal(0, cascos.TotalChamadasDeEscrita);
    }

    [Fact]
    public async Task DevolverAsync_GravaNoTipoInformadoERetornaTotalDoCliente()
    {
        var cliente = clientes.Add("Cliente X");
        var generico = tipos.Add("20L Genérico");
        var marcaX = tipos.Add("20L Marca X");
        cascos.SetSaldo(cliente.Id, generico.Id, 3);
        cascos.SetSaldo(cliente.Id, marcaX.Id, 1);

        var resultado = await sut.DevolverAsync(cliente.Id, marcaX.Id, 1, CancellationToken.None);

        Assert.Equal(3, resultado.NovoSaldoCascos);
        Assert.Equal(3, await cascos.GetSaldoAsync(cliente.Id, generico.Id, CancellationToken.None));
        Assert.Equal(0, await cascos.GetSaldoAsync(cliente.Id, marcaX.Id, CancellationToken.None));
    }

    [Fact]
    public async Task DevolverAsync_QuandoDevolveMaisQueDeve_GeraCredito()
    {
        // Devolução acima do débito gera saldo negativo (crédito para vendas futuras).
        var cliente = clientes.Add("Cliente X");
        var tipo = tipos.Add("20L Genérico");
        cascos.SetSaldo(cliente.Id, tipo.Id, 1);

        var resultado = await sut.DevolverAsync(cliente.Id, tipo.Id, 3, CancellationToken.None);

        Assert.Equal(-2, resultado.NovoSaldoCascos);
    }

    [Fact]
    public async Task DevolverAsync_QuandoQuantidadeInvalida_LancaValidacao()
    {
        var cliente = clientes.Add("Cliente X");
        var tipo = tipos.Add("20L Genérico");

        await Assert.ThrowsAsync<RequestValidationException>(
            () => sut.DevolverAsync(cliente.Id, tipo.Id, 0, CancellationToken.None));
    }

    [Fact]
    public async Task DevolverAsync_QuandoClienteNaoExiste_LancaNotFound()
    {
        var tipo = tipos.Add("20L Genérico");

        var e = await Assert.ThrowsAsync<EntityNotFoundException>(
            () => sut.DevolverAsync(Guid.NewGuid(), tipo.Id, 1, CancellationToken.None));

        Assert.Equal("CLIENTE_NAO_ENCONTRADO", e.Code);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Devolver_e_Converter_QuandoTipoNaoExisteOuApagado_LancaTipoCascoNaoEncontrado(bool guidVazio)
    {
        // Tipo apagado não é cadastrado no dublê (a leitura devolve null, como deleted_at no Postgres).
        var cliente = clientes.Add("Cliente X");
        var tipoId = guidVazio ? Guid.Empty : Guid.NewGuid();

        var devolucao = await Assert.ThrowsAsync<EntityNotFoundException>(
            () => sut.DevolverAsync(cliente.Id, tipoId, 1, CancellationToken.None));
        var conversao = await Assert.ThrowsAsync<EntityNotFoundException>(
            () => sut.ConverterAsync(cliente.Id, tipoId, 1, CancellationToken.None));

        Assert.Equal("TIPO_CASCO_NAO_ENCONTRADO", devolucao.Code);
        Assert.Equal("TIPO_CASCO_NAO_ENCONTRADO", conversao.Code);
        Assert.Equal(0, cascos.TotalChamadasDeEscrita);
    }
}
