using ControleEstoque.Shared.Results;

namespace ControleEstoque.Estoque.Domain;

public interface IProdutoService
{
    Task<Produto> CriarAsync(Produto produto, CancellationToken cancellationToken);
    Task<Produto> AtualizarAsync(Produto produto, CancellationToken cancellationToken);
    Task<Produto> ObterAsync(Guid id, CancellationToken cancellationToken);
    Task<IReadOnlyList<Produto>> ListarAsync(
        TipoProduto? tipo, Guid? marcaId, string? categoria, CancellationToken cancellationToken);
    Task<Produto> AdicionarMarcaAsync(Guid produtoId, ProdutoMarca marca, CancellationToken cancellationToken);
    Task<Produto> AtualizarMarcaAsync(Guid produtoId, ProdutoMarca marca, CancellationToken cancellationToken);
    Task<string> SalvarFotoAsync(
        Guid produtoId, Guid produtoMarcaId, Stream content, string extension, CancellationToken cancellationToken);
    Task<(Stream Content, string ContentType)?> AbrirFotoAsync(
        Guid produtoId, Guid produtoMarcaId, CancellationToken cancellationToken);
}

public sealed class ProdutoService : IProdutoService
{
    private readonly IProdutoRepository produtos;
    private readonly IMarcaRepository marcas;
    private readonly ITipoCascoRepository tiposCasco;
    private readonly IFotoStorage fotos;

    public ProdutoService(
        IProdutoRepository produtos, IMarcaRepository marcas, ITipoCascoRepository tiposCasco, IFotoStorage fotos)
    {
        this.produtos = produtos;
        this.marcas = marcas;
        this.tiposCasco = tiposCasco;
        this.fotos = fotos;
    }

    public async Task<string> SalvarFotoAsync(
        Guid produtoId, Guid produtoMarcaId, Stream content, string extension, CancellationToken cancellationToken)
    {
        _ = await ObterMarcaAsync(produtoId, produtoMarcaId, cancellationToken);
        var fotoUrl = await fotos.SaveAsync(produtoMarcaId, content, extension, cancellationToken);
        await produtos.SetFotoAsync(produtoMarcaId, fotoUrl, cancellationToken);
        return fotoUrl;
    }

    public async Task<(Stream Content, string ContentType)?> AbrirFotoAsync(
        Guid produtoId, Guid produtoMarcaId, CancellationToken cancellationToken)
    {
        var (_, marca) = await ObterMarcaAsync(produtoId, produtoMarcaId, cancellationToken);
        if (marca.FotoUrl is null)
        {
            return null;
        }

        return await fotos.OpenAsync(marca.FotoUrl, cancellationToken);
    }

    public async Task<Produto> CriarAsync(Produto produto, CancellationToken cancellationToken)
    {
        await ValidarAsync(produto, cancellationToken);
        var novo = produto with { Id = produto.Id == Guid.Empty ? Guid.NewGuid() : produto.Id, Marcas = [] };
        await produtos.CreateAsync(novo, cancellationToken);
        return novo;
    }

    public async Task<Produto> AtualizarAsync(Produto produto, CancellationToken cancellationToken)
    {
        await ValidarAsync(produto, cancellationToken);
        var existente = await ObterAsync(produto.Id, cancellationToken);

        // Descartável não tem casco, nem específico: a associação que ainda aponta um impede a troca de tipo.
        if (produto.Tipo == TipoProduto.DESCARTAVEL && existente.Marcas.Any(m => m.TipoCascoId is not null))
        {
            throw new BusinessRuleException(
                "CASCO_NAO_PERMITIDO", "Produto descartável não pode ter associação com casco específico.");
        }

        if (!await produtos.UpdateAsync(produto, cancellationToken))
        {
            throw new EntityNotFoundException("PRODUTO_NAO_ENCONTRADO", $"Produto {produto.Id} não encontrado.");
        }

        return produto with { Marcas = existente.Marcas };
    }

    public async Task<Produto> ObterAsync(Guid id, CancellationToken cancellationToken)
    {
        var produto = await produtos.GetAsync(id, cancellationToken);
        return produto
            ?? throw new EntityNotFoundException("PRODUTO_NAO_ENCONTRADO", $"Produto {id} não encontrado.");
    }

    public Task<IReadOnlyList<Produto>> ListarAsync(
        TipoProduto? tipo, Guid? marcaId, string? categoria, CancellationToken cancellationToken)
    {
        Validacao.EnumDefinido(tipo, "Tipo");
        return produtos.ListAsync(tipo, marcaId, categoria, cancellationToken);
    }

    public async Task<Produto> AdicionarMarcaAsync(
        Guid produtoId, ProdutoMarca marca, CancellationToken cancellationToken)
    {
        var produto = await ObterAsync(produtoId, cancellationToken);
        await ValidarMarcaAsync(produto, marca, cancellationToken);
        await produtos.AddMarcaAsync(produtoId, marca with { Id = Guid.NewGuid() }, cancellationToken);
        return await ObterAsync(produtoId, cancellationToken);
    }

    public async Task<Produto> AtualizarMarcaAsync(
        Guid produtoId, ProdutoMarca marca, CancellationToken cancellationToken)
    {
        var (produto, _) = await ObterMarcaAsync(produtoId, marca.Id, cancellationToken);
        await ValidarMarcaAsync(produto, marca, cancellationToken);
        if (!await produtos.UpdateMarcaAsync(produtoId, marca, cancellationToken))
        {
            throw MarcaNaoEncontrada(marca.Id);
        }

        return await ObterAsync(produtoId, cancellationToken);
    }

    private async Task<(Produto Produto, ProdutoMarca Marca)> ObterMarcaAsync(
        Guid produtoId, Guid produtoMarcaId, CancellationToken cancellationToken)
    {
        var produto = await ObterAsync(produtoId, cancellationToken);
        var marca = produto.Marcas.FirstOrDefault(m => m.Id == produtoMarcaId)
            ?? throw MarcaNaoEncontrada(produtoMarcaId);
        return (produto, marca);
    }

    private static EntityNotFoundException MarcaNaoEncontrada(Guid produtoMarcaId) =>
        new("PRODUTO_MARCA_NAO_ENCONTRADA", $"Associação produto+marca {produtoMarcaId} não encontrada.");

    private async Task ValidarAsync(Produto produto, CancellationToken cancellationToken)
    {
        Validacao.EnumDefinido(produto.Tipo, "Tipo");
        Validacao.IdPreenchido(produto.TipoCascoId, "TipoCascoId");

        if (string.IsNullOrWhiteSpace(produto.Nome))
        {
            throw new RequestValidationException("NOME_OBRIGATORIO", "Nome do produto é obrigatório.");
        }

        if (produto.Tipo != TipoProduto.RETORNAVEL)
        {
            if (produto.TipoCascoId is not null)
            {
                throw new BusinessRuleException("CASCO_NAO_PERMITIDO", "Produto descartável não tem casco.");
            }

            return;
        }

        if (produto.TipoCascoId is not { } cascoId)
        {
            throw new RequestValidationException("CASCO_OBRIGATORIO", "Produto retornável exige o tipo de casco.");
        }

        var casco = await tiposCasco.GetAsync(cascoId, cancellationToken)
            ?? throw new BusinessRuleException("TIPO_CASCO_INEXISTENTE", $"Tipo de casco {cascoId} não cadastrado.");
        if (casco.MarcaId is not null)
        {
            throw new BusinessRuleException(
                "CASCO_GENERICO_INVALIDO", "O casco do produto precisa ser genérico (sem marca).");
        }
    }

    private async Task ValidarMarcaAsync(Produto produto, ProdutoMarca marca, CancellationToken cancellationToken)
    {
        Validacao.IdPreenchido(marca.MarcaId, "MarcaId");
        Validacao.IdPreenchido(marca.TipoCascoId, "TipoCascoId");
        Validacao.NaoNegativo(marca.EstoqueMinimo, "EstoqueMinimo");

        if (marca.PrecoReferencia < 0)
        {
            throw new RequestValidationException("PRECO_INVALIDO", "Preço de referência não pode ser negativo.");
        }

        if (!await marcas.ExistsAsync(marca.MarcaId, cancellationToken))
        {
            throw new BusinessRuleException("MARCA_INEXISTENTE", $"Marca {marca.MarcaId} não cadastrada.");
        }

        if (produto.Marcas.Any(m => m.MarcaId == marca.MarcaId && m.Id != marca.Id))
        {
            throw new ConflictException("MARCA_DUPLICADA", "O produto já tem associação com esta marca.");
        }

        if (marca.TipoCascoId is not { } cascoId)
        {
            return;
        }

        if (produto.Tipo != TipoProduto.RETORNAVEL)
        {
            throw new BusinessRuleException(
                "CASCO_NAO_PERMITIDO", "Casco específico só em produto retornável.");
        }

        var casco = await tiposCasco.GetAsync(cascoId, cancellationToken)
            ?? throw new BusinessRuleException("TIPO_CASCO_INEXISTENTE", $"Tipo de casco {cascoId} não cadastrado.");
        if (casco.MarcaId != marca.MarcaId)
        {
            throw new BusinessRuleException(
                "CASCO_ESPECIFICO_INVALIDO", "O casco específico precisa ser da mesma marca da associação.");
        }
    }
}
