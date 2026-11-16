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

public sealed record CaixaDiariasPendentesResponse(Guid Id, DateOnly Data);

public sealed record ResumoCaixaResponse(
    CaixaResponse Caixa,
    decimal Entradas,
    decimal TotalDespesas,
    decimal SaldoParcial,
    IReadOnlyList<DespesaResponse> Despesas,
    IReadOnlyList<CaixaDiariasPendentesResponse> CaixasComDiariasPendentes)
{
    public static ResumoCaixaResponse From(ResumoCaixa r) => new(
        CaixaResponse.From(r.Caixa), r.Entradas, r.TotalDespesas, r.SaldoParcial,
        r.Despesas.Select(d =>
            new DespesaResponse(d.Id, d.TipoDespesaId, d.TipoDespesaNome, d.Valor, d.Descricao)).ToList(),
        r.CaixasComDiariasPendentes.Select(c => new CaixaDiariasPendentesResponse(c.Id, c.Data)).ToList());
}

public sealed record CreateDespesaRequest(Guid TipoDespesaId, decimal Valor, string? Descricao);

public sealed record DiariaFechamentoRequest(Guid FuncionarioId, decimal? Valor = null);

public sealed record FecharCaixaRequest(List<DiariaFechamentoRequest>? Diarias);

public sealed record FechamentoResponse(
    Guid CaixaId,
    DateOnly Data,
    decimal TotalEntradas,
    decimal TotalSaidas,
    decimal SaldoFinal,
    int DiariasLancadas,
    decimal DinheiroNaGaveta);

public sealed record LancarDiariasRequest(List<DiariaFechamentoRequest>? Diarias);

public sealed record LancamentoDiariasResponse(Guid CaixaId, DateOnly Data, int DiariasLancadas);

public sealed record CreateTipoDespesaRequest(string Nome);

public sealed record TipoDespesaResponse(Guid Id, string Nome);

public sealed record PagamentoFiadoRequest(decimal Valor, string? Forma);

public sealed record VendaAbatidaResponse(
    Guid VendaId, DateTimeOffset Data, decimal ValorAbatido, string NovoStatus, decimal Restante);

public sealed record PagamentoFiadoResponse(
    decimal NovoSaldoFiado, decimal NovoSaldo,
    IReadOnlyList<VendaAbatidaResponse> VendasAbatidas, decimal ValorEmCredito);

public sealed record ItemListaCaixaResponse(
    Guid Id,
    DateOnly Data,
    StatusCaixa Status,
    bool FechadoPeloSistema,
    bool DiariasPendentes,
    decimal SaldoInicial,
    decimal TotalEntradas,
    decimal TotalSaidas,
    decimal SaldoFinal,
    decimal DinheiroNaGaveta)
{
    public static ItemListaCaixaResponse From(ItemListaCaixa i) => new(
        i.Caixa.Id, i.Caixa.Data, i.Caixa.Status, i.Caixa.FechadoPeloSistema, i.Caixa.DiariasPendentes,
        i.Caixa.SaldoInicial, i.Totais.Entradas, i.Totais.Saidas, i.Totais.SaldoFinal, i.Totais.DinheiroNaGaveta);
}

public sealed record PessoaCaixaResponse(Guid Id, string Nome);

public sealed record EntradaCaixaResponse(
    DateTimeOffset Hora, OrigemEntrada Origem, Guid ClienteId, string ClienteNome,
    FormaPagamento Forma, decimal Valor);

public sealed record SaidaCaixaResponse(DateTimeOffset Hora, string Descricao, FormaPagamento Forma, decimal Valor);

public sealed record TotalPorFormaResponse(FormaPagamento Forma, decimal Valor);

public sealed record DiariaLancadaResponse(Guid FuncionarioId, string FuncionarioNome, decimal Valor, DateTimeOffset Hora);

public sealed record DiariasDetalheResponse(IReadOnlyList<DiariaLancadaResponse> Lancadas, bool Pendentes);

public sealed record AberturaCaixaResponse(PessoaCaixaResponse? Por, DateTimeOffset Em);

public sealed record FechamentoCaixaResponse(DateTimeOffset? Em, bool PelaSistema, PessoaCaixaResponse? Por);

public sealed record DetalheCaixaResponse(
    Guid Id,
    DateOnly Data,
    StatusCaixa Status,
    decimal SaldoInicial,
    IReadOnlyList<EntradaCaixaResponse> Entradas,
    IReadOnlyList<SaidaCaixaResponse> Saidas,
    IReadOnlyList<TotalPorFormaResponse> TotaisPorForma,
    decimal TotalEntradas,
    decimal TotalSaidas,
    decimal SaldoFinal,
    decimal DinheiroNaGaveta,
    DiariasDetalheResponse Diarias,
    AberturaCaixaResponse Abertura,
    FechamentoCaixaResponse? Fechamento)
{
    public static DetalheCaixaResponse From(DetalheCaixa d)
    {
        static PessoaCaixaResponse? Pessoa(PessoaCaixa? p) => p is null ? null : new(p.Id, p.Nome);
        var c = d.Caixa;
        return new(
            c.Id, c.Data, c.Status, c.SaldoInicial,
            d.Entradas.Select(e => new EntradaCaixaResponse(
                e.Hora, e.Origem, e.ClienteId, e.ClienteNome, e.Forma, e.Valor)).ToList(),
            d.Saidas.Select(s => new SaidaCaixaResponse(s.Hora, s.Descricao, s.Forma, s.Valor)).ToList(),
            d.TotaisPorForma.Select(t => new TotalPorFormaResponse(t.Forma, t.Valor)).ToList(),
            d.Totais.Entradas, d.Totais.Saidas, d.Totais.SaldoFinal, d.Totais.DinheiroNaGaveta,
            new DiariasDetalheResponse(
                d.Diarias.Select(x => new DiariaLancadaResponse(
                    x.FuncionarioId, x.FuncionarioNome, x.Valor, x.Hora)).ToList(),
                c.DiariasPendentes),
            new AberturaCaixaResponse(Pessoa(d.Auditoria.AbertoPor), d.Auditoria.AbertoEm),
            c.Status == StatusCaixa.FECHADO
                ? new FechamentoCaixaResponse(c.FechadoEm, c.FechadoPeloSistema, Pessoa(d.Auditoria.FechadoPor))
                : null);
    }
}
