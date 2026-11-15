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
        Validacao.EnumDefinido(abastecimento.TipoFrete, "TipoFrete");
        Validacao.IdPreenchido(abastecimento.FuncionarioId, "FuncionarioId");
        foreach (var item in abastecimento.Itens)
        {
            Validacao.IdPreenchido(item.ProdutoMarcaId, "ProdutoMarcaId");
            Validacao.NaoNegativo(item.CustoUnitario, "CustoUnitario");
        }

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
                    "QUANTIDADE_INVALIDA", $"Quantidade inválida para a associação produto+marca {item.ProdutoMarcaId}.");
            }

            _ = await produtos.GetByProdutoMarcaAsync(item.ProdutoMarcaId, cancellationToken)
                ?? throw new EntityNotFoundException(
                    "PRODUTO_MARCA_NAO_ENCONTRADA",
                    $"Associação produto+marca {item.ProdutoMarcaId} não encontrada.");
        }

        return await abastecimentos.CreateAsync(abastecimento, cancellationToken);
    }
}
