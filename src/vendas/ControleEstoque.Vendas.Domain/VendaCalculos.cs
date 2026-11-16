using ControleEstoque.Shared.Results;

namespace ControleEstoque.Vendas.Domain;

/// <summary>
/// Cálculo puro do agregado Venda: totais por item (com desconto VALOR ou
/// PERCENTUAL), vasilhames vendidos, desconto por sucata, totais da venda e status de pagamento.
/// O preço vem sempre do request (preço de referência é só sugestão de tela — regra crítica 4).
/// </summary>
public static class VendaCalculos
{
    public static TotaisVenda Calcular(
        IReadOnlyList<ItemVenda> itens, IReadOnlyList<VasilhameCalculado> vasilhames,
        IReadOnlyList<SucataVenda> sucata, IReadOnlyList<PagamentoVenda> pagamentos,
        Func<ItemVenda, ItemResolvido>? resolver = null)
    {
        if (itens.Count == 0 && vasilhames.Count == 0)
        {
            throw new RequestValidationException(
                "ITENS_OBRIGATORIOS", "Venda deve ter ao menos um item ou vasilhame.");
        }

        resolver ??= _ => new ItemResolvido(Guid.Empty, null); // só testes de cálculo puro chegam sem resolver
        var calculados = itens.Select(i => CalcularItem(i, resolver(i))).ToList();
        var totalBruto = calculados.Sum(i => i.TotalBruto) + vasilhames.Sum(v => v.Total);
        var descontoItens = calculados.Sum(i => i.ValorDesconto);
        var descontoSucata = DescontoSucata(sucata);

        // O desconto por sucata vale até o líquido que sobra depois do desconto dos itens.
        var liquidoAntesSucata = totalBruto - descontoItens;
        if (descontoSucata > liquidoAntesSucata)
        {
            throw new BusinessRuleException(
                "DESCONTO_SUCATA_EXCEDE_TOTAL",
                $"Desconto por sucata ({descontoSucata:F2}) excede o total da venda ({liquidoAntesSucata:F2}).");
        }

        var totalLiquido = liquidoAntesSucata - descontoSucata;

        foreach (var pagamento in pagamentos)
        {
            Validacao.EnumDefinido(pagamento.Forma, "Forma");
            if (pagamento.Valor <= 0)
            {
                throw new RequestValidationException(
                    "PAGAMENTO_INVALIDO", "Valor de pagamento deve ser positivo.");
            }
        }

        var usoCredito = UsoCredito(pagamentos);
        if (usoCredito > totalLiquido)
        {
            throw new BusinessRuleException(
                "CREDITO_EXCEDE_TOTAL",
                $"Uso de crédito ({usoCredito:F2}) excede o total líquido da venda ({totalLiquido:F2}).");
        }

        // Pagar a mais é permitido: a sobra vira crédito do cliente.
        var totalPago = pagamentos.Sum(p => p.Valor);
        var faltante = Math.Max(0m, totalLiquido - totalPago);
        var creditoGerado = Math.Max(0m, totalPago - totalLiquido);
        var status = CalcularStatus(totalLiquido, totalPago);
        return new TotaisVenda(
            calculados, totalBruto, descontoItens + descontoSucata, descontoSucata, totalLiquido,
            totalPago, faltante, creditoGerado, status);
    }

    /// <summary>
    /// Vasilhame do tipo com o crédito de galão do cliente (<paramref name="credito"/>, max(0, -saldo)):
    /// no modo ABATER_CREDITO os cobertos não são cobrados; no COMPRAR cobra tudo.
    /// </summary>
    public static VasilhameCalculado CalcularVasilhame(VasilhameVenda vasilhame, long credito)
    {
        if (vasilhame.Quantidade <= 0 || vasilhame.PrecoUnitario < 0)
        {
            throw new RequestValidationException(
                "VASILHAME_INVALIDO",
                $"Vasilhame do tipo {vasilhame.TipoCascoId} exige quantidade positiva e preço não negativo.");
        }

        Validacao.EnumDefinido(vasilhame.Modo, "ModoCredito");
        var abatida = vasilhame.Modo == ModoCreditoVasilhame.ABATER_CREDITO
            ? (int)Math.Min(vasilhame.Quantidade, Math.Max(0L, credito))
            : 0;
        return new VasilhameCalculado(
            vasilhame.TipoCascoId, vasilhame.Quantidade, abatida, vasilhame.PrecoUnitario, vasilhame.Modo,
            (vasilhame.Quantidade - abatida) * vasilhame.PrecoUnitario);
    }

    /// <summary>Soma de quantidade x valor unitário da sucata entregue na venda.</summary>
    public static decimal DescontoSucata(IEnumerable<SucataVenda> sucata) => sucata.Sum(s =>
    {
        if (s.Quantidade <= 0 || s.ValorUnitario < 0)
        {
            throw new RequestValidationException(
                "SUCATA_INVALIDA",
                $"Sucata do tipo {s.TipoCascoId} exige quantidade positiva e valor unitário não negativo.");
        }

        return s.Total;
    });

    /// <summary>Soma dos pagamentos na forma CREDITO_CLIENTE.</summary>
    public static decimal UsoCredito(IEnumerable<PagamentoVenda> pagamentos) =>
        pagamentos.Where(p => p.Forma == FormaPagamento.CREDITO_CLIENTE).Sum(p => p.Valor);

    /// <summary>O uso de crédito não pode passar do crédito disponível do cliente.</summary>
    public static void ValidarUsoCredito(decimal usoCredito, decimal creditoDisponivel)
    {
        if (usoCredito > creditoDisponivel)
        {
            throw new BusinessRuleException(
                "CREDITO_INSUFICIENTE",
                $"Uso de crédito de {usoCredito:F2} excede o crédito disponível de {creditoDisponivel:F2}.");
        }
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

        var bruto = item.Quantidade * item.PrecoUnitario;
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
            item.Quantidade, item.PrecoUnitario, item.Desconto,
            bruto, valorDesconto, bruto - valorDesconto);
    }
}
