using ControleEstoque.Shared.Results;

namespace ControleEstoque.Vendas.Domain;

/// <summary>Consultas de apoio à venda (clientes, funcionários, produtos).</summary>
public interface IVendaLookup
{
    Task<bool> ClienteExisteAsync(Guid clienteId, CancellationToken cancellationToken);
    /// <summary>
    /// Crédito do cliente (max(0, saldo)) sem contar os lançamentos da venda <paramref name="vendaIgnorada"/>
    /// (na edição, o uso de crédito da própria venda não reduz o disponível).
    /// </summary>
    Task<decimal> GetCreditoDisponivelAsync(Guid clienteId, Guid? vendaIgnorada, CancellationToken cancellationToken);
    /// <summary>
    /// Crédito de galão do cliente por tipo (max(0, -saldo de casco)), só dos tipos pedidos com crédito, sem contar
    /// os movimentos da venda <paramref name="vendaIgnorada"/> (na edição, os efeitos da própria venda não contam).
    /// </summary>
    Task<IReadOnlyDictionary<Guid, long>> GetCreditoCascoPorTipoAsync(
        Guid clienteId, IReadOnlyCollection<Guid> tipoCascoIds, Guid? vendaIgnorada,
        CancellationToken cancellationToken);
    /// <summary>
    /// Saldo devedor de casco do cliente por tipo (max(0, saldo)), só dos tipos pedidos, sem contar os movimentos
    /// da venda <paramref name="vendaIgnorada"/>. Limita o modo CONVERTER_CASCO.
    /// </summary>
    Task<IReadOnlyDictionary<Guid, long>> GetSaldoCascoPorTipoAsync(
        Guid clienteId, IReadOnlyCollection<Guid> tipoCascoIds, Guid? vendaIgnorada,
        CancellationToken cancellationToken);
    Task<bool> FuncionarioExisteAsync(Guid funcionarioId, CancellationToken cancellationToken);
    Task<bool> EnderecoPertenceAoClienteAsync(
        Guid enderecoId, Guid clienteId, CancellationToken cancellationToken);
    /// <summary>Só devolve pares (produtoId, marcaId) com associação produto+marca ativa.</summary>
    Task<IReadOnlyDictionary<(Guid ProdutoId, Guid MarcaId), ProdutoVenda>> GetProdutosAsync(
        IReadOnlyCollection<(Guid ProdutoId, Guid MarcaId)> pares, CancellationToken cancellationToken);
    Task<IReadOnlyDictionary<Guid, TipoCascoVenda>> GetTiposCascoAsync(
        IReadOnlyCollection<Guid> ids, CancellationToken cancellationToken);
    /// <summary>Caixa (não apagado) pelo id; nulo se não existe.</summary>
    Task<CaixaVenda?> GetCaixaAsync(Guid caixaId, CancellationToken cancellationToken);
}

/// <summary>Permissões do cargo de um funcionário (a autenticação ainda não existe: ele vem informado).</summary>
public interface IPermissaoFuncionarioLookup
{
    /// <summary>Nulo se o funcionário não existe ou foi excluído; vazia se está inativo.</summary>
    Task<IReadOnlyList<string>?> PermissoesAsync(Guid funcionarioId, CancellationToken cancellationToken);
}

public interface IVendaRepository
{
    /// <summary>
    /// Persiste a venda e todos os efeitos em uma transação; retorna o novo saldo de casco do cliente.
    /// Com pagamento, trava o caixa de hoje (FOR SHARE) e lança ConflictException CAIXA_FECHADO se fechado.
    /// Com <c>CaixaId</c>, trava esse caixa em vez do de hoje, mesmo sem pagamento: inexistente lança
    /// EntityNotFoundException CAIXA_NAO_ENCONTRADO e FECHADO lança CAIXA_FECHADO. <c>Instante</c> não nulo vira a
    /// data da venda, dos pagamentos e dos movimentos/lançamentos que ela gera (nulo: now()).
    /// Trava as associações produto+marca vendidas e checa o saldo dentro da transação; sem saldo, faz rollback e devolve a falta.
    /// Com UsoCredito &gt; 0, trava o cliente (FOR UPDATE) e lança BusinessRuleException CREDITO_INSUFICIENTE (rollback)
    /// se o uso passa do crédito relido sob a trava. Com vasilhame abatido do crédito de galão, trava o cliente do mesmo
    /// jeito e lança CREDITO_CASCO_INSUFICIENTE se o abate passa do crédito do tipo relido sob a trava.
    /// </summary>
    Task<ResultadoGravacao> CriarAsync(VendaGravacao gravacao, CancellationToken cancellationToken);

    /// <summary>
    /// Conclui o pedido em venda numa transação só. Trava o pedido primeiro (FOR UPDATE; sumido lança
    /// EntityNotFoundException PEDIDO_NAO_ENCONTRADO; fora de EM_ANDAMENTO lança ConflictException
    /// PEDIDO_STATUS_INVALIDO), depois faz o mesmo que <see cref="CriarAsync"/> (caixa, cliente, produtos, saldo,
    /// efeitos), com a reserva do próprio pedido fora da conta do saldo, e grava CONCLUIDO, <c>venda_id</c> e
    /// <c>concluido_em</c> (= <c>Instante</c> da gravação). Sem saldo, faz rollback e devolve a falta.
    /// </summary>
    Task<ResultadoGravacao> ConcluirPedidoAsync(
        Guid pedidoId, VendaGravacao gravacao, CancellationToken cancellationToken);

    /// <summary>
    /// Edição por replay: soft-deleta itens, pagamentos, movimentos de estoque,
    /// movimentos de casco (do cliente e do estoque), vasilhames, sucatas da venda e lançamentos de fiado vinculados
    /// à venda, e reinsere conforme a gravação — tudo em uma transação. A checagem de saldo roda
    /// depois do soft-delete, então as saídas antigas da própria venda não contam. Lança CAIXA_FECHADO se
    /// um pagamento atual da venda cair em caixa FECHADO, ou se reinserir pagamento com o caixa do dia da venda
    /// FECHADO. Os efeitos reinseridos ficam com <c>Instante</c> (o da venda).
    /// </summary>
    Task<ResultadoGravacao> EditarAsync(VendaGravacao gravacao, CancellationToken cancellationToken);

    /// <summary>Data da venda não apagada; nulo se não existe.</summary>
    Task<DateTimeOffset?> GetDataAsync(Guid vendaId, CancellationToken cancellationToken);

    /// <summary>
    /// Cancela (soft delete) a venda e desfaz os efeitos pelo mesmo caminho da edição, numa transação: trava os caixas
    /// dos pagamentos e o do dia da venda (FOR SHARE; FECHADO lança ConflictException CAIXA_FECHADO; sem caixa na
    /// data, segue) e a venda (FOR UPDATE; sumida lança EntityNotFoundException VENDA_NAO_ENCONTRADA). Grava
    /// cancelada_por e cancelada_em.
    /// </summary>
    Task CancelarAsync(
        Guid vendaId, Guid funcionarioId, DateTimeOffset canceladaEm, CancellationToken cancellationToken);

    Task<bool> ExisteAsync(Guid vendaId, CancellationToken cancellationToken);
    Task<Venda?> GetAsync(Guid vendaId, CancellationToken cancellationToken);
    Task<IReadOnlyList<Venda>> ListAsync(
        Guid? clienteId, DateOnly? inicio, DateOnly? fim, int page, int pageSize,
        CancellationToken cancellationToken);

    Task<InfoPagamentoVenda?> GetInfoPagamentoAsync(Guid vendaId, CancellationToken cancellationToken);

    /// <summary>
    /// Em uma transação: trava o caixa de hoje (FOR SHARE; FECHADO lança ConflictException CAIXA_FECHADO) e a
    /// venda (FOR UPDATE), relê os totais, recusa com PAGAMENTO_EXCEDE_SALDO se o valor os excede, grava o
    /// pagamento, o novo status e o abatimento do fiado. Retorna os totais lidos sob a trava (antes do pagamento).
    /// </summary>
    Task<InfoPagamentoVenda> AddPagamentoAsync(
        Guid vendaId, FormaPagamento forma, decimal valor, CancellationToken cancellationToken);

    Task<IReadOnlyList<SaldoCascoTipo>> GetSaldoCascoClienteAsync(Guid clienteId, CancellationToken cancellationToken);

    /// <summary>
    /// Preço unitário (antes do desconto do item) da venda mais recente do cliente com o produto+marca;
    /// vendas e itens apagados ficam de fora. Null quando o cliente nunca comprou.
    /// </summary>
    Task<UltimoPrecoVenda?> GetUltimoPrecoAsync(
        Guid clienteId, Guid produtoId, Guid marcaId, CancellationToken cancellationToken);
}

public interface IPedidoRepository
{
    /// <summary>Grava o pedido PENDENTE com itens e funcionários em uma transação. Sem saldo, sem reserva.</summary>
    Task CriarAsync(PedidoGravacao gravacao, CancellationToken cancellationToken);

    Task<Pedido?> GetAsync(Guid pedidoId, CancellationToken cancellationToken);

    /// <summary>Mais recentes primeiro (created_at desc); <paramref name="status"/> nulo lista todos.</summary>
    Task<IReadOnlyList<PedidoResumo>> ListAsync(
        StatusPedido? status, int page, int pageSize, CancellationToken cancellationToken);

    /// <summary>
    /// Em uma transação: trava o pedido (FOR UPDATE; sumido lança EntityNotFoundException PEDIDO_NAO_ENCONTRADO; fora
    /// de PENDENTE lança ConflictException PEDIDO_STATUS_INVALIDO), trava as associações produto+marca dos itens, confere
    /// saldo − reservado − quantidade (a reserva é a dos outros pedidos EM_ANDAMENTO) e, se couber, troca os
    /// funcionários, grava EM_ANDAMENTO e <c>iniciado_em</c>. Sem estoque, faz rollback e devolve a falta
    /// (ProdutoId = associação produto+marca; Saldo = disponível).
    /// </summary>
    Task<SaldoInsuficiente?> IniciarAsync(
        Guid pedidoId, IReadOnlyList<Guid> funcionariosIds, DateTimeOffset iniciadoEm,
        CancellationToken cancellationToken);

    /// <summary>
    /// Trava o pedido (FOR UPDATE): sumido lança PEDIDO_NAO_ENCONTRADO; CONCLUIDO ou CANCELADO lança
    /// ConflictException PEDIDO_STATUS_INVALIDO; senão grava CANCELADO, <c>cancelado_em</c> e <c>cancelado_por</c>.
    /// A reserva some porque o pedido deixa de ser EM_ANDAMENTO.
    /// </summary>
    Task CancelarAsync(
        Guid pedidoId, Guid funcionarioId, DateTimeOffset canceladoEm, CancellationToken cancellationToken);
}

public interface ICupomFiscalRepository
{
    Task<bool> JaEmitidoAsync(Guid vendaId, CancellationToken cancellationToken);
    Task<CupomFiscal> EmitirAsync(Guid vendaId, CancellationToken cancellationToken);
}

public interface IRelatorioVendasRepository
{
    Task<RelatorioFaturamento> FaturamentoAsync(
        DateOnly? inicio, DateOnly? fim, Guid? produtoId, CancellationToken cancellationToken);
    Task<IReadOnlyList<VendasPorFuncionario>> VendasPorFuncionarioAsync(
        DateOnly? inicio, DateOnly? fim, CancellationToken cancellationToken);
}
