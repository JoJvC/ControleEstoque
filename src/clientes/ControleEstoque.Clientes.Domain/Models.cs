namespace ControleEstoque.Clientes.Domain;

public sealed record Endereco(
    Guid Id,
    Guid ClienteId,
    string Logradouro,
    string? Numero,
    string? Bairro,
    string? Complemento,
    string? Referencia,
    bool Principal);

public sealed record Cliente(
    Guid Id,
    string Nome,
    string? Telefone,
    string? Observacoes,
    IReadOnlyList<Endereco> Enderecos);

/// <summary>
/// Os três saldos do cliente são independentes entre si:
/// casco normal (unidades devidas), sucata (unidades entregues — não é débito)
/// e fiado (valor devedor em reais). Casco e sucata são por tipo de casco;
/// os totais são a soma das listas. Saldo é o inverso de SaldoFiado (negativo = fiado,
/// positivo = crédito); CreditoDisponivel = max(0, Saldo).
/// </summary>
public sealed record SaldosCliente(
    long SaldoCascos,
    long SucataEntregue,
    decimal SaldoFiado,
    decimal Saldo,
    decimal CreditoDisponivel,
    IReadOnlyList<SaldoCascoPorTipo> CascosPorTipo,
    IReadOnlyList<SucataPorTipo> SucataPorTipo);

public sealed record SaldoCascoPorTipo(Guid TipoCascoId, string Nome, long Saldo);

public sealed record SucataPorTipo(Guid TipoCascoId, string Nome, long Quantidade);

/// <summary>Tipo de casco como o Clientes o enxerga: só o que a devolução, a conversão e a sucata usam.</summary>
public sealed record TipoCascoCliente(Guid Id, string Nome, bool AceitaSucata, decimal PrecoVasilhame);

public sealed record ResultadoDevolucaoCasco(long NovoSaldoCascos);

public sealed record ResultadoConversaoCasco(long NovoSaldoCascos, decimal NovoSaldoFiado)
{
    /// <summary>Saldo único do cliente (negativo = fiado, positivo = crédito).</summary>
    public decimal NovoSaldo => 0m - NovoSaldoFiado;
}

public sealed record ResultadoEntregaSucata(long TotalSucataEntregue, decimal NovoSaldoFiado)
{
    /// <summary>Saldo único do cliente (negativo = fiado, positivo = crédito).</summary>
    public decimal NovoSaldo => 0m - NovoSaldoFiado;
}

public sealed record SaldoCascoRelatorio(Guid ClienteId, string Nome, long SaldoCascos);

public sealed record TotalCascosRelatorio(long TotalCascos);

public sealed record SucataEntregueRelatorio(Guid ClienteId, string Nome, long TotalEntregue);
