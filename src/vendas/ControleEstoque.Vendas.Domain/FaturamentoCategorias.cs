namespace ControleEstoque.Vendas.Domain;

public static class FaturamentoCategorias
{
    /// <summary>Agrupa pela categoria aparada (vazia ou nula vira 'Outros') e ordena por total desc, nome asc.</summary>
    public static IReadOnlyList<FaturamentoPorCategoria> Consolidar(
        IEnumerable<(string? Categoria, long Quantidade, decimal Total)> linhas) =>
        linhas
            .GroupBy(l => Chave(l.Categoria))
            .Select(g => new FaturamentoPorCategoria(g.Key, g.Sum(l => l.Quantidade), g.Sum(l => l.Total)))
            .OrderByDescending(c => c.TotalLiquido)
            .ThenBy(c => c.Categoria, StringComparer.Ordinal)
            .ToList();

    private static string Chave(string? categoria) =>
        string.IsNullOrWhiteSpace(categoria) ? "Outros" : categoria.Trim();
}
