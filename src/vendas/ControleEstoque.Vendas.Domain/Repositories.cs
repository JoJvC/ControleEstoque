namespace ControleEstoque.Vendas.Domain;

/// <summary>Consultas de apoio à venda (clientes, funcionários, produtos, estoque).</summary>
public interface IVendaLookup
{
    Task<bool> ClienteExisteAsync(Guid clienteId, CancellationToken cancellationToken);
    Task<bool> FuncionarioExisteAsync(Guid funcionarioId, CancellationToken cancellationToken);
    Task<bool> EnderecoPertenceAoClienteAsync(
        Guid enderecoId, Guid clienteId, CancellationToken cancellationToken);
    Task<IReadOnlyDictionary<Guid, ProdutoVenda>> GetProdutosAsync(
        IReadOnlyCollection<Guid> produtoIds, CancellationToken cancellationToken);
    Task<Guid?> GetProdutoEstruturalAsync(TipoProduto tipo, CancellationToken cancellationToken);
    Task<long> GetSaldoEstoqueAsync(Guid produtoId, CancellationToken cancellationToken);
}

public interface IVendaRepository
{
    /// <summary>Persiste a venda e todos os efeitos em uma transação; retorna o novo saldo de casco do cliente.</summary>
    Task<long> CriarAsync(VendaGravacao gravacao, CancellationToken cancellationToken);

    /// <summary>
    /// Edição por replay: soft-deleta itens, pagamentos, movimentos de estoque,
    /// movimentos de casco, entregas de sucata e lançamentos de fiado vinculados
    /// à venda, e reinsere conforme a gravação — tudo em uma transação.
    /// </summary>
    Task<long> EditarAsync(VendaGravacao gravacao, CancellationToken cancellationToken);

    Task<bool> ExisteAsync(Guid vendaId, CancellationToken cancellationToken);
    Task<Venda?> GetAsync(Guid vendaId, CancellationToken cancellationToken);
    Task<IReadOnlyList<Venda>> ListAsync(
        Guid? clienteId, DateOnly? inicio, DateOnly? fim, int page, int pageSize,
        CancellationToken cancellationToken);

    Task<InfoPagamentoVenda?> GetInfoPagamentoAsync(Guid vendaId, CancellationToken cancellationToken);
    Task AddPagamentoAsync(
        Guid vendaId, FormaPagamento forma, decimal valor, decimal abatimentoFiado,
        StatusPagamento novoStatus, CancellationToken cancellationToken);

    Task<long> GetSaldoCascoClienteAsync(Guid clienteId, CancellationToken cancellationToken);
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
