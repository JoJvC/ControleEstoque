using ControleEstoque.Shared.Results;
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
}

/// <summary>
/// Compartilha os saldos com o lookup e cumpre o contrato C0: checagem de saldo e gravação atômicas,
/// sob trava. O atraso entre ler e gravar faz a corrida aparecer se a trava for retirada.
/// </summary>
public sealed class FakeVendaRepository : IVendaRepository
{
    private readonly Dictionary<Guid, long> saldos;
    private readonly Dictionary<Guid, Dictionary<Guid, long>> saidasPorVenda = new();
    private readonly SemaphoreSlim trava = new(1, 1);

    public FakeVendaRepository(Dictionary<Guid, long> saldos) => this.saldos = saldos;

    /// <summary>Simula gravação atômica que recusa, mesmo com saldo alto na leitura avulsa.</summary>
    public bool RecusarSempre { get; set; }

    public VendaGravacao? UltimaGravacao { get; private set; }
    public VendaGravacao? UltimaEdicao { get; private set; }
    public (Guid? ClienteId, int PageSize)? UltimaListagem { get; private set; }
    public HashSet<Guid> VendasExistentes { get; } = new();
    public long SaldoCascoRetorno { get; set; }
    public InfoPagamentoVenda? InfoPagamento { get; set; }
    public (FormaPagamento Forma, decimal Valor)? UltimoPagamento { get; private set; }

    /// <summary>Simula o caixa de hoje FECHADO sob a trava FOR SHARE do repositório (CAIXA_FECHADO).</summary>
    public bool CaixaHojeFechado { get; set; }

    /// <summary>Simula pagamento atual da venda em dia de caixa FECHADO (só a edição consulta).</summary>
    public bool VendaTemPagamentoEmCaixaFechado { get; set; }

    /// <summary>Simula o pagamento concorrente que esgotou o saldo entre a pré-checagem e a trava da venda.</summary>
    public bool RecusarPagamentoPorExcesso { get; set; }

    private static ConflictException CaixaFechado() =>
        new("CAIXA_FECHADO", "Não é possível lançar pagamento em caixa fechado.");

    public async Task<ResultadoGravacao> CriarAsync(VendaGravacao gravacao, CancellationToken cancellationToken)
    {
        if (CaixaHojeFechado && gravacao.Pagamentos.Count > 0)
        {
            throw CaixaFechado();
        }

        var falta = await BaixarSaldoAsync(gravacao);
        if (falta is not null)
        {
            return new ResultadoGravacao(0, falta);
        }

        UltimaGravacao = gravacao;
        VendasExistentes.Add(gravacao.VendaId);
        return new ResultadoGravacao(SaldoCascoRetorno);
    }

    public async Task<ResultadoGravacao> EditarAsync(VendaGravacao gravacao, CancellationToken cancellationToken)
    {
        if (VendaTemPagamentoEmCaixaFechado || (CaixaHojeFechado && gravacao.Pagamentos.Count > 0))
        {
            throw CaixaFechado();
        }

        var falta = await BaixarSaldoAsync(gravacao);
        if (falta is not null)
        {
            return new ResultadoGravacao(0, falta);
        }

        UltimaEdicao = gravacao;
        return new ResultadoGravacao(SaldoCascoRetorno);
    }

    /// <summary>Devolve as saídas antigas da venda (soft-delete), checa e grava as novas; falha não grava nada.</summary>
    private async Task<SaldoInsuficiente?> BaixarSaldoAsync(VendaGravacao gravacao)
    {
        var novas = gravacao.Itens
            .GroupBy(i => i.ProdutoId)
            .ToDictionary(g => g.Key, g => g.Sum(i => (long)i.Quantidade));
        var antigas = saidasPorVenda.GetValueOrDefault(gravacao.VendaId) ?? new Dictionary<Guid, long>();

        await trava.WaitAsync();
        try
        {
            var lidos = novas.Keys.ToDictionary(id => id, id => saldos.GetValueOrDefault(id) + antigas.GetValueOrDefault(id));
            await Task.Delay(5); // janela entre ler e gravar: expõe a corrida sem a trava
            foreach (var (produtoId, saida) in novas)
            {
                if (RecusarSempre || lidos[produtoId] - saida < 0)
                {
                    return new SaldoInsuficiente(produtoId, lidos[produtoId], saida);
                }
            }

            foreach (var (produtoId, saldoAntigo) in antigas)
            {
                saldos[produtoId] = saldos.GetValueOrDefault(produtoId) + saldoAntigo;
            }

            foreach (var (produtoId, saida) in novas)
            {
                saldos[produtoId] = saldos.GetValueOrDefault(produtoId) - saida;
            }

            saidasPorVenda[gravacao.VendaId] = novas;
            return null;
        }
        finally
        {
            trava.Release();
        }
    }

    public Task<bool> ExisteAsync(Guid vendaId, CancellationToken cancellationToken) =>
        Task.FromResult(VendasExistentes.Contains(vendaId));

    public Task<Venda?> GetAsync(Guid vendaId, CancellationToken cancellationToken) =>
        Task.FromResult<Venda?>(VendasExistentes.Contains(vendaId)
            ? new Venda(vendaId, Guid.NewGuid(), Guid.NewGuid(), null, DateTimeOffset.UtcNow,
                0m, 0m, InfoPagamento?.TotalLiquido ?? 0m, InfoPagamento?.Status ?? StatusPagamento.PENDENTE,
                null, false, [], [],
                UltimaGravacao?.VendaId == vendaId ? UltimaGravacao.CascosDevolvidos : 0,
                UltimaGravacao?.VendaId == vendaId ? UltimaGravacao.SucataEntregue : 0)
            : null);

    public Task<IReadOnlyList<Venda>> ListAsync(
        Guid? clienteId, DateOnly? inicio, DateOnly? fim, int page, int pageSize,
        CancellationToken cancellationToken)
    {
        UltimaListagem = (clienteId, pageSize);
        return Task.FromResult<IReadOnlyList<Venda>>([]);
    }

    public Task<InfoPagamentoVenda?> GetInfoPagamentoAsync(Guid vendaId, CancellationToken cancellationToken) =>
        Task.FromResult(VendasExistentes.Contains(vendaId) ? InfoPagamento : null);

    public Task<InfoPagamentoVenda> AddPagamentoAsync(
        Guid vendaId, FormaPagamento forma, decimal valor, CancellationToken cancellationToken)
    {
        if (CaixaHojeFechado)
        {
            throw CaixaFechado();
        }

        if (RecusarPagamentoPorExcesso)
        {
            throw new BusinessRuleException("PAGAMENTO_EXCEDE_SALDO", "Pagamento excede o saldo restante.");
        }

        UltimoPagamento = (forma, valor);
        return Task.FromResult(InfoPagamento!);
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
