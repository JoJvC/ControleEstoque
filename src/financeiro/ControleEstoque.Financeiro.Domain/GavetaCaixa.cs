namespace ControleEstoque.Financeiro.Domain;

/// <summary>Contas do caixa em função pura: o fechamento (manual e do sistema), a lista e o detalhe usam estas.</summary>
public static class GavetaCaixa
{
    /// <summary>
    /// Saldo inicial + entradas em DINHEIRO (venda e recebimento de fiado) − despesas (todas em DINHEIRO).
    /// PIX, cartões, OUTRO e CREDITO_CLIENTE não entram; diária não sai do caixa (regra crítica 7).
    /// </summary>
    public static decimal DinheiroEsperado(
        decimal saldoInicial, IEnumerable<EntradaCaixa> entradas, decimal despesas) =>
        saldoInicial + entradas.Where(e => e.Forma == FormaPagamento.DINHEIRO).Sum(e => e.Valor) - despesas;

    /// <summary>Totais do caixa aberto, calculados na hora; <paramref name="despesas"/> é a soma das despesas.</summary>
    public static TotaisCaixa Totais(
        decimal saldoInicial, IReadOnlyList<EntradaCaixa> entradas, decimal despesas)
    {
        var total = entradas.Sum(e => e.Valor);
        return new TotaisCaixa(
            total, despesas, saldoInicial + total - despesas,
            DinheiroEsperado(saldoInicial, entradas, despesas));
    }

    /// <summary>Caixa fechado mostra os valores gravados; aberto, os calculados na hora.</summary>
    public static TotaisCaixa TotaisDo(
        Caixa caixa, IReadOnlyList<EntradaCaixa> entradas, IReadOnlyList<Despesa> despesas)
    {
        var saidas = despesas.Sum(d => d.Valor);
        var calculados = Totais(caixa.SaldoInicial, entradas, saidas);
        return caixa.Status == StatusCaixa.FECHADO
            ? calculados with
            {
                Entradas = caixa.TotalEntradas ?? calculados.Entradas,
                Saidas = caixa.TotalSaidas ?? calculados.Saidas,
                SaldoFinal = caixa.SaldoFinal ?? calculados.SaldoFinal
            }
            : calculados;
    }

    public static DetalheCaixa Detalhe(
        Caixa caixa, IReadOnlyList<EntradaCaixa> entradas, IReadOnlyList<Despesa> despesas,
        IReadOnlyList<DiariaLancada> diarias, AuditoriaCaixa auditoria) => new(
        caixa,
        TotaisDo(caixa, entradas, despesas),
        entradas.OrderBy(e => e.Hora).ToList(),
        despesas.OrderBy(d => d.Hora)
            .Select(d => new SaidaCaixa(
                d.Hora,
                string.IsNullOrWhiteSpace(d.Descricao) ? d.TipoDespesaNome : $"{d.TipoDespesaNome} - {d.Descricao}",
                FormaPagamento.DINHEIRO, d.Valor)).ToList(),
        entradas.GroupBy(e => e.Forma).Select(g => new TotalPorForma(g.Key, g.Sum(e => e.Valor)))
            .OrderBy(t => t.Forma).ToList(),
        diarias.OrderBy(d => d.Hora).ToList(),
        auditoria);
}
