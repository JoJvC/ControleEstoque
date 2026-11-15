namespace ControleEstoque.Vendas.Domain;

/// <summary>Regra pura do casco do item; espelha Estoque.Domain.RegrasCasco sem referenciar aquele projeto.</summary>
public static class RegrasCasco
{
    /// <summary>Casco do item: o específico da associação vence o genérico do produto. Descartável não tem casco.</summary>
    public static Guid? Resolver(TipoProduto tipo, Guid? tipoCascoProduto, Guid? tipoCascoMarca) =>
        tipo == TipoProduto.DESCARTAVEL ? null : tipoCascoMarca ?? tipoCascoProduto;
}
