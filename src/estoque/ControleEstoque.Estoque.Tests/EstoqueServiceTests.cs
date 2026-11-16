using ControleEstoque.Estoque.Domain;
using ControleEstoque.Shared.Results;

namespace ControleEstoque.Estoque.Tests;

public sealed class EstoqueServiceTests
{
    private readonly FakeProdutoRepository produtos = new();
    private readonly FakeTipoCascoRepository tiposCasco = new();
    private readonly FakeEstoqueRepository estoque = new();
    private readonly FakeBaixaCascoRepository baixas;
    private readonly EstoqueService sut;

    private readonly ProdutoMarca marca;
    private readonly TipoCasco cascoComSucata;
    private readonly TipoCasco cascoSemSucata;

    public EstoqueServiceTests()
    {
        baixas = new FakeBaixaCascoRepository(estoque);
        sut = new EstoqueService(estoque, produtos, tiposCasco, baixas);
        cascoComSucata = tiposCasco.Add("Galão 20L", aceitaSucata: true);
        cascoSemSucata = tiposCasco.Add("Garrafão 10L", aceitaSucata: false);
        marca = new ProdutoMarca(Guid.NewGuid(), Guid.NewGuid(), "Marca A", 10m, 0, 0, null, null);
        produtos.Add(new Produto(
            Guid.NewGuid(), TipoProduto.DESCARTAVEL, "Copo 200ml", null, "200ml", null, [marca]));
    }

    // ---- Ajuste de estoque por produto+marca ------------------------------

    [Fact]
    public async Task AjustarAsync_QuandoProdutoMarcaIdVazio_LancaIdInvalido()
    {
        var e = await Assert.ThrowsAsync<RequestValidationException>(
            () => sut.AjustarAsync(Guid.Empty, 1, null, CancellationToken.None));

        Assert.Equal("ID_INVALIDO", e.Code);
    }

    [Fact]
    public async Task AjustarAsync_QuandoAssociacaoValida_Ajusta()
    {
        await sut.AjustarAsync(marca.Id, 3, null, CancellationToken.None);

        Assert.Equal(3, estoque.GetSaldo(marca.Id));
    }

    [Fact]
    public async Task AjustarAsync_QuandoQuantidadeZero_LancaValidacao()
    {
        var e = await Assert.ThrowsAsync<RequestValidationException>(
            () => sut.AjustarAsync(marca.Id, 0, null, CancellationToken.None));

        Assert.Equal("QUANTIDADE_INVALIDA", e.Code);
    }

    [Fact]
    public async Task AjustarAsync_QuandoAssociacaoNaoExiste_LancaNotFound()
    {
        var e = await Assert.ThrowsAsync<EntityNotFoundException>(
            () => sut.AjustarAsync(Guid.NewGuid(), 5, null, CancellationToken.None));

        Assert.Equal("PRODUTO_MARCA_NAO_ENCONTRADA", e.Code);
    }

    [Fact]
    public async Task AjustarAsync_QuandoNegativoAlemDoSaldo_LancaInsufficientStockESaldoNaoMuda()
    {
        estoque.SetSaldo(marca.Id, 2);

        await Assert.ThrowsAsync<InsufficientStockException>(
            () => sut.AjustarAsync(marca.Id, -3, null, CancellationToken.None));

        Assert.Equal(2, estoque.GetSaldo(marca.Id));
    }

    [Fact]
    public async Task AjustarAsync_QuandoNegativoDentroDoSaldo_Grava()
    {
        estoque.SetSaldo(marca.Id, 5);

        await sut.AjustarAsync(marca.Id, -5, null, CancellationToken.None);

        Assert.Equal(0, estoque.GetSaldo(marca.Id));
    }

    [Fact]
    public async Task AjustarAsync_ConcorrenteComSaldo5_AceitaSo5De10()
    {
        estoque.SetSaldo(marca.Id, 5);

        var resultados = await Task.WhenAll(Enumerable.Range(0, 10).Select(_ => TentarAsync(
            () => sut.AjustarAsync(marca.Id, -1, null, CancellationToken.None))));

        Assert.Equal(5, resultados.Count(sucesso => sucesso));
        Assert.Equal(5, resultados.Count(sucesso => !sucesso));
        Assert.Equal(0, estoque.GetSaldo(marca.Id));
    }

    // ---- Ajuste de cascos por tipo ------------------------------------------

    [Fact]
    public async Task AjustarCascoAsync_QuandoVazioPositivo_Grava()
    {
        await sut.AjustarCascoAsync(cascoSemSucata.Id, SituacaoCasco.VAZIO, 4, "inventário", CancellationToken.None);

        Assert.Equal(4, estoque.GetSaldoCasco(cascoSemSucata.Id, SituacaoCasco.VAZIO));
    }

    [Fact]
    public async Task AjustarCascoAsync_QuandoSucataEmTipoQueAceita_Grava()
    {
        await sut.AjustarCascoAsync(cascoComSucata.Id, SituacaoCasco.SUCATA, 2, null, CancellationToken.None);

        Assert.Equal(2, estoque.GetSaldoCasco(cascoComSucata.Id, SituacaoCasco.SUCATA));
    }

    [Theory]
    [InlineData(3)]
    [InlineData(-3)]
    public async Task AjustarCascoAsync_QuandoSucataEmTipoQueNaoAceita_LancaSucataNaoAceita(int quantidade)
    {
        var e = await Assert.ThrowsAsync<BusinessRuleException>(() => sut.AjustarCascoAsync(
            cascoSemSucata.Id, SituacaoCasco.SUCATA, quantidade, null, CancellationToken.None));

        Assert.Equal("SUCATA_NAO_ACEITA", e.Code);
        Assert.Equal(0, estoque.GetSaldoCasco(cascoSemSucata.Id, SituacaoCasco.SUCATA));
    }

    [Fact]
    public async Task AjustarCascoAsync_QuandoVazioNegativoAlemDoSaldo_LancaInsufficientStock()
    {
        estoque.SetSaldoCasco(cascoComSucata.Id, SituacaoCasco.VAZIO, 1);

        await Assert.ThrowsAsync<InsufficientStockException>(() => sut.AjustarCascoAsync(
            cascoComSucata.Id, SituacaoCasco.VAZIO, -2, null, CancellationToken.None));

        Assert.Equal(1, estoque.GetSaldoCasco(cascoComSucata.Id, SituacaoCasco.VAZIO));
    }

    [Fact]
    public async Task AjustarCascoAsync_QuandoTipoNaoExiste_LancaNotFound()
    {
        var e = await Assert.ThrowsAsync<EntityNotFoundException>(() => sut.AjustarCascoAsync(
            Guid.NewGuid(), SituacaoCasco.VAZIO, 1, null, CancellationToken.None));

        Assert.Equal("TIPO_CASCO_NAO_ENCONTRADO", e.Code);
    }

    [Fact]
    public async Task AjustarCascoAsync_QuandoSituacaoForaDaFaixa_LancaValorEnumInvalido()
    {
        var e = await Assert.ThrowsAsync<RequestValidationException>(() => sut.AjustarCascoAsync(
            cascoComSucata.Id, (SituacaoCasco)99, 1, null, CancellationToken.None));

        Assert.Equal("VALOR_ENUM_INVALIDO", e.Code);
    }

    [Fact]
    public async Task AjustarCascoAsync_QuandoQuantidadeZero_LancaQuantidadeInvalida()
    {
        var e = await Assert.ThrowsAsync<RequestValidationException>(() => sut.AjustarCascoAsync(
            cascoComSucata.Id, SituacaoCasco.VAZIO, 0, null, CancellationToken.None));

        Assert.Equal("QUANTIDADE_INVALIDA", e.Code);
    }

    // ---- Quebra de casco por tipo ---------------------------------------------

    [Fact]
    public async Task BaixarCascoAsync_QuandoTipoAceitaSucata_TiraDoVazioEPoeNaSucataDoMesmoTipo()
    {
        estoque.SetSaldoCasco(cascoComSucata.Id, SituacaoCasco.VAZIO, 10);
        var baixa = new NovaBaixaCasco(cascoComSucata.Id, 2, MotivoBaixaCasco.QUEBRADO, null, [Guid.NewGuid()]);

        var id = await sut.BaixarCascoAsync(baixa, CancellationToken.None);

        Assert.NotEqual(Guid.Empty, id);
        Assert.Equal(baixa, baixas.UltimaBaixa);
        Assert.Equal(8, estoque.GetSaldoCasco(cascoComSucata.Id, SituacaoCasco.VAZIO));
        Assert.Equal(2, estoque.GetSaldoCasco(cascoComSucata.Id, SituacaoCasco.SUCATA));
    }

    [Fact]
    public async Task BaixarCascoAsync_QuandoTipoNaoAceitaSucata_SoTiraDoVazio()
    {
        estoque.SetSaldoCasco(cascoSemSucata.Id, SituacaoCasco.VAZIO, 10);
        estoque.SetSaldoCasco(cascoSemSucata.Id, SituacaoCasco.SUCATA, 1);
        var baixa = new NovaBaixaCasco(cascoSemSucata.Id, 2, MotivoBaixaCasco.QUEBRADO, null, [Guid.NewGuid()]);

        await sut.BaixarCascoAsync(baixa, CancellationToken.None);

        Assert.Equal(8, estoque.GetSaldoCasco(cascoSemSucata.Id, SituacaoCasco.VAZIO));
        Assert.Equal(1, estoque.GetSaldoCasco(cascoSemSucata.Id, SituacaoCasco.SUCATA));
        Assert.Equal([SituacaoCasco.VAZIO], baixas.UltimosMovimentos.Select(m => m.Situacao).ToArray());
    }

    [Fact]
    public async Task BaixarCascoAsync_QuandoPerdido_SoTiraDoVazioENaoGeraSucata()
    {
        estoque.SetSaldoCasco(cascoComSucata.Id, SituacaoCasco.VAZIO, 10);
        var baixa = new NovaBaixaCasco(cascoComSucata.Id, 3, MotivoBaixaCasco.PERDIDO, "sumiu", [Guid.NewGuid()]);

        await sut.BaixarCascoAsync(baixa, CancellationToken.None);

        Assert.Equal(7, estoque.GetSaldoCasco(cascoComSucata.Id, SituacaoCasco.VAZIO));
        Assert.Equal(0, estoque.GetSaldoCasco(cascoComSucata.Id, SituacaoCasco.SUCATA));
        Assert.Equal(
            [new MovimentoCasco(SituacaoCasco.VAZIO, TipoMovimentoEstoque.BAIXA_PERDA, -3)], baixas.UltimosMovimentos);
        Assert.Equal(MotivoBaixaCasco.PERDIDO, baixas.UltimaBaixa!.Motivo);
        Assert.Equal("sumiu", baixas.UltimaBaixa!.Observacao);
    }

    [Fact]
    public async Task BaixarCascoAsync_QuandoMotivoForaDaFaixa_LancaValorEnumInvalido()
    {
        var baixa = new NovaBaixaCasco(cascoComSucata.Id, 1, (MotivoBaixaCasco)99, null, [Guid.NewGuid()]);

        var e = await Assert.ThrowsAsync<RequestValidationException>(
            () => sut.BaixarCascoAsync(baixa, CancellationToken.None));

        Assert.Equal("VALOR_ENUM_INVALIDO", e.Code);
    }

    [Fact]
    public async Task BaixarCascoAsync_QuandoPerdidoMaiorQueOVazio_LancaInsufficientStock()
    {
        estoque.SetSaldoCasco(cascoComSucata.Id, SituacaoCasco.VAZIO, 1);
        var baixa = new NovaBaixaCasco(cascoComSucata.Id, 5, MotivoBaixaCasco.PERDIDO, null, [Guid.NewGuid()]);

        await Assert.ThrowsAsync<InsufficientStockException>(
            () => sut.BaixarCascoAsync(baixa, CancellationToken.None));
        Assert.Equal(1, estoque.GetSaldoCasco(cascoComSucata.Id, SituacaoCasco.VAZIO));
    }

    [Fact]
    public async Task BaixarCascoAsync_NaoMexeNoSaldoDeOutroTipo()
    {
        estoque.SetSaldoCasco(cascoComSucata.Id, SituacaoCasco.VAZIO, 10);
        estoque.SetSaldoCasco(cascoSemSucata.Id, SituacaoCasco.VAZIO, 10);

        await sut.BaixarCascoAsync(
            new NovaBaixaCasco(cascoComSucata.Id, 2, MotivoBaixaCasco.QUEBRADO, null, [Guid.NewGuid()]), CancellationToken.None);

        Assert.Equal(10, estoque.GetSaldoCasco(cascoSemSucata.Id, SituacaoCasco.VAZIO));
        Assert.Equal(0, estoque.GetSaldoCasco(cascoSemSucata.Id, SituacaoCasco.SUCATA));
    }

    [Fact]
    public async Task BaixarCascoAsync_QuandoMaiorQueOVazioDoTipo_LancaInsufficientStockESaldoNaoMuda()
    {
        estoque.SetSaldoCasco(cascoComSucata.Id, SituacaoCasco.VAZIO, 1);
        // Vazio de outro tipo não cobre: o saldo é por tipo.
        estoque.SetSaldoCasco(cascoSemSucata.Id, SituacaoCasco.VAZIO, 100);
        var baixa = new NovaBaixaCasco(cascoComSucata.Id, 5, MotivoBaixaCasco.QUEBRADO, null, [Guid.NewGuid()]);

        await Assert.ThrowsAsync<InsufficientStockException>(
            () => sut.BaixarCascoAsync(baixa, CancellationToken.None));

        Assert.Equal(1, estoque.GetSaldoCasco(cascoComSucata.Id, SituacaoCasco.VAZIO));
        Assert.Equal(0, estoque.GetSaldoCasco(cascoComSucata.Id, SituacaoCasco.SUCATA));
        Assert.Null(baixas.UltimaBaixa);
    }

    [Fact]
    public async Task BaixarCascoAsync_QuandoSemResponsavel_LancaValidacao()
    {
        var baixa = new NovaBaixaCasco(cascoComSucata.Id, 2, MotivoBaixaCasco.QUEBRADO, null, []);

        var e = await Assert.ThrowsAsync<RequestValidationException>(
            () => sut.BaixarCascoAsync(baixa, CancellationToken.None));

        Assert.Equal("RESPONSAVEL_OBRIGATORIO", e.Code);
    }

    [Fact]
    public async Task BaixarCascoAsync_QuandoResponsavelIdVazio_LancaIdInvalido()
    {
        var baixa = new NovaBaixaCasco(cascoComSucata.Id, 2, MotivoBaixaCasco.QUEBRADO, null, [Guid.NewGuid(), Guid.Empty]);

        var e = await Assert.ThrowsAsync<RequestValidationException>(
            () => sut.BaixarCascoAsync(baixa, CancellationToken.None));

        Assert.Equal("ID_INVALIDO", e.Code);
    }

    [Fact]
    public async Task BaixarCascoAsync_QuandoTipoCascoIdVazio_LancaIdInvalido()
    {
        var baixa = new NovaBaixaCasco(Guid.Empty, 2, MotivoBaixaCasco.QUEBRADO, null, [Guid.NewGuid()]);

        var e = await Assert.ThrowsAsync<RequestValidationException>(
            () => sut.BaixarCascoAsync(baixa, CancellationToken.None));

        Assert.Equal("ID_INVALIDO", e.Code);
    }

    [Fact]
    public async Task BaixarCascoAsync_QuandoTipoNaoExiste_LancaNotFoundSemGravar()
    {
        var baixa = new NovaBaixaCasco(Guid.NewGuid(), 2, MotivoBaixaCasco.QUEBRADO, null, [Guid.NewGuid()]);

        var e = await Assert.ThrowsAsync<EntityNotFoundException>(
            () => sut.BaixarCascoAsync(baixa, CancellationToken.None));

        Assert.Equal("TIPO_CASCO_NAO_ENCONTRADO", e.Code);
        Assert.Null(baixas.UltimaBaixa);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public async Task BaixarCascoAsync_QuandoQuantidadeNaoPositiva_LancaQuantidadeInvalida(int quantidade)
    {
        var baixa = new NovaBaixaCasco(cascoComSucata.Id, quantidade, MotivoBaixaCasco.QUEBRADO, null, [Guid.NewGuid()]);

        var e = await Assert.ThrowsAsync<RequestValidationException>(
            () => sut.BaixarCascoAsync(baixa, CancellationToken.None));

        Assert.Equal("QUANTIDADE_INVALIDA", e.Code);
        Assert.Null(baixas.UltimaBaixa);
    }

    [Fact]
    public async Task BaixarCascoAsync_ConcorrenteComSaldo5_AceitaSo5De10()
    {
        estoque.SetSaldoCasco(cascoComSucata.Id, SituacaoCasco.VAZIO, 5);
        var baixa = new NovaBaixaCasco(cascoComSucata.Id, 1, MotivoBaixaCasco.QUEBRADO, null, [Guid.NewGuid()]);

        var resultados = await Task.WhenAll(Enumerable.Range(0, 10).Select(_ => TentarAsync(
            () => sut.BaixarCascoAsync(baixa, CancellationToken.None))));

        Assert.Equal(5, resultados.Count(sucesso => sucesso));
        Assert.Equal(5, resultados.Count(sucesso => !sucesso));
        Assert.Equal(0, estoque.GetSaldoCasco(cascoComSucata.Id, SituacaoCasco.VAZIO));
        Assert.Equal(5, estoque.GetSaldoCasco(cascoComSucata.Id, SituacaoCasco.SUCATA));
    }

    [Fact]
    public async Task AjustarEBaixar_QuandoGravacaoAtomicaRecusa_LancamInsufficientStockMesmoComLeituraAlta()
    {
        estoque.SetSaldo(marca.Id, 100); // leitura avulsa desatualizada: a gravação atômica é quem decide
        estoque.RecusarSempre = true;

        await Assert.ThrowsAsync<InsufficientStockException>(
            () => sut.AjustarAsync(marca.Id, -1, null, CancellationToken.None));
        await Assert.ThrowsAsync<InsufficientStockException>(() => sut.BaixarCascoAsync(
            new NovaBaixaCasco(cascoComSucata.Id, 1, MotivoBaixaCasco.QUEBRADO, null, [Guid.NewGuid()]), CancellationToken.None));
        Assert.Null(baixas.UltimaBaixa);
    }

    // ---- Leituras ---------------------------------------------------------------

    [Fact]
    public async Task ObterEstoqueAsync_DevolveItensDoRepositorio()
    {
        var itens = new[]
        {
            new EstoqueItem(marca.Id, Guid.NewGuid(), TipoProduto.DESCARTAVEL, "Copo 200ml",
                marca.MarcaId, "Marca A", null, null, 7, 2, false),
            new EstoqueItem(Guid.NewGuid(), Guid.NewGuid(), TipoProduto.RETORNAVEL, "Galão 20L",
                Guid.NewGuid(), "Marca B", null, null, 1, 3, true),
        };
        estoque.Itens = itens;

        var r = await sut.ObterEstoqueAsync(CancellationToken.None);

        Assert.Equal(2, r.Count);
        Assert.Equal(itens, r);
    }

    [Fact]
    public async Task ObterEstoqueCascosAsync_DevolveSaldosDoRepositorio()
    {
        var cascos = new[] { new EstoqueCasco(cascoComSucata.Id, "Galão 20L", null, null, true, 8, 2) };
        estoque.Cascos = cascos;

        Assert.Equal(cascos, await sut.ObterEstoqueCascosAsync(CancellationToken.None));
    }

    private static async Task<bool> TentarAsync(Func<Task> acao)
    {
        try
        {
            await acao();
            return true;
        }
        catch (InsufficientStockException)
        {
            return false;
        }
    }
}
