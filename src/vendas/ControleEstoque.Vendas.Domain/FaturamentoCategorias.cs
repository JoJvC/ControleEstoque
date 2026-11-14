namespace ControleEstoque.Vendas.Domain;

public static class FaturamentoCategorias
{
    /// <summary>Agrupa pela chave do tipo (DESCARTAVEL usa a categoria) e ordena por total desc, nome asc.</summary>
    public static IReadOnlyList<FaturamentoPorCategoria> Consolidar(
        IEnumerable<(TipoProduto Tipo, string? Categoria, long Quantidade, decimal Total)> linhas) =>
        linhas
            .GroupBy(l => Chave(l.Tipo, l.Categoria))
            .Select(g => new FaturamentoPorCategoria(g.Key, g.Sum(l => l.Quantidade), g.Sum(l => l.Total)))
            .OrderByDescending(c => c.TotalLiquido)
            .ThenBy(c => c.Categoria, StringComparer.Ordinal)
            .ToList();

    private static string Chave(TipoProduto tipo, string? categoria) => tipo switch
    {
        TipoProduto.AGUA or TipoProduto.GALAO_COMPLETO => "Água",
        TipoProduto.CASCO => "Casco",
        TipoProduto.SUCATA => "Sucata",
        _ => string.IsNullOrWhiteSpace(categoria) ? "Outros" : categoria.Trim(),
    };
}
