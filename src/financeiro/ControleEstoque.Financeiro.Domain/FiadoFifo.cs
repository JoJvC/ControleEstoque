namespace ControleEstoque.Financeiro.Domain;

/// <summary>Venda PENDENTE/PARCIAL do cliente, com o já pago (soma de venda_pagamentos).</summary>
public sealed record VendaPendente(Guid VendaId, DateTimeOffset Data, decimal TotalLiquido, decimal TotalPago);

public sealed record AbatimentoVenda(
    Guid VendaId, DateTimeOffset Data, decimal ValorAbatido, StatusPagamento NovoStatus, decimal Restante);

public sealed record DistribuicaoFiado(IReadOnlyList<AbatimentoVenda> Abatimentos, decimal Sobra);

public sealed record ResultadoPagamentoFiado(
    decimal NovoSaldoDevedor, IReadOnlyList<AbatimentoVenda> Abatimentos, decimal ValorEmCredito);

/// <summary>Espelha os rótulos de forma_pagamento do init.sql (conferidos em FormasEStatusInitSqlTests).</summary>
public enum FormaPagamento
{
    PIX,
    CARTAO_CREDITO,
    CARTAO_DEBITO,
    DINHEIRO,
    OUTRO,
    CREDITO_CLIENTE
}

/// <summary>Espelha os rótulos de status_pagamento_venda do init.sql (conferidos em FormasEStatusInitSqlTests).</summary>
public enum StatusPagamento
{
    PENDENTE,
    PARCIAL,
    PAGA
}

public static class FiadoFifo
{
    /// <summary>Espelha VendaCalculos.CalcularStatus do contexto Vendas (sem referenciar o outro contexto).</summary>
    public static StatusPagamento CalcularStatus(decimal totalLiquido, decimal totalPago) =>
        totalPago >= totalLiquido ? StatusPagamento.PAGA
        : totalPago > 0 ? StatusPagamento.PARCIAL
        : StatusPagamento.PENDENTE;

    /// <summary>
    /// Abate o valor recebido nas vendas da mais antiga para a mais nova (empate de data: ordem de entrada,
    /// que o SQL entrega por data e id). Venda sem restante é ignorada; só as atingidas voltam na lista.
    /// </summary>
    public static DistribuicaoFiado Distribuir(decimal valor, IReadOnlyList<VendaPendente> vendas)
    {
        var abatimentos = new List<AbatimentoVenda>();
        var sobra = valor;
        foreach (var venda in vendas.OrderBy(v => v.Data)) // OrderBy é estável
        {
            var restante = venda.TotalLiquido - venda.TotalPago;
            if (restante <= 0)
            {
                continue;
            }

            if (sobra <= 0)
            {
                break;
            }

            var abatido = Math.Min(restante, sobra);
            sobra -= abatido;
            abatimentos.Add(new AbatimentoVenda(
                venda.VendaId, venda.Data, abatido,
                CalcularStatus(venda.TotalLiquido, venda.TotalPago + abatido),
                restante - abatido));
        }

        return new DistribuicaoFiado(abatimentos, sobra);
    }

    /// <summary>
    /// Parte da sobra que de fato virou crédito: com outro débito no saldo (ex.: uso de crédito como pagamento),
    /// a sobra abate esse débito primeiro.
    /// </summary>
    public static decimal CreditoGerado(decimal sobra, decimal novoSaldo) =>
        Math.Min(sobra, Math.Max(0m, novoSaldo));
}
