using ControleEstoque.Clientes.Domain;

namespace ControleEstoque.Clientes.Contracts;

public sealed record CreateClienteRequest(string Nome, string? Telefone, string? Observacoes);

public sealed record CreateEnderecoRequest(
    string Logradouro,
    string? Numero,
    string? Bairro,
    string? Complemento,
    string? Referencia,
    bool Principal);

public sealed record EnderecoResponse(
    Guid Id,
    string Logradouro,
    string? Numero,
    string? Bairro,
    string? Complemento,
    string? Referencia,
    bool Principal)
{
    public static EnderecoResponse From(Endereco e) => new(
        e.Id, e.Logradouro, e.Numero, e.Bairro, e.Complemento, e.Referencia, e.Principal);
}

public sealed record ClienteResponse(
    Guid Id,
    string Nome,
    string? Telefone,
    string? Observacoes,
    IReadOnlyList<EnderecoResponse> Enderecos)
{
    public static ClienteResponse From(Cliente c) => new(
        c.Id, c.Nome, c.Telefone, c.Observacoes, c.Enderecos.Select(EnderecoResponse.From).ToList());
}

public sealed record CascoPorTipoResponse(Guid TipoCascoId, string Nome, long Saldo);

public sealed record SucataPorTipoResponse(Guid TipoCascoId, string Nome, long Quantidade);

public sealed record SaldosResponse(
    long SaldoCascos,
    long SucataEntregue,
    decimal SaldoFiado,
    IReadOnlyList<CascoPorTipoResponse> CascosPorTipo,
    IReadOnlyList<SucataPorTipoResponse> SucataPorTipo);

public sealed record DevolucaoCascosRequest(Guid TipoCascoId, int Quantidade);

public sealed record DevolucaoCascosResponse(long NovoSaldoCascos);

public sealed record ConversaoCascosRequest(Guid TipoCascoId, int Quantidade);

public sealed record ConversaoCascosResponse(long NovoSaldoCascos, decimal NovoSaldoFiado);

public sealed record EntregaSucataRequest(Guid TipoCascoId, int Quantidade, decimal? ValorConversao);

public sealed record EntregaSucataResponse(long TotalSucataEntregue, decimal NovoSaldoFiado);
