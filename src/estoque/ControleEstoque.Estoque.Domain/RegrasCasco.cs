namespace ControleEstoque.Estoque.Domain;

/// <summary>Regras puras de casco; a venda com 'pagou o vasilhame' parte do casco resolvido daqui.</summary>
public static class RegrasCasco
{
    /// <summary>Casco do item: o específico da associação vence o genérico do produto. Descartável não tem casco.</summary>
    public static Guid? Resolver(Produto produto, ProdutoMarca associacao) =>
        produto.Tipo == TipoProduto.DESCARTAVEL ? null : associacao.TipoCascoId ?? produto.TipoCascoId;

    /// <summary>Quebra: sai do vazio do tipo e só entra na sucata do mesmo tipo se ele aceita sucata.</summary>
    public static IReadOnlyList<MovimentoCasco> MovimentosDaQuebra(int quantidade, bool aceitaSucata)
    {
        var movimentos = new List<MovimentoCasco>
        {
            new(SituacaoCasco.VAZIO, TipoMovimentoEstoque.BAIXA_QUEBRA, -quantidade)
        };
        if (aceitaSucata)
        {
            movimentos.Add(new(SituacaoCasco.SUCATA, TipoMovimentoEstoque.ENTRADA_SUCATA, quantidade));
        }

        return movimentos;
    }

    /// <summary>Perda: sai só do vazio do tipo e nunca entra na sucata.</summary>
    public static IReadOnlyList<MovimentoCasco> MovimentosDaPerda(int quantidade) =>
        [new(SituacaoCasco.VAZIO, TipoMovimentoEstoque.BAIXA_PERDA, -quantidade)];
}
