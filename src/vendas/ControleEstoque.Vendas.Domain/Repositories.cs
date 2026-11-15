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
    Task<bool> FuncionarioExisteAsync(Guid funcionarioId, CancellationToken cancellationToken);
    Task<bool> EnderecoPertenceAoClienteAsync(
        Guid enderecoId, Guid clienteId, CancellationToken cancellationToken);
    /// <summary>Só devolve pares (produtoId, marcaId) com associação produto+marca ativa.</summary>
    Task<IReadOnlyDictionary<(Guid ProdutoId, Guid MarcaId), ProdutoVenda>> GetProdutosAsync(
        IReadOnlyCollection<(Guid ProdutoId, Guid MarcaId)> pares, CancellationToken cancellationToken);
    Task<IReadOnlyDictionary<Guid, TipoCascoVenda>> GetTiposCascoAsync(
        IReadOnlyCollection<Guid> ids, CancellationToken cancellationToken);
}

public interface IVendaRepository
{
    /// <summary>
    /// Persiste a venda e todos os efeitos em uma transação; retorna o novo saldo de casco do cliente.
    /// Com pagamento, trava o caixa de hoje (FOR SHARE) e lança ConflictException CAIXA_FECHADO se fechado.
    /// Trava as associações produto+marca vendidas e checa o saldo dentro da transação; sem saldo, faz rollback e devolve a falta.
    /// Com UsoCredito &gt; 0, trava o cliente (FOR UPDATE) e lança BusinessRuleException CREDITO_INSUFICIENTE (rollback)
    /// se o uso passa do crédito relido sob a trava.
    /// </summary>
    Task<ResultadoGravacao> CriarAsync(VendaGravacao gravacao, CancellationToken cancellationToken);

    /// <summary>
    /// Edição por replay: soft-deleta itens, pagamentos, movimentos de estoque,
    /// movimentos de casco (do cliente e do estoque), entregas de sucata e lançamentos de fiado vinculados
    /// à venda, e reinsere conforme a gravação — tudo em uma transação. A checagem de saldo roda
    /// depois do soft-delete, então as saídas antigas da própria venda não contam. Lança CAIXA_FECHADO se
    /// um pagamento atual da venda cair em caixa FECHADO, ou se reinserir pagamento com o caixa de hoje FECHADO.
    /// </summary>
    Task<ResultadoGravacao> EditarAsync(VendaGravacao gravacao, CancellationToken cancellationToken);

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
