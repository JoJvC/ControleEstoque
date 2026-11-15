namespace ControleEstoque.Clientes.Domain;

public static class SaldosCascos
{
    /// <summary>Cascos na rua: soma dos saldos positivos (cliente deve cascos). Saldo negativo não abate.</summary>
    public static long TotalNaRua(IEnumerable<long> saldos) => saldos.Where(s => s > 0).Sum();

    /// <summary>
    /// Saldos do cliente a partir das linhas por tipo: só tipos de saldo ≠ 0 (casco) e
    /// quantidade > 0 (sucata), ordenados por nome; os totais são a soma das listas.
    /// </summary>
    public static SaldosCliente Montar(
        IEnumerable<SaldoCascoPorTipo> cascos, IEnumerable<SucataPorTipo> sucata, decimal saldoFiado)
    {
        var cascosPorTipo = cascos.Where(c => c.Saldo != 0)
            .OrderBy(c => c.Nome, StringComparer.CurrentCulture).ToList();
        var sucataPorTipo = sucata.Where(s => s.Quantidade > 0)
            .OrderBy(s => s.Nome, StringComparer.CurrentCulture).ToList();
        return new SaldosCliente(
            cascosPorTipo.Sum(c => c.Saldo), sucataPorTipo.Sum(s => s.Quantidade), saldoFiado,
            cascosPorTipo, sucataPorTipo);
    }
}
