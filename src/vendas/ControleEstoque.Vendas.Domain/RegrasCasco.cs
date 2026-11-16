namespace ControleEstoque.Vendas.Domain;

/// <summary>Regra pura do casco do item; espelha Estoque.Domain.RegrasCasco sem referenciar aquele projeto.</summary>
public static class RegrasCasco
{
    /// <summary>Casco do item: o específico da associação vence o genérico do produto. Descartável não tem casco.</summary>
    public static Guid? Resolver(TipoProduto tipo, Guid? tipoCascoProduto, Guid? tipoCascoMarca) =>
        tipo == TipoProduto.DESCARTAVEL ? null : tipoCascoMarca ?? tipoCascoProduto;

    /// <summary>
    /// Perda ou quebra depois da conclusão; espelha Estoque.Domain.RegrasCasco.MovimentosDaQuebra. A saída é do
    /// produto+marca (cheio) ou do casco VAZIO (vazio); só a quebra de tipo que aceita sucata entra na SUCATA.
    /// </summary>
    public static IReadOnlyList<MovimentoPerda> MovimentosDaPerda(
        GalaoPerda galao, MotivoPerda motivo, int quantidade, bool aceitaSucata)
    {
        var saida = new MovimentoPerda(
            galao == GalaoPerda.CHEIO ? DestinoMovimento.PRODUTO : DestinoMovimento.CASCO,
            galao == GalaoPerda.CHEIO ? null : SituacaoCasco.VAZIO,
            motivo == MotivoPerda.QUEBRADO ? TipoMovimentoPerda.BAIXA_QUEBRA : TipoMovimentoPerda.BAIXA_PERDA,
            -quantidade);
        return motivo == MotivoPerda.QUEBRADO && aceitaSucata
            ? [saida, new MovimentoPerda(
                DestinoMovimento.CASCO, SituacaoCasco.SUCATA, TipoMovimentoPerda.ENTRADA_SUCATA, quantidade)]
            : [saida];
    }
}
