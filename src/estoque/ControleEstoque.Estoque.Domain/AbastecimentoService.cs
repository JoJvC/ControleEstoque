using ControleEstoque.Shared.Results;

namespace ControleEstoque.Estoque.Domain;

public interface IAbastecimentoService
{
    Task<Guid> RegistrarAsync(NovoAbastecimento abastecimento, CancellationToken cancellationToken);
}

public sealed class AbastecimentoService : IAbastecimentoService
{
    private readonly IAbastecimentoRepository abastecimentos;
    private readonly IProdutoRepository produtos;

    public AbastecimentoService(IAbastecimentoRepository abastecimentos, IProdutoRepository produtos)
    {
        this.abastecimentos = abastecimentos;
        this.produtos = produtos;
    }

    public async Task<Guid> RegistrarAsync(NovoAbastecimento abastecimento, CancellationToken cancellationToken)
    {
        if (abastecimento.Itens.Count == 0)
        {
            throw new RequestValidationException("ITENS_OBRIGATORIOS", "Abastecimento deve ter ao menos um item.");
        }

        if (abastecimento.CustoTotal < 0)
        {
            throw new RequestValidationException("CUSTO_INVALIDO", "Custo do abastecimento não pode ser negativo.");
        }

        foreach (var item in abastecimento.Itens)
        {
            if (item.Quantidade <= 0)
            {
                throw new RequestValidationException(
                    "QUANTIDADE_INVALIDA", $"Quantidade inválida para o produto {item.ProdutoId}.");
            }

            _ = await produtos.GetAsync(item.ProdutoId, cancellationToken)
                ?? throw new EntityNotFoundException(
                    "PRODUTO_NAO_ENCONTRADO", $"Produto {item.ProdutoId} não encontrado.");
        }

        return await abastecimentos.CreateAsync(abastecimento, cancellationToken);
    }
}
