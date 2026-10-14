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
/// e fiado (valor devedor em reais).
/// </summary>
public sealed record SaldosCliente(long SaldoCascos, long SucataEntregue, decimal SaldoFiado);

public sealed record ResultadoDevolucaoCasco(long NovoSaldoCascos);

public sealed record ResultadoConversaoCasco(long NovoSaldoCascos, decimal NovoSaldoFiado);

public sealed record ResultadoEntregaSucata(long TotalSucataEntregue, decimal NovoSaldoFiado);

public sealed record SaldoCascoRelatorio(Guid ClienteId, string Nome, long SaldoCascos);

public sealed record SucataEntregueRelatorio(Guid ClienteId, string Nome, long TotalEntregue);
