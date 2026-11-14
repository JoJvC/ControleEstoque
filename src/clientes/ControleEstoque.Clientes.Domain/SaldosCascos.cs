namespace ControleEstoque.Clientes.Domain;

public static class SaldosCascos
{
    /// <summary>Cascos na rua: soma dos saldos positivos (cliente deve cascos). Saldo negativo não abate.</summary>
    public static long TotalNaRua(IEnumerable<long> saldos) => saldos.Where(s => s > 0).Sum();
}
