using ControleEstoque.Estoque.Domain;
using ControleEstoque.Shared.Results;

namespace ControleEstoque.Estoque.Tests;

public sealed class ProdutoServiceTests
{
    private readonly FakeProdutoRepository produtos = new();
    private readonly FakeMarcaRepository marcas = new();
    private readonly FakeTipoCascoRepository tiposCasco = new();
    private readonly ProdutoService sut;

    public ProdutoServiceTests() =>
        sut = new ProdutoService(produtos, marcas, tiposCasco, new FakeFotoStorage());

    [Fact]
    public async Task CriarAsync_QuandoDescartavelSemCasco_Cria()
    {
        // Carvão, gelo etc. entram como DESCARTAVEL: sem casco e sem marca própria no cadastro do produto.
        var produto = CreateProduto(TipoProduto.DESCARTAVEL, null) with { Nome = "Carvão 5kg" };

        var criado = await sut.CriarAsync(produto, CancellationToken.None);

        Assert.NotEqual(Guid.Empty, criado.Id);
        Assert.Equal("Carvão 5kg", criado.Nome);
        Assert.Empty(criado.Marcas);
    }

    [Fact]
    public async Task CriarAsync_QuandoRetornavelComCascoGenerico_Cria()
    {
        var casco = tiposCasco.Add("Galão 20L");

        var criado = await sut.CriarAsync(CreateProduto(TipoProduto.RETORNAVEL, casco.Id), CancellationToken.None);

        Assert.Equal(casco.Id, criado.TipoCascoId);
    }

    [Fact]
    public async Task CriarAsync_QuandoRetornavelSemCasco_LancaCascoObrigatorio()
    {
        var e = await Assert.ThrowsAsync<RequestValidationException>(
            () => sut.CriarAsync(CreateProduto(TipoProduto.RETORNAVEL, null), CancellationToken.None));

        Assert.Equal("CASCO_OBRIGATORIO", e.Code);
    }

    [Fact]
    public async Task CriarAsync_QuandoCascoDoProdutoTemMarca_LancaCascoGenericoInvalido()
    {
        var marca = marcas.Add("Marca A");
        var especifico = tiposCasco.Add("Galão 20L A", marca.Id);

        var e = await Assert.ThrowsAsync<BusinessRuleException>(
            () => sut.CriarAsync(CreateProduto(TipoProduto.RETORNAVEL, especifico.Id), CancellationToken.None));

        Assert.Equal("CASCO_GENERICO_INVALIDO", e.Code);
    }

    [Fact]
    public async Task CriarAsync_QuandoDescartavelComCasco_LancaCascoNaoPermitido()
    {
        var casco = tiposCasco.Add("Galão 20L");

        var e = await Assert.ThrowsAsync<BusinessRuleException>(
            () => sut.CriarAsync(CreateProduto(TipoProduto.DESCARTAVEL, casco.Id), CancellationToken.None));

        Assert.Equal("CASCO_NAO_PERMITIDO", e.Code);
    }

    [Fact]
    public async Task CriarAsync_QuandoCascoInexistente_LancaTipoCascoInexistente()
    {
        var e = await Assert.ThrowsAsync<BusinessRuleException>(
            () => sut.CriarAsync(CreateProduto(TipoProduto.RETORNAVEL, Guid.NewGuid()), CancellationToken.None));

        Assert.Equal("TIPO_CASCO_INEXISTENTE", e.Code);
    }

    [Fact]
    public async Task AtualizarAsync_QuandoProdutoNaoExiste_LancaNotFound()
    {
        var produto = CreateProduto(TipoProduto.DESCARTAVEL, null) with { Id = Guid.NewGuid() };

        await Assert.ThrowsAsync<EntityNotFoundException>(
            () => sut.AtualizarAsync(produto, CancellationToken.None));
    }

    [Fact]
    public async Task AtualizarAsync_QuandoViraDescartavelComAssociacaoDeCascoEspecifico_LancaCascoNaoPermitido()
    {
        var (produto, _, _) = await ProdutoRetornavelComCascoEspecificoAsync();

        var e = await Assert.ThrowsAsync<BusinessRuleException>(
            () => sut.AtualizarAsync(produto with { Tipo = TipoProduto.DESCARTAVEL, TipoCascoId = null },
                CancellationToken.None));

        Assert.Equal("CASCO_NAO_PERMITIDO", e.Code);
    }

    [Fact]
    public async Task CriarAsync_QuandoTipoForaDaFaixa_LancaValorEnumInvalido()
    {
        var e = await Assert.ThrowsAsync<RequestValidationException>(
            () => sut.CriarAsync(CreateProduto((TipoProduto)99, null), CancellationToken.None));

        Assert.Equal("VALOR_ENUM_INVALIDO", e.Code);
    }

    [Fact]
    public async Task ListarAsync_QuandoTipoForaDaFaixa_LancaValorEnumInvalido()
    {
        var e = await Assert.ThrowsAsync<RequestValidationException>(
            () => sut.ListarAsync((TipoProduto)99, null, null, CancellationToken.None));

        Assert.Equal("VALOR_ENUM_INVALIDO", e.Code);
    }

    [Fact]
    public async Task ListarAsync_QuandoTipoNuloOuValido_Lista()
    {
        Assert.Empty(await sut.ListarAsync(null, null, null, CancellationToken.None));
        Assert.Empty(await sut.ListarAsync(TipoProduto.RETORNAVEL, null, null, CancellationToken.None));
    }

    [Fact]
    public async Task ListarAsync_QuandoFiltraPorMarca_DevolveSoProdutosComAssociacaoDaMarca()
    {
        var marcaA = marcas.Add("Marca A");
        var marcaB = marcas.Add("Marca B");
        var comA = await sut.CriarAsync(CreateProduto(TipoProduto.DESCARTAVEL, null), CancellationToken.None);
        var comB = await sut.CriarAsync(CreateProduto(TipoProduto.DESCARTAVEL, null), CancellationToken.None);
        await sut.AdicionarMarcaAsync(comA.Id, CreateMarca(marcaA.Id), CancellationToken.None);
        await sut.AdicionarMarcaAsync(comB.Id, CreateMarca(marcaB.Id), CancellationToken.None);

        var lista = await sut.ListarAsync(null, marcaA.Id, null, CancellationToken.None);

        Assert.Equal(comA.Id, Assert.Single(lista).Id);
    }

    // ---- N marcas por produto ---------------------------------------------

    [Fact]
    public async Task AdicionarMarcaAsync_QuandoDuasMarcasDiferentes_ProdutoTemDuasAssociacoes()
    {
        var marcaA = marcas.Add("Marca A");
        var marcaB = marcas.Add("Marca B");
        var produto = await sut.CriarAsync(CreateProduto(TipoProduto.DESCARTAVEL, null), CancellationToken.None);

        await sut.AdicionarMarcaAsync(produto.Id, CreateMarca(marcaA.Id, 10m, 5), CancellationToken.None);
        var atual = await sut.AdicionarMarcaAsync(produto.Id, CreateMarca(marcaB.Id, 12m, 0), CancellationToken.None);

        Assert.Equal(2, atual.Marcas.Count);
        Assert.Equal([marcaA.Id, marcaB.Id], atual.Marcas.Select(m => m.MarcaId).ToArray());
        Assert.All(atual.Marcas, m => Assert.NotEqual(Guid.Empty, m.Id));
    }

    [Fact]
    public async Task AdicionarMarcaAsync_QuandoMarcaRepetida_LancaMarcaDuplicada()
    {
        var marca = marcas.Add("Marca A");
        var produto = await sut.CriarAsync(CreateProduto(TipoProduto.DESCARTAVEL, null), CancellationToken.None);
        await sut.AdicionarMarcaAsync(produto.Id, CreateMarca(marca.Id), CancellationToken.None);

        var e = await Assert.ThrowsAsync<ConflictException>(
            () => sut.AdicionarMarcaAsync(produto.Id, CreateMarca(marca.Id), CancellationToken.None));

        Assert.Equal("MARCA_DUPLICADA", e.Code);
    }

    [Fact]
    public async Task AtualizarMarcaAsync_QuandoTrocaParaMarcaJaAssociada_LancaMarcaDuplicada()
    {
        var marcaA = marcas.Add("Marca A");
        var marcaB = marcas.Add("Marca B");
        var produto = await sut.CriarAsync(CreateProduto(TipoProduto.DESCARTAVEL, null), CancellationToken.None);
        await sut.AdicionarMarcaAsync(produto.Id, CreateMarca(marcaA.Id), CancellationToken.None);
        var comB = await sut.AdicionarMarcaAsync(produto.Id, CreateMarca(marcaB.Id), CancellationToken.None);
        var associacaoB = comB.Marcas.Single(m => m.MarcaId == marcaB.Id);

        var e = await Assert.ThrowsAsync<ConflictException>(
            () => sut.AtualizarMarcaAsync(produto.Id, associacaoB with { MarcaId = marcaA.Id }, CancellationToken.None));

        Assert.Equal("MARCA_DUPLICADA", e.Code);
    }

    [Fact]
    public async Task AtualizarMarcaAsync_QuandoMantemAMarca_AtualizaPrecoEMinimo()
    {
        var marca = marcas.Add("Marca A");
        var produto = await sut.CriarAsync(CreateProduto(TipoProduto.DESCARTAVEL, null), CancellationToken.None);
        var criado = await sut.AdicionarMarcaAsync(produto.Id, CreateMarca(marca.Id, 10m, 5), CancellationToken.None);
        var associacao = criado.Marcas.Single();

        var atual = await sut.AtualizarMarcaAsync(
            produto.Id, associacao with { PrecoReferencia = 11m, EstoqueMinimo = 8 }, CancellationToken.None);

        var atualizada = Assert.Single(atual.Marcas);
        Assert.Equal(associacao.Id, atualizada.Id);
        Assert.Equal(11m, atualizada.PrecoReferencia);
        Assert.Equal(8, atualizada.EstoqueMinimo);
    }

    [Fact]
    public async Task AtualizarMarcaAsync_QuandoAssociacaoNaoExiste_LancaNotFound()
    {
        var marca = marcas.Add("Marca A");
        var produto = await sut.CriarAsync(CreateProduto(TipoProduto.DESCARTAVEL, null), CancellationToken.None);

        var e = await Assert.ThrowsAsync<EntityNotFoundException>(
            () => sut.AtualizarMarcaAsync(
                produto.Id, CreateMarca(marca.Id) with { Id = Guid.NewGuid() }, CancellationToken.None));

        Assert.Equal("PRODUTO_MARCA_NAO_ENCONTRADA", e.Code);
    }

    [Fact]
    public async Task AdicionarMarcaAsync_QuandoMarcaInexistente_LancaMarcaInexistente()
    {
        var produto = await sut.CriarAsync(CreateProduto(TipoProduto.DESCARTAVEL, null), CancellationToken.None);

        var e = await Assert.ThrowsAsync<BusinessRuleException>(
            () => sut.AdicionarMarcaAsync(produto.Id, CreateMarca(Guid.NewGuid()), CancellationToken.None));

        Assert.Equal("MARCA_INEXISTENTE", e.Code);
    }

    [Fact]
    public async Task AdicionarMarcaAsync_QuandoMarcaIdVazio_LancaIdInvalido()
    {
        var produto = await sut.CriarAsync(CreateProduto(TipoProduto.DESCARTAVEL, null), CancellationToken.None);

        var e = await Assert.ThrowsAsync<RequestValidationException>(
            () => sut.AdicionarMarcaAsync(produto.Id, CreateMarca(Guid.Empty), CancellationToken.None));

        Assert.Equal("ID_INVALIDO", e.Code);
    }

    [Fact]
    public async Task AdicionarMarcaAsync_QuandoEstoqueMinimoNegativo_LancaValorInvalido()
    {
        var marca = marcas.Add("Marca A");
        var produto = await sut.CriarAsync(CreateProduto(TipoProduto.DESCARTAVEL, null), CancellationToken.None);

        var e = await Assert.ThrowsAsync<RequestValidationException>(
            () => sut.AdicionarMarcaAsync(produto.Id, CreateMarca(marca.Id, 1m, -1), CancellationToken.None));

        Assert.Equal("VALOR_INVALIDO", e.Code);
    }

    [Fact]
    public async Task AdicionarMarcaAsync_QuandoPrecoNegativo_LancaPrecoInvalido()
    {
        var marca = marcas.Add("Marca A");
        var produto = await sut.CriarAsync(CreateProduto(TipoProduto.DESCARTAVEL, null), CancellationToken.None);

        var e = await Assert.ThrowsAsync<RequestValidationException>(
            () => sut.AdicionarMarcaAsync(produto.Id, CreateMarca(marca.Id, -1m), CancellationToken.None));

        Assert.Equal("PRECO_INVALIDO", e.Code);
    }

    // ---- Casco específico da associação -----------------------------------

    [Fact]
    public async Task AdicionarMarcaAsync_QuandoCascoEspecificoDaMesmaMarca_Associa()
    {
        var (_, marca, especifico) = await ProdutoRetornavelComCascoEspecificoAsync();

        var produto = (await sut.ListarAsync(null, marca.Id, null, CancellationToken.None)).Single();

        Assert.Equal(especifico.Id, produto.Marcas.Single().TipoCascoId);
    }

    [Fact]
    public async Task AdicionarMarcaAsync_QuandoCascoEspecificoDeOutraMarca_LancaCascoEspecificoInvalido()
    {
        var marcaA = marcas.Add("Marca A");
        var marcaB = marcas.Add("Marca B");
        var generico = tiposCasco.Add("Galão 20L");
        var deB = tiposCasco.Add("Galão 20L B", marcaB.Id);
        var produto = await sut.CriarAsync(CreateProduto(TipoProduto.RETORNAVEL, generico.Id), CancellationToken.None);

        var e = await Assert.ThrowsAsync<BusinessRuleException>(
            () => sut.AdicionarMarcaAsync(produto.Id, CreateMarca(marcaA.Id) with { TipoCascoId = deB.Id },
                CancellationToken.None));

        Assert.Equal("CASCO_ESPECIFICO_INVALIDO", e.Code);
    }

    [Fact]
    public async Task AdicionarMarcaAsync_QuandoCascoDaAssociacaoEGenerico_LancaCascoEspecificoInvalido()
    {
        var marca = marcas.Add("Marca A");
        var generico = tiposCasco.Add("Galão 20L");
        var produto = await sut.CriarAsync(CreateProduto(TipoProduto.RETORNAVEL, generico.Id), CancellationToken.None);

        var e = await Assert.ThrowsAsync<BusinessRuleException>(
            () => sut.AdicionarMarcaAsync(produto.Id, CreateMarca(marca.Id) with { TipoCascoId = generico.Id },
                CancellationToken.None));

        Assert.Equal("CASCO_ESPECIFICO_INVALIDO", e.Code);
    }

    [Fact]
    public async Task AdicionarMarcaAsync_QuandoDescartavelComCascoEspecifico_LancaCascoNaoPermitido()
    {
        var marca = marcas.Add("Marca A");
        var especifico = tiposCasco.Add("Galão 20L A", marca.Id);
        var produto = await sut.CriarAsync(CreateProduto(TipoProduto.DESCARTAVEL, null), CancellationToken.None);

        var e = await Assert.ThrowsAsync<BusinessRuleException>(
            () => sut.AdicionarMarcaAsync(produto.Id, CreateMarca(marca.Id) with { TipoCascoId = especifico.Id },
                CancellationToken.None));

        Assert.Equal("CASCO_NAO_PERMITIDO", e.Code);
    }

    // ---- Foto por associação ----------------------------------------------

    [Fact]
    public async Task SalvarFotoAsync_GravaNaAssociacaoEAbrirFotoSemFotoDevolveNulo()
    {
        var marca = marcas.Add("Marca A");
        var produto = await sut.CriarAsync(CreateProduto(TipoProduto.DESCARTAVEL, null), CancellationToken.None);
        var comMarca = await sut.AdicionarMarcaAsync(produto.Id, CreateMarca(marca.Id), CancellationToken.None);
        var associacao = comMarca.Marcas.Single();
        Assert.Null(await sut.AbrirFotoAsync(produto.Id, associacao.Id, CancellationToken.None));

        var url = await sut.SalvarFotoAsync(
            produto.Id, associacao.Id, new MemoryStream([1]), ".png", CancellationToken.None);

        Assert.Equal(url, (await sut.ObterAsync(produto.Id, CancellationToken.None)).Marcas.Single().FotoUrl);
    }

    [Fact]
    public async Task SalvarFotoAsync_QuandoAssociacaoNaoPertenceAoProduto_LancaNotFound()
    {
        var produto = await sut.CriarAsync(CreateProduto(TipoProduto.DESCARTAVEL, null), CancellationToken.None);

        await Assert.ThrowsAsync<EntityNotFoundException>(() => sut.SalvarFotoAsync(
            produto.Id, Guid.NewGuid(), new MemoryStream([1]), ".png", CancellationToken.None));
    }

    private async Task<(Produto Produto, Marca Marca, TipoCasco Especifico)> ProdutoRetornavelComCascoEspecificoAsync()
    {
        var marca = marcas.Add("Marca A");
        var generico = tiposCasco.Add("Galão 20L");
        var especifico = tiposCasco.Add("Galão 20L A", marca.Id);
        var produto = await sut.CriarAsync(CreateProduto(TipoProduto.RETORNAVEL, generico.Id), CancellationToken.None);
        var comMarca = await sut.AdicionarMarcaAsync(
            produto.Id, CreateMarca(marca.Id) with { TipoCascoId = especifico.Id }, CancellationToken.None);
        return (comMarca, marca, especifico);
    }

    private static Produto CreateProduto(TipoProduto tipo, Guid? tipoCascoId) => new(
        Guid.Empty, tipo, "Produto Teste", null, "20L", tipoCascoId, []);

    private static ProdutoMarca CreateMarca(Guid marcaId, decimal preco = 50m, int minimo = 5) => new(
        Guid.Empty, marcaId, null, preco, minimo, 0, null, null);
}
