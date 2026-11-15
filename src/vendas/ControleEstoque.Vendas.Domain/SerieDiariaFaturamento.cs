namespace ControleEstoque.Vendas.Domain;

public static class SerieDiariaFaturamento
{
    /// <summary>União dos dias das três fontes, em ordem crescente; valor ausente vira 0.</summary>
    public static IReadOnlyList<FaturamentoPorDia> Montar(
        IReadOnlyDictionary<DateOnly, decimal> liquidoPorDia,
        IReadOnlyDictionary<DateOnly, decimal> recebidoPorDia,
        IReadOnlyDictionary<DateOnly, decimal> fiadoPorDia) =>
        liquidoPorDia.Keys.Concat(recebidoPorDia.Keys).Concat(fiadoPorDia.Keys)
            .Distinct()
            .Order()
            .Select(dia => new FaturamentoPorDia(
                dia,
                liquidoPorDia.GetValueOrDefault(dia),
                recebidoPorDia.GetValueOrDefault(dia),
                fiadoPorDia.GetValueOrDefault(dia)))
            .ToList();
}
