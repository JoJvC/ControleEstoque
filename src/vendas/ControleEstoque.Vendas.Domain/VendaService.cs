using ControleEstoque.Shared.Results;

namespace ControleEstoque.Vendas.Domain;

public interface IVendaService
{
    Task<ResultadoVenda> CriarAsync(NovaVenda venda, CancellationToken cancellationToken);
    Task<ResultadoVenda> EditarAsync(Guid vendaId, NovaVenda venda, CancellationToken cancellationToken);
    Task<Venda> ObterAsync(Guid vendaId, CancellationToken cancellationToken);
    Task<IReadOnlyList<Venda>> ListarAsync(
        Guid? clienteId, DateOnly? inicio, DateOnly? fim, int page, int pageSize,
        CancellationToken cancellationToken);
    Task<ResultadoVenda> AdicionarPagamentoAsync(
        Guid vendaId, FormaPagamento forma, decimal valor, CancellationToken cancellationToken);
    Task<CupomFiscal> EmitirCupomAsync(Guid vendaId, CancellationToken cancellationToken);
}

public sealed class VendaService : IVendaService
{
    private readonly IVendaRepository vendas;
    private readonly IVendaLookup lookup;
    private readonly ICupomFiscalRepository cupons;

    public VendaService(IVendaRepository vendas, IVendaLookup lookup, ICupomFiscalRepository cupons)
    {
        this.vendas = vendas;
        this.lookup = lookup;
        this.cupons = cupons;
    }

    public async Task<ResultadoVenda> CriarAsync(NovaVenda venda, CancellationToken cancellationToken)
    {
        var gravacao = await MontarGravacaoAsync(Guid.NewGuid(), venda, cancellationToken);
        var saldoCasco = await vendas.CriarAsync(gravacao, cancellationToken);
        return ToResultado(gravacao, saldoCasco);
    }

    public async Task<ResultadoVenda> EditarAsync(
        Guid vendaId, NovaVenda venda, CancellationToken cancellationToken)
    {
        if (!await vendas.ExisteAsync(vendaId, cancellationToken))
        {
            throw new EntityNotFoundException("VENDA_NAO_ENCONTRADA", $"Venda {vendaId} não encontrada.");
        }

        // Decisão MVP: venda com cupom fiscal emitido não pode mais ser editada.
        if (await cupons.JaEmitidoAsync(vendaId, cancellationToken))
        {
            throw new BusinessRuleException(
                "VENDA_JA_FATURADA", "Venda com cupom fiscal emitido não pode ser editada.");
        }

        var gravacao = await MontarGravacaoAsync(vendaId, venda, cancellationToken);
        var saldoCasco = await vendas.EditarAsync(gravacao, cancellationToken);
        return ToResultado(gravacao, saldoCasco);
    }

    public async Task<Venda> ObterAsync(Guid vendaId, CancellationToken cancellationToken)
        => await vendas.GetAsync(vendaId, cancellationToken)
            ?? throw new EntityNotFoundException("VENDA_NAO_ENCONTRADA", $"Venda {vendaId} não encontrada.");

    public Task<IReadOnlyList<Venda>> ListarAsync(
        Guid? clienteId, DateOnly? inicio, DateOnly? fim, int page, int pageSize,
        CancellationToken cancellationToken)
        => vendas.ListAsync(clienteId, inicio, fim, Math.Max(1, page), Math.Clamp(pageSize, 1, 200),
            cancellationToken);

    public async Task<ResultadoVenda> AdicionarPagamentoAsync(
        Guid vendaId, FormaPagamento forma, decimal valor, CancellationToken cancellationToken)
    {
        if (valor <= 0)
        {
            throw new RequestValidationException("PAGAMENTO_INVALIDO", "Valor de pagamento deve ser positivo.");
        }

        var info = await vendas.GetInfoPagamentoAsync(vendaId, cancellationToken)
            ?? throw new EntityNotFoundException("VENDA_NAO_ENCONTRADA", $"Venda {vendaId} não encontrada.");

        if (info.TotalPago + valor > info.TotalLiquido)
        {
            throw new BusinessRuleException(
                "PAGAMENTO_EXCEDE_SALDO",
                $"Pagamento de {valor:F2} excede o saldo restante de {info.TotalLiquido - info.TotalPago:F2}.");
        }

        var novoStatus = VendaCalculos.CalcularStatus(info.TotalLiquido, info.TotalPago + valor);

        // O pagamento abate o débito de fiado gerado por esta venda, limitado ao restante.
        var abatimentoFiado = Math.Min(valor, info.DebitoFiadoRestante);
        await vendas.AddPagamentoAsync(vendaId, forma, valor, abatimentoFiado, novoStatus, cancellationToken);

        var venda = await ObterAsync(vendaId, cancellationToken);
        var saldoCasco = await vendas.GetSaldoCascoClienteAsync(venda.ClienteId, cancellationToken);
        return new ResultadoVenda(
            venda.Id, venda.TotalBruto, venda.TotalDesconto, venda.TotalLiquido,
            info.TotalPago + valor, info.TotalLiquido - info.TotalPago - valor, novoStatus, saldoCasco);
    }

    public async Task<CupomFiscal> EmitirCupomAsync(Guid vendaId, CancellationToken cancellationToken)
    {
        if (!await vendas.ExisteAsync(vendaId, cancellationToken))
        {
            throw new EntityNotFoundException("VENDA_NAO_ENCONTRADA", $"Venda {vendaId} não encontrada.");
        }

        if (await cupons.JaEmitidoAsync(vendaId, cancellationToken))
        {
            throw new ConflictException("CUPOM_JA_EMITIDO", "Cupom fiscal já emitido para esta venda.");
        }

        return await cupons.EmitirAsync(vendaId, cancellationToken);
    }

    /// <summary>Valida o comando, resolve lookups e monta o modelo de gravação com os 8 efeitos.</summary>
    private async Task<VendaGravacao> MontarGravacaoAsync(
        Guid vendaId, NovaVenda venda, CancellationToken cancellationToken)
    {
        if (venda.CascosDevolvidos < 0 || venda.SucataEntregue < 0)
        {
            throw new RequestValidationException(
                "QUANTIDADE_INVALIDA", "Devoluções e entregas não podem ser negativas.");
        }

        var totais = VendaCalculos.Calcular(venda.Itens, venda.Pagamentos);

        if (!await lookup.ClienteExisteAsync(venda.ClienteId, cancellationToken))
        {
            throw new EntityNotFoundException(
                "CLIENTE_NAO_ENCONTRADO", $"Cliente {venda.ClienteId} não encontrado.");
        }

        if (!await lookup.FuncionarioExisteAsync(venda.FuncionarioId, cancellationToken))
        {
            throw new EntityNotFoundException(
                "FUNCIONARIO_NAO_ENCONTRADO", $"Funcionário {venda.FuncionarioId} não encontrado.");
        }

        if (venda.EnderecoEntregaId is { } enderecoId
            && !await lookup.EnderecoPertenceAoClienteAsync(enderecoId, venda.ClienteId, cancellationToken))
        {
            throw new BusinessRuleException(
                "ENDERECO_NAO_PERTENCE_AO_CLIENTE", "Endereço de entrega não pertence ao cliente.");
        }

        var produtoIds = totais.Itens.Select(i => i.ProdutoId).Distinct().ToList();
        var produtos = await lookup.GetProdutosAsync(produtoIds, cancellationToken);
        foreach (var produtoId in produtoIds)
        {
            if (!produtos.ContainsKey(produtoId))
            {
                throw new EntityNotFoundException(
                    "PRODUTO_NAO_ENCONTRADO", $"Produto {produtoId} não encontrado.");
            }
        }

        foreach (var grupo in totais.Itens.GroupBy(i => i.ProdutoId))
        {
            var quantidade = grupo.Sum(i => i.Quantidade);
            var saldo = await lookup.GetSaldoEstoqueAsync(grupo.Key, cancellationToken);
            if (saldo < quantidade)
            {
                throw new InsufficientStockException(
                    $"Estoque de '{produtos[grupo.Key].Nome}' ({saldo}) insuficiente para vender {quantidade}.");
            }
        }

        // Regra crítica 1: apenas itens de AGUA emprestam casco NORMAL.
        // GALAO_COMPLETO é propriedade do cliente e não gera débito; sucata nunca é emprestada.
        var aguaVendida = totais.Itens
            .Where(i => produtos[i.ProdutoId].Tipo == TipoProduto.AGUA)
            .Sum(i => i.Quantidade);

        var cascosDevolvidos = venda.CascosDevolvidosNaHora ? aguaVendida : venda.CascosDevolvidos;

        Guid? cascoProdutoId = null;
        if (cascosDevolvidos > 0)
        {
            cascoProdutoId = await lookup.GetProdutoEstruturalAsync(TipoProduto.CASCO, cancellationToken)
                ?? throw new BusinessRuleException(
                    "PRODUTO_CASCO_AUSENTE", "Produto estrutural CASCO não cadastrado.");
        }

        Guid? sucataProdutoId = null;
        if (venda.SucataEntregue > 0)
        {
            sucataProdutoId = await lookup.GetProdutoEstruturalAsync(TipoProduto.SUCATA, cancellationToken)
                ?? throw new BusinessRuleException(
                    "PRODUTO_SUCATA_AUSENTE", "Produto estrutural SUCATA não cadastrado.");
        }

        return new VendaGravacao(
            vendaId, venda.ClienteId, venda.FuncionarioId, venda.EnderecoEntregaId, venda.Observacao,
            totais.TotalBruto, totais.TotalDesconto, totais.TotalLiquido, totais.Status,
            totais.Itens, venda.Pagamentos,
            aguaVendida, cascosDevolvidos, venda.SucataEntregue,
            totais.Faltante, cascoProdutoId, sucataProdutoId);
    }

    private static ResultadoVenda ToResultado(VendaGravacao gravacao, long saldoCasco) => new(
        gravacao.VendaId, gravacao.TotalBruto, gravacao.TotalDesconto, gravacao.TotalLiquido,
        gravacao.TotalLiquido - gravacao.DebitoFiado, gravacao.DebitoFiado, gravacao.Status, saldoCasco);
}
