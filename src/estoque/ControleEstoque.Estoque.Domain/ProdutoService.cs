using ControleEstoque.Shared.Results;

namespace ControleEstoque.Estoque.Domain;

public interface IProdutoService
{
    Task<Produto> CriarAsync(Produto produto, CancellationToken cancellationToken);
    Task<Produto> AtualizarAsync(Produto produto, CancellationToken cancellationToken);
    Task<Produto> ObterAsync(Guid id, CancellationToken cancellationToken);
    Task<IReadOnlyList<Produto>> ListarAsync(
        TipoProduto? tipo, Guid? marcaId, string? categoria, CancellationToken cancellationToken);
    Task<string> SalvarFotoAsync(Guid id, Stream content, string extension, CancellationToken cancellationToken);
    Task<(Stream Content, string ContentType)?> AbrirFotoAsync(Guid id, CancellationToken cancellationToken);
}

public sealed class ProdutoService : IProdutoService
{
    private readonly IProdutoRepository produtos;
    private readonly IMarcaRepository marcas;
    private readonly IFotoStorage fotos;

    public ProdutoService(IProdutoRepository produtos, IMarcaRepository marcas, IFotoStorage fotos)
    {
        this.produtos = produtos;
        this.marcas = marcas;
        this.fotos = fotos;
    }

    public async Task<string> SalvarFotoAsync(
        Guid id, Stream content, string extension, CancellationToken cancellationToken)
    {
        _ = await ObterAsync(id, cancellationToken);
        var fotoUrl = await fotos.SaveAsync(id, content, extension, cancellationToken);
        await produtos.SetFotoAsync(id, fotoUrl, cancellationToken);
        return fotoUrl;
    }

    public async Task<(Stream Content, string ContentType)?> AbrirFotoAsync(
        Guid id, CancellationToken cancellationToken)
    {
        var produto = await ObterAsync(id, cancellationToken);
        if (produto.FotoUrl is null)
        {
            return null;
        }

        return await fotos.OpenAsync(produto.FotoUrl, cancellationToken);
    }

    public async Task<Produto> CriarAsync(Produto produto, CancellationToken cancellationToken)
    {
        await ValidarAsync(produto, cancellationToken);
        var novo = produto with { Id = produto.Id == Guid.Empty ? Guid.NewGuid() : produto.Id };
        await produtos.CreateAsync(novo, cancellationToken);
        return novo;
    }

    public async Task<Produto> AtualizarAsync(Produto produto, CancellationToken cancellationToken)
    {
        await ValidarAsync(produto, cancellationToken);
        var atualizado = await produtos.UpdateAsync(produto, cancellationToken);
        if (!atualizado)
        {
            throw new EntityNotFoundException("PRODUTO_NAO_ENCONTRADO", $"Produto {produto.Id} não encontrado.");
        }

        return produto;
    }

    public async Task<Produto> ObterAsync(Guid id, CancellationToken cancellationToken)
    {
        var produto = await produtos.GetAsync(id, cancellationToken);
        return produto
            ?? throw new EntityNotFoundException("PRODUTO_NAO_ENCONTRADO", $"Produto {id} não encontrado.");
    }

    public Task<IReadOnlyList<Produto>> ListarAsync(
        TipoProduto? tipo, Guid? marcaId, string? categoria, CancellationToken cancellationToken)
        => produtos.ListAsync(tipo, marcaId, categoria, cancellationToken);

    private async Task ValidarAsync(Produto produto, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(produto.Nome))
        {
            throw new RequestValidationException("NOME_OBRIGATORIO", "Nome do produto é obrigatório.");
        }

        if (produto.PrecoReferencia < 0)
        {
            throw new RequestValidationException("PRECO_INVALIDO", "Preço de referência não pode ser negativo.");
        }

        // Marca é obrigatória apenas para água e galão completo; livre para o resto
        // (carvão, gelo etc. entram como DESCARTAVEL sem marca).
        var exigeMarca = produto.Tipo is TipoProduto.AGUA or TipoProduto.GALAO_COMPLETO;
        if (exigeMarca && produto.MarcaId is null)
        {
            throw new RequestValidationException(
                "MARCA_OBRIGATORIA", "Marca é obrigatória para água e galão completo.");
        }

        if (produto.MarcaId is { } marcaId && !await marcas.ExistsAsync(marcaId, cancellationToken))
        {
            throw new BusinessRuleException("MARCA_INEXISTENTE", $"Marca {marcaId} não cadastrada.");
        }
    }
}
