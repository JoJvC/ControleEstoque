using ControleEstoque.Shared.Results;

namespace ControleEstoque.Vendas.Domain;

/// <summary>
/// Cálculo puro do agregado Venda: totais por item (com desconto VALOR ou
/// PERCENTUAL), totais da venda e status de pagamento. O preço vem sempre do
/// request (preço de referência é só sugestão de tela — regra crítica 4); o preço do vasilhame, quando o
/// cliente pagou, vem do tipo de casco resolvido pelo serviço (<paramref name="resolver"/>), nunca do request.
/// </summary>
public static class VendaCalculos
{
    public static TotaisVenda Calcular(
        IReadOnlyList<ItemVenda> itens, IReadOnlyList<PagamentoVenda> pagamentos,
        Func<ItemVenda, ItemResolvido>? resolver = null)
    {
        if (itens.Count == 0)
        {
            throw new RequestValidationException("ITENS_OBRIGATORIOS", "Venda deve ter ao menos um item.");
        }

        resolver ??= _ => new ItemResolvido(Guid.Empty, null, 0m); // só testes de cálculo puro chegam sem resolver
        var calculados = itens.Select(i => CalcularItem(i, resolver(i))).ToList();
        var totalBruto = calculados.Sum(i => i.TotalBruto);
        var totalDesconto = calculados.Sum(i => i.ValorDesconto);
        var totalLiquido = calculados.Sum(i => i.TotalItem);

        foreach (var pagamento in pagamentos)
        {
            Validacao.EnumDefinido(pagamento.Forma, "Forma");
            if (pagamento.Valor <= 0)
            {
                throw new RequestValidationException(
                    "PAGAMENTO_INVALIDO", "Valor de pagamento deve ser positivo.");
            }
        }

        var totalPago = pagamentos.Sum(p => p.Valor);
        if (totalPago > totalLiquido)
        {
            throw new RequestValidationException(
                "PAGAMENTO_EXCEDE_TOTAL",
                $"Pagamentos ({totalPago:F2}) excedem o total líquido da venda ({totalLiquido:F2}).");
        }

        var faltante = totalLiquido - totalPago;
        var status = CalcularStatus(totalLiquido, totalPago);
        return new TotaisVenda(calculados, totalBruto, totalDesconto, totalLiquido, totalPago, faltante, status);
    }

    public static StatusPagamento CalcularStatus(decimal totalLiquido, decimal totalPago) =>
        totalPago >= totalLiquido ? StatusPagamento.PAGA
        : totalPago > 0 ? StatusPagamento.PARCIAL
        : StatusPagamento.PENDENTE;

    private static ItemCalculado CalcularItem(ItemVenda item, ItemResolvido resolvido)
    {
        if (item.Quantidade <= 0)
        {
            throw new RequestValidationException(
                "QUANTIDADE_INVALIDA", $"Quantidade inválida para o produto {item.ProdutoId}.");
        }

        if (item.PrecoUnitario < 0)
        {
            throw new RequestValidationException(
                "PRECO_INVALIDO", $"Preço unitário inválido para o produto {item.ProdutoId}.");
        }

        decimal? precoVasilhame = item.PagouVasilhame ? resolvido.PrecoVasilhame : null;
        var bruto = item.Quantidade * item.PrecoUnitario + item.Quantidade * (precoVasilhame ?? 0m);
        var valorDesconto = 0m;

        if (item.Desconto is { } desconto)
        {
            if (string.IsNullOrWhiteSpace(desconto.Motivo))
            {
                throw new RequestValidationException(
                    "DESCONTO_SEM_MOTIVO", "Todo desconto deve ter um motivo informado.");
            }

            if (desconto.Valor <= 0)
            {
                throw new RequestValidationException("DESCONTO_INVALIDO", "Valor do desconto deve ser positivo.");
            }

            Validacao.EnumDefinido(desconto.Tipo, "Tipo");
            valorDesconto = desconto.Tipo switch
            {
                TipoDesconto.PERCENTUAL when desconto.Valor > 100 =>
                    throw new RequestValidationException(
                        "DESCONTO_INVALIDO", "Desconto percentual não pode exceder 100%."),
                TipoDesconto.PERCENTUAL =>
                    Math.Round(bruto * desconto.Valor / 100m, 2, MidpointRounding.AwayFromZero),
                _ => desconto.Valor
            };

            if (valorDesconto > bruto)
            {
                throw new RequestValidationException(
                    "DESCONTO_MAIOR_QUE_ITEM", "Desconto não pode exceder o valor bruto do item.");
            }
        }

        return new ItemCalculado(
            item.ProdutoId, item.MarcaId, resolvido.ProdutoMarcaId, resolvido.TipoCascoId,
            item.Quantidade, item.PrecoUnitario, item.Desconto, item.PagouVasilhame, precoVasilhame,
            bruto, valorDesconto, bruto - valorDesconto);
    }
}
