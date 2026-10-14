using ControleEstoque.Financeiro.Domain;

namespace ControleEstoque.Financeiro.Contracts;

public sealed record AbrirCaixaRequest(DateOnly? Data, decimal SaldoInicial);

public sealed record CaixaResponse(
    Guid Id,
    DateOnly Data,
    StatusCaixa Status,
    decimal SaldoInicial,
    decimal? TotalEntradas,
    decimal? TotalSaidas,
    decimal? SaldoFinal)
{
    public static CaixaResponse From(Caixa c) => new(
        c.Id, c.Data, c.Status, c.SaldoInicial, c.TotalEntradas, c.TotalSaidas, c.SaldoFinal);
}

public sealed record DespesaResponse(Guid Id, Guid TipoDespesaId, string TipoDespesa, decimal Valor, string? Descricao);

public sealed record ResumoCaixaResponse(
    CaixaResponse Caixa,
    decimal Entradas,
    decimal TotalDespesas,
    decimal SaldoParcial,
    IReadOnlyList<DespesaResponse> Despesas)
{
    public static ResumoCaixaResponse From(ResumoCaixa r) => new(
        CaixaResponse.From(r.Caixa), r.Entradas, r.TotalDespesas, r.SaldoParcial,
        r.Despesas.Select(d =>
            new DespesaResponse(d.Id, d.TipoDespesaId, d.TipoDespesaNome, d.Valor, d.Descricao)).ToList());
}

public sealed record CreateDespesaRequest(Guid TipoDespesaId, decimal Valor, string? Descricao);

public sealed record DiariaFechamentoRequest(Guid FuncionarioId);

public sealed record FecharCaixaRequest(List<DiariaFechamentoRequest>? Diarias);

public sealed record FechamentoResponse(
    Guid CaixaId,
    DateOnly Data,
    decimal TotalEntradas,
    decimal TotalSaidas,
    decimal SaldoFinal,
    int DiariasLancadas);

public sealed record CreateTipoDespesaRequest(string Nome);

public sealed record TipoDespesaResponse(Guid Id, string Nome);

public sealed record PagamentoFiadoRequest(decimal Valor, string? Forma);

public sealed record PagamentoFiadoResponse(decimal NovoSaldoFiado);
