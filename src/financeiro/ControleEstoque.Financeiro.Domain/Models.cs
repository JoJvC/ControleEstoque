namespace ControleEstoque.Financeiro.Domain;

public enum StatusCaixa
{
    ABERTO,
    FECHADO
}

public sealed record Caixa(
    Guid Id,
    DateOnly Data,
    StatusCaixa Status,
    decimal SaldoInicial,
    decimal? TotalEntradas,
    decimal? TotalSaidas,
    decimal? SaldoFinal,
    DateTimeOffset? FechadoEm);

public sealed record TipoDespesa(Guid Id, string Nome);

public sealed record Despesa(Guid Id, Guid TipoDespesaId, string TipoDespesaNome, decimal Valor, string? Descricao);

public sealed record ResumoCaixa(
    Caixa Caixa,
    decimal Entradas,
    decimal TotalDespesas,
    decimal SaldoParcial,
    IReadOnlyList<Despesa> Despesas);

/// <summary>Presença no fechamento; Valor nulo usa a diária do cadastro.</summary>
public sealed record DiariaFechamento(Guid FuncionarioId, decimal? Valor);

public sealed record ResultadoFechamento(
    Guid CaixaId,
    DateOnly Data,
    decimal TotalEntradas,
    decimal TotalSaidas,
    decimal SaldoFinal,
    int DiariasLancadas);

/// <summary>SaldoDevedor positivo = deve; Saldo é o inverso (negativo = fiado, positivo = crédito).</summary>
public sealed record SaldoFiadoCliente(Guid ClienteId, string Nome, decimal SaldoDevedor, decimal Saldo);

public sealed record TotalFiadoResponse(decimal TotalAReceber);

public sealed record DiaCaixa(
    DateOnly Data,
    StatusCaixa Status,
    decimal SaldoInicial,
    decimal Entradas,
    decimal Saidas,
    decimal? SaldoFinal);

public sealed record DespesaPorTipo(string TipoDespesa, decimal Total);

public sealed record RelatorioCaixa(
    IReadOnlyList<DiaCaixa> Dias,
    IReadOnlyList<DespesaPorTipo> DespesasPorTipo);
