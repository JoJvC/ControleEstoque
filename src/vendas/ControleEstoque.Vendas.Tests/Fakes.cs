using ControleEstoque.Vendas.Domain;

namespace ControleEstoque.Vendas.Tests;

internal sealed class FakeVendaLookup : IVendaLookup
{
    public HashSet<Guid> Clientes { get; } = new();
    public HashSet<Guid> Funcionarios { get; } = new();
    public Dictionary<Guid, Guid> EnderecosPorCliente { get; } = new(); // enderecoId -> clienteId
    public Dictionary<Guid, ProdutoVenda> Produtos { get; } = new();
    public Dictionary<Guid, long> SaldosEstoque { get; } = new();
    public Dictionary<TipoProduto, Guid> Estruturais { get; } = new();

    public ProdutoVenda AddProduto(TipoProduto tipo, string nome, long saldoEstoque)
    {
        var produto = new ProdutoVenda(Guid.NewGuid(), tipo, nome);
        Produtos[produto.Id] = produto;
        SaldosEstoque[produto.Id] = saldoEstoque;
        if (tipo is TipoProduto.CASCO or TipoProduto.SUCATA)
        {
            Estruturais[tipo] = produto.Id;
        }

        return produto;
    }

    public Task<bool> ClienteExisteAsync(Guid clienteId, CancellationToken cancellationToken) =>
        Task.FromResult(Clientes.Contains(clienteId));

    public Task<bool> FuncionarioExisteAsync(Guid funcionarioId, CancellationToken cancellationToken) =>
        Task.FromResult(Funcionarios.Contains(funcionarioId));

    public Task<bool> EnderecoPertenceAoClienteAsync(
        Guid enderecoId, Guid clienteId, CancellationToken cancellationToken) =>
        Task.FromResult(EnderecosPorCliente.TryGetValue(enderecoId, out var dono) && dono == clienteId);

    public Task<IReadOnlyDictionary<Guid, ProdutoVenda>> GetProdutosAsync(
        IReadOnlyCollection<Guid> produtoIds, CancellationToken cancellationToken) =>
        Task.FromResult<IReadOnlyDictionary<Guid, ProdutoVenda>>(produtoIds
            .Where(Produtos.ContainsKey)
            .ToDictionary(id => id, id => Produtos[id]));

    public Task<Guid?> GetProdutoEstruturalAsync(TipoProduto tipo, CancellationToken cancellationToken) =>
        Task.FromResult<Guid?>(Estruturais.TryGetValue(tipo, out var id) ? id : null);

    public Task<long> GetSaldoEstoqueAsync(Guid produtoId, CancellationToken cancellationToken) =>
        Task.FromResult(SaldosEstoque.GetValueOrDefault(produtoId));
}

internal sealed class FakeVendaRepository : IVendaRepository
{
    public VendaGravacao? UltimaGravacao { get; private set; }
    public VendaGravacao? UltimaEdicao { get; private set; }
    public HashSet<Guid> VendasExistentes { get; } = new();
    public long SaldoCascoRetorno { get; set; }
    public InfoPagamentoVenda? InfoPagamento { get; set; }
    public (FormaPagamento Forma, decimal Valor, decimal Abatimento, StatusPagamento Status)? UltimoPagamento
    { get; private set; }

    public Task<long> CriarAsync(VendaGravacao gravacao, CancellationToken cancellationToken)
    {
        UltimaGravacao = gravacao;
        VendasExistentes.Add(gravacao.VendaId);
        return Task.FromResult(SaldoCascoRetorno);
    }

    public Task<long> EditarAsync(VendaGravacao gravacao, CancellationToken cancellationToken)
    {
        UltimaEdicao = gravacao;
        return Task.FromResult(SaldoCascoRetorno);
    }

    public Task<bool> ExisteAsync(Guid vendaId, CancellationToken cancellationToken) =>
        Task.FromResult(VendasExistentes.Contains(vendaId));

    public Task<Venda?> GetAsync(Guid vendaId, CancellationToken cancellationToken) =>
        Task.FromResult<Venda?>(VendasExistentes.Contains(vendaId)
            ? new Venda(vendaId, Guid.NewGuid(), Guid.NewGuid(), null, DateTimeOffset.UtcNow,
                0m, 0m, InfoPagamento?.TotalLiquido ?? 0m, InfoPagamento?.Status ?? StatusPagamento.PENDENTE,
                null, false, [], [])
            : null);

    public Task<IReadOnlyList<Venda>> ListAsync(
        Guid? clienteId, DateOnly? inicio, DateOnly? fim, int page, int pageSize,
        CancellationToken cancellationToken) =>
        Task.FromResult<IReadOnlyList<Venda>>([]);

    public Task<InfoPagamentoVenda?> GetInfoPagamentoAsync(Guid vendaId, CancellationToken cancellationToken) =>
        Task.FromResult(VendasExistentes.Contains(vendaId) ? InfoPagamento : null);

    public Task AddPagamentoAsync(
        Guid vendaId, FormaPagamento forma, decimal valor, decimal abatimentoFiado,
        StatusPagamento novoStatus, CancellationToken cancellationToken)
    {
        UltimoPagamento = (forma, valor, abatimentoFiado, novoStatus);
        return Task.CompletedTask;
    }

    public Task<long> GetSaldoCascoClienteAsync(Guid clienteId, CancellationToken cancellationToken) =>
        Task.FromResult(SaldoCascoRetorno);
}

internal sealed class FakeCupomFiscalRepository : ICupomFiscalRepository
{
    public HashSet<Guid> Emitidos { get; } = new();

    public Task<bool> JaEmitidoAsync(Guid vendaId, CancellationToken cancellationToken) =>
        Task.FromResult(Emitidos.Contains(vendaId));

    public Task<CupomFiscal> EmitirAsync(Guid vendaId, CancellationToken cancellationToken)
    {
        Emitidos.Add(vendaId);
        return Task.FromResult(new CupomFiscal(Guid.NewGuid(), "CF-00000001", DateTimeOffset.UtcNow));
    }
}
