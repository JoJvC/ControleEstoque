using ControleEstoque.Shared.Results;

namespace ControleEstoque.Estoque.Domain;

public interface IEstoqueService
{
    Task<IReadOnlyList<EstoqueItem>> ObterEstoqueAsync(CancellationToken cancellationToken);
    Task AjustarAsync(Guid produtoId, int quantidade, string? observacao, CancellationToken cancellationToken);
    Task<Guid> BaixarCascoAsync(NovaBaixaCasco baixa, CancellationToken cancellationToken);
}

public sealed class EstoqueService : IEstoqueService
{
    private readonly IEstoqueRepository estoque;
    private readonly IProdutoRepository produtos;
    private readonly IBaixaCascoRepository baixas;

    public EstoqueService(
        IEstoqueRepository estoque,
        IProdutoRepository produtos,
        IBaixaCascoRepository baixas)
    {
        this.estoque = estoque;
        this.produtos = produtos;
        this.baixas = baixas;
    }

    public Task<IReadOnlyList<EstoqueItem>> ObterEstoqueAsync(CancellationToken cancellationToken)
        => estoque.GetEstoqueAsync(cancellationToken);

    public async Task AjustarAsync(
        Guid produtoId, int quantidade, string? observacao, CancellationToken cancellationToken)
    {
        if (quantidade == 0)
        {
            throw new RequestValidationException("QUANTIDADE_INVALIDA", "Quantidade do ajuste não pode ser zero.");
        }

        _ = await produtos.GetAsync(produtoId, cancellationToken)
            ?? throw new EntityNotFoundException("PRODUTO_NAO_ENCONTRADO", $"Produto {produtoId} não encontrado.");

        await estoque.AddAjusteAsync(produtoId, quantidade, observacao, cancellationToken);
    }

    public async Task<Guid> BaixarCascoAsync(NovaBaixaCasco baixa, CancellationToken cancellationToken)
    {
        if (baixa.Quantidade <= 0)
        {
            throw new RequestValidationException("QUANTIDADE_INVALIDA", "Quantidade da baixa deve ser positiva.");
        }

        if (baixa.ResponsaveisIds.Count == 0)
        {
            throw new RequestValidationException(
                "RESPONSAVEL_OBRIGATORIO", "Informe ao menos um funcionário responsável pela quebra.");
        }

        var casco = await produtos.GetFirstByTipoAsync(TipoProduto.CASCO, cancellationToken)
            ?? throw new BusinessRuleException("PRODUTO_CASCO_AUSENTE", "Produto estrutural CASCO não cadastrado.");
        var sucata = await produtos.GetFirstByTipoAsync(TipoProduto.SUCATA, cancellationToken)
            ?? throw new BusinessRuleException("PRODUTO_SUCATA_AUSENTE", "Produto estrutural SUCATA não cadastrado.");

        var saldoCasco = await estoque.GetSaldoAsync(casco.Id, cancellationToken);
        if (saldoCasco < baixa.Quantidade)
        {
            throw new InsufficientStockException(
                $"Estoque de casco vazio ({saldoCasco}) insuficiente para baixar {baixa.Quantidade}.");
        }

        return await baixas.CreateAsync(baixa, casco.Id, sucata.Id, cancellationToken);
    }
}
