namespace ControleEstoque.Financeiro.Domain;

public static class SaldoCliente
{
    /// <summary>Fiado a receber: soma |saldo| só dos saldos negativos (fiado); crédito não abate.</summary>
    public static decimal FiadoAReceber(IEnumerable<decimal> saldos) =>
        saldos.Where(saldo => saldo < 0).Sum(saldo => -saldo);
}
