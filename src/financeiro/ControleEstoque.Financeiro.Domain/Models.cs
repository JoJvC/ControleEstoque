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
    DateTimeOffset? FechadoEm,
    bool FechadoPeloSistema = false,
    bool DiariasPendentes = false);

public sealed record CaixaDiariasPendentes(Guid Id, DateOnly Data);

public sealed record TipoDespesa(Guid Id, string Nome);

public sealed record Despesa(
    Guid Id, Guid TipoDespesaId, string TipoDespesaNome, decimal Valor, string? Descricao,
    DateTimeOffset Hora = default);

public sealed record ResumoCaixa(
    Caixa Caixa,
    decimal Entradas,
    decimal TotalDespesas,
    decimal SaldoParcial,
    IReadOnlyList<Despesa> Despesas,
    IReadOnlyList<CaixaDiariasPendentes> CaixasComDiariasPendentes);

/// <summary>Presença no fechamento; Valor nulo usa a diária do cadastro.</summary>
public sealed record DiariaFechamento(Guid FuncionarioId, decimal? Valor);

public sealed record ResultadoFechamento(
    Guid CaixaId,
    DateOnly Data,
    decimal TotalEntradas,
    decimal TotalSaidas,
    decimal SaldoFinal,
    int DiariasLancadas,
    decimal DinheiroNaGaveta);

public sealed record ResultadoLancamentoDiarias(Guid CaixaId, DateOnly Data, int DiariasLancadas);

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

public enum OrigemEntrada
{
    VENDA,
    RECEBIMENTO_FIADO
}

public sealed record PessoaCaixa(Guid Id, string Nome);

public sealed record EntradaCaixa(
    DateTimeOffset Hora, OrigemEntrada Origem, Guid ClienteId, string ClienteNome,
    FormaPagamento Forma, decimal Valor);

public sealed record SaidaCaixa(DateTimeOffset Hora, string Descricao, FormaPagamento Forma, decimal Valor);

public sealed record DiariaLancada(Guid FuncionarioId, string FuncionarioNome, decimal Valor, DateTimeOffset Hora);

public sealed record TotalPorForma(FormaPagamento Forma, decimal Valor);

/// <summary>Quem abriu/fechou o caixa, como o repositório grava (created_by, created_at, fechado_por).</summary>
public sealed record AuditoriaCaixa(PessoaCaixa? AbertoPor, DateTimeOffset AbertoEm, PessoaCaixa? FechadoPor);

public sealed record TotaisCaixa(decimal Entradas, decimal Saidas, decimal SaldoFinal, decimal DinheiroNaGaveta);

public sealed record ItemListaCaixa(Caixa Caixa, TotaisCaixa Totais);

public sealed record DetalheCaixa(
    Caixa Caixa,
    TotaisCaixa Totais,
    IReadOnlyList<EntradaCaixa> Entradas,
    IReadOnlyList<SaidaCaixa> Saidas,
    IReadOnlyList<TotalPorForma> TotaisPorForma,
    IReadOnlyList<DiariaLancada> Diarias,
    AuditoriaCaixa Auditoria);
