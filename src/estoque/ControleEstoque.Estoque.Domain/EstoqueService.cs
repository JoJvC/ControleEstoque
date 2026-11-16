using ControleEstoque.Shared.Results;

namespace ControleEstoque.Estoque.Domain;

public interface IEstoqueService
{
    Task<IReadOnlyList<EstoqueItem>> ObterEstoqueAsync(CancellationToken cancellationToken);
    Task<IReadOnlyList<EstoqueCasco>> ObterEstoqueCascosAsync(CancellationToken cancellationToken);
    Task AjustarAsync(Guid produtoMarcaId, int quantidade, string? observacao, CancellationToken cancellationToken);
    Task AjustarCascoAsync(
        Guid tipoCascoId, SituacaoCasco situacao, int quantidade, string? motivo, CancellationToken cancellationToken);
    Task<Guid> BaixarCascoAsync(NovaBaixaCasco baixa, CancellationToken cancellationToken);
}

public sealed class EstoqueService : IEstoqueService
{
    private readonly IEstoqueRepository estoque;
    private readonly IProdutoRepository produtos;
    private readonly ITipoCascoRepository tiposCasco;
    private readonly IBaixaCascoRepository baixas;

    public EstoqueService(
        IEstoqueRepository estoque,
        IProdutoRepository produtos,
        ITipoCascoRepository tiposCasco,
        IBaixaCascoRepository baixas)
    {
        this.estoque = estoque;
        this.produtos = produtos;
        this.tiposCasco = tiposCasco;
        this.baixas = baixas;
    }

    public Task<IReadOnlyList<EstoqueItem>> ObterEstoqueAsync(CancellationToken cancellationToken)
        => estoque.GetEstoqueAsync(cancellationToken);

    public Task<IReadOnlyList<EstoqueCasco>> ObterEstoqueCascosAsync(CancellationToken cancellationToken)
        => estoque.GetEstoqueCascosAsync(cancellationToken);

    public async Task AjustarAsync(
        Guid produtoMarcaId, int quantidade, string? observacao, CancellationToken cancellationToken)
    {
        Validacao.IdPreenchido(produtoMarcaId, "ProdutoMarcaId");
        if (quantidade == 0)
        {
            throw new RequestValidationException("QUANTIDADE_INVALIDA", "Quantidade do ajuste não pode ser zero.");
        }

        var produto = await produtos.GetByProdutoMarcaAsync(produtoMarcaId, cancellationToken)
            ?? throw new EntityNotFoundException(
                "PRODUTO_MARCA_NAO_ENCONTRADA", $"Associação produto+marca {produtoMarcaId} não encontrada.");
        var marca = produto.Marcas.First(m => m.Id == produtoMarcaId);

        if (await estoque.AddAjusteAsync(produtoMarcaId, quantidade, observacao, cancellationToken) is { } falta)
        {
            throw new InsufficientStockException(
                $"Estoque de '{produto.Nome} — {marca.MarcaNome}' ({falta.Saldo}) insuficiente para ajustar {quantidade}.");
        }
    }

    public async Task AjustarCascoAsync(
        Guid tipoCascoId, SituacaoCasco situacao, int quantidade, string? motivo,
        CancellationToken cancellationToken)
    {
        Validacao.IdPreenchido(tipoCascoId, "TipoCascoId");
        Validacao.EnumDefinido(situacao, "Situacao");
        if (quantidade == 0)
        {
            throw new RequestValidationException("QUANTIDADE_INVALIDA", "Quantidade do ajuste não pode ser zero.");
        }

        var tipo = await ObterTipoCascoAsync(tipoCascoId, cancellationToken);
        if (situacao == SituacaoCasco.SUCATA && !tipo.AceitaSucata)
        {
            throw new BusinessRuleException(
                "SUCATA_NAO_ACEITA", $"O tipo de casco '{tipo.Nome}' não aceita sucata.");
        }

        if (await estoque.AddAjusteCascoAsync(tipoCascoId, situacao, quantidade, motivo, cancellationToken)
            is { } falta)
        {
            throw new InsufficientStockException(
                $"Estoque de casco {situacao} '{tipo.Nome}' ({falta.Saldo}) insuficiente para ajustar {quantidade}.");
        }
    }

    public async Task<Guid> BaixarCascoAsync(NovaBaixaCasco baixa, CancellationToken cancellationToken)
    {
        Validacao.IdPreenchido(baixa.TipoCascoId, "TipoCascoId");
        Validacao.EnumDefinido(baixa.Motivo, "Motivo");
        if (baixa.Quantidade <= 0)
        {
            throw new RequestValidationException("QUANTIDADE_INVALIDA", "Quantidade da baixa deve ser positiva.");
        }

        foreach (var responsavelId in baixa.ResponsaveisIds)
        {
            Validacao.IdPreenchido(responsavelId, "ResponsaveisIds");
        }

        if (baixa.ResponsaveisIds.Count == 0)
        {
            throw new RequestValidationException(
                "RESPONSAVEL_OBRIGATORIO", "Informe ao menos um funcionário responsável pela quebra ou perda.");
        }

        var tipo = await ObterTipoCascoAsync(baixa.TipoCascoId, cancellationToken);
        var perda = baixa.Motivo == MotivoBaixaCasco.PERDIDO;
        var movimentos = perda
            ? RegrasCasco.MovimentosDaPerda(baixa.Quantidade)
            : RegrasCasco.MovimentosDaQuebra(baixa.Quantidade, tipo.AceitaSucata);

        var (id, falta) = await baixas.CreateAsync(baixa, movimentos, cancellationToken);
        if (falta is not null)
        {
            throw new InsufficientStockException(
                $"Estoque de casco vazio '{tipo.Nome}' ({falta.Saldo}) insuficiente para baixar {baixa.Quantidade} por {(perda ? "perda" : "quebra")}.");
        }

        return id;
    }

    private async Task<TipoCasco> ObterTipoCascoAsync(Guid tipoCascoId, CancellationToken cancellationToken) =>
        await tiposCasco.GetAsync(tipoCascoId, cancellationToken)
            ?? throw new EntityNotFoundException(
                "TIPO_CASCO_NAO_ENCONTRADO", $"Tipo de casco {tipoCascoId} não encontrado.");
}
