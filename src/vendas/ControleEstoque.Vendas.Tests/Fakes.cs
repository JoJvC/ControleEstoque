using ControleEstoque.Shared.Results;
using ControleEstoque.Vendas.Domain;

namespace ControleEstoque.Vendas.Tests;

internal sealed class FakeVendaLookup : IVendaLookup
{
    public HashSet<Guid> Clientes { get; } = new();
    public HashSet<Guid> Funcionarios { get; } = new();
    public Dictionary<Guid, Guid> EnderecosPorCliente { get; } = new(); // enderecoId -> clienteId
    public Dictionary<(Guid ProdutoId, Guid MarcaId), ProdutoVenda> Produtos { get; } = new();
    public Dictionary<Guid, TipoCascoVenda> TiposCasco { get; } = new();
    public Dictionary<Guid, long> SaldosEstoque { get; } = new(); // por produto_marca_id

    public TipoCascoVenda AddTipoCasco(decimal precoVasilhame, bool aceitaSucata)
    {
        var tipo = new TipoCascoVenda(Guid.NewGuid(), precoVasilhame, aceitaSucata);
        TiposCasco[tipo.Id] = tipo;
        return tipo;
    }

    /// <summary>Produto+marca novo: o casco do produto é o genérico; o da marca, o específico (vence).</summary>
    public ProdutoVenda AddProduto(
        TipoProduto tipo, string nome, long saldoEstoque, Guid? tipoCascoProduto = null, Guid? tipoCascoMarca = null)
    {
        var produto = new ProdutoVenda(
            Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), tipo, nome, tipoCascoProduto, tipoCascoMarca);
        Produtos[(produto.ProdutoId, produto.MarcaId)] = produto;
        SaldosEstoque[produto.ProdutoMarcaId] = saldoEstoque;
        return produto;
    }

    public Task<bool> ClienteExisteAsync(Guid clienteId, CancellationToken cancellationToken) =>
        Task.FromResult(Clientes.Contains(clienteId));

    /// <summary>Crédito (saldo positivo) por cliente.</summary>
    public Dictionary<Guid, decimal> Creditos { get; } = new();

    /// <summary>Uso de crédito já gravado por venda (a venda ignorada não conta contra o limite).</summary>
    public Dictionary<Guid, decimal> UsoCreditoPorVenda { get; } = new();

    public Guid? UltimaVendaIgnorada { get; private set; }

    public Task<decimal> GetCreditoDisponivelAsync(
        Guid clienteId, Guid? vendaIgnorada, CancellationToken cancellationToken)
    {
        UltimaVendaIgnorada = vendaIgnorada;
        var uso = vendaIgnorada is { } id ? UsoCreditoPorVenda.GetValueOrDefault(id) : 0m;
        return Task.FromResult(Math.Max(0m, Creditos.GetValueOrDefault(clienteId) + uso));
    }

    /// <summary>Crédito de galão por cliente e tipo (max(0, -saldo)).</summary>
    public Dictionary<(Guid ClienteId, Guid TipoCascoId), long> CreditosCasco { get; } = new();

    /// <summary>Crédito de galão já abatido por venda e tipo (a venda ignorada devolve o abate ao crédito).</summary>
    public Dictionary<(Guid VendaId, Guid TipoCascoId), long> AbatePorVenda { get; } = new();

    public Guid? UltimaVendaIgnoradaCasco { get; private set; }
    public int ConsultasCreditoCasco { get; private set; }

    public Task<IReadOnlyDictionary<Guid, long>> GetCreditoCascoPorTipoAsync(
        Guid clienteId, IReadOnlyCollection<Guid> tipoCascoIds, Guid? vendaIgnorada,
        CancellationToken cancellationToken)
    {
        ConsultasCreditoCasco++;
        UltimaVendaIgnoradaCasco = vendaIgnorada;
        return Task.FromResult<IReadOnlyDictionary<Guid, long>>(tipoCascoIds
            .Select(t => (Tipo: t, Credito: CreditosCasco.GetValueOrDefault((clienteId, t))
                + (vendaIgnorada is { } v ? AbatePorVenda.GetValueOrDefault((v, t)) : 0L)))
            .Where(x => x.Credito > 0)
            .ToDictionary(x => x.Tipo, x => x.Credito));
    }

    /// <summary>Saldo de casco por cliente e tipo (positivo = cliente deve).</summary>
    public Dictionary<(Guid ClienteId, Guid TipoCascoId), long> SaldosCasco { get; } = new();

    /// <summary>Quantidade já convertida por venda e tipo (a venda ignorada devolve a conversão ao saldo).</summary>
    public Dictionary<(Guid VendaId, Guid TipoCascoId), long> ConvertidoPorVenda { get; } = new();

    public Guid? UltimaVendaIgnoradaSaldoCasco { get; private set; }

    public Task<IReadOnlyDictionary<Guid, long>> GetSaldoCascoPorTipoAsync(
        Guid clienteId, IReadOnlyCollection<Guid> tipoCascoIds, Guid? vendaIgnorada,
        CancellationToken cancellationToken)
    {
        UltimaVendaIgnoradaSaldoCasco = vendaIgnorada;
        return Task.FromResult<IReadOnlyDictionary<Guid, long>>(tipoCascoIds
            .Select(t => (Tipo: t, Saldo: SaldosCasco.GetValueOrDefault((clienteId, t))
                + (vendaIgnorada is { } v ? ConvertidoPorVenda.GetValueOrDefault((v, t)) : 0L)))
            .Where(x => x.Saldo > 0)
            .ToDictionary(x => x.Tipo, x => x.Saldo));
    }

    public Task<bool> FuncionarioExisteAsync(Guid funcionarioId, CancellationToken cancellationToken) =>
        Task.FromResult(Funcionarios.Contains(funcionarioId));

    public Task<bool> EnderecoPertenceAoClienteAsync(
        Guid enderecoId, Guid clienteId, CancellationToken cancellationToken) =>
        Task.FromResult(EnderecosPorCliente.TryGetValue(enderecoId, out var dono) && dono == clienteId);

    public Task<IReadOnlyDictionary<(Guid ProdutoId, Guid MarcaId), ProdutoVenda>> GetProdutosAsync(
        IReadOnlyCollection<(Guid ProdutoId, Guid MarcaId)> pares, CancellationToken cancellationToken) =>
        Task.FromResult<IReadOnlyDictionary<(Guid ProdutoId, Guid MarcaId), ProdutoVenda>>(pares
            .Where(Produtos.ContainsKey)
            .ToDictionary(par => par, par => Produtos[par]));

    public Task<IReadOnlyDictionary<Guid, TipoCascoVenda>> GetTiposCascoAsync(
        IReadOnlyCollection<Guid> ids, CancellationToken cancellationToken) =>
        Task.FromResult<IReadOnlyDictionary<Guid, TipoCascoVenda>>(ids
            .Where(TiposCasco.ContainsKey)
            .ToDictionary(id => id, id => TiposCasco[id]));
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

    /// <summary>Saldo de casco por cliente e tipo, como a view vw_saldo_casco_cliente: empréstimo soma, devolução abate.</summary>
    private readonly Dictionary<(Guid ClienteId, Guid TipoCascoId), long> saldoCasco = new();
    private readonly Dictionary<Guid, VendaGravacao> gravacoesPorVenda = new();
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
            return new ResultadoGravacao([], falta);
        }

        UltimaGravacao = gravacao;
        VendasExistentes.Add(gravacao.VendaId);
        AplicarCascos(gravacao);
        return new ResultadoGravacao(SaldoCascoDe(gravacao.ClienteId));
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
            return new ResultadoGravacao([], falta);
        }

        UltimaEdicao = gravacao;
        AplicarCascos(gravacao);
        return new ResultadoGravacao(SaldoCascoDe(gravacao.ClienteId));
    }

    /// <summary>Replay da edição: desfaz os cascos da gravação anterior da venda e aplica os novos.</summary>
    private void AplicarCascos(VendaGravacao gravacao)
    {
        if (gravacoesPorVenda.TryGetValue(gravacao.VendaId, out var anterior))
        {
            Somar(anterior, -1);
        }

        Somar(gravacao, 1);
        gravacoesPorVenda[gravacao.VendaId] = gravacao;
    }

    private void Somar(VendaGravacao gravacao, int sinal)
    {
        foreach (var c in gravacao.CascosEmprestados)
        {
            Ajustar(gravacao.ClienteId, c.TipoCascoId, sinal * c.Quantidade);
        }

        foreach (var c in gravacao.CascosDevolvidos)
        {
            Ajustar(gravacao.ClienteId, c.TipoCascoId, -sinal * c.Quantidade);
        }

        foreach (var v in gravacao.Vasilhames)
        {
            Ajustar(gravacao.ClienteId, v.TipoCascoId, sinal * v.QuantidadeAbatida);
        }
    }

    private void Ajustar(Guid clienteId, Guid tipoCascoId, long delta) =>
        saldoCasco[(clienteId, tipoCascoId)] = saldoCasco.GetValueOrDefault((clienteId, tipoCascoId)) + delta;

    private IReadOnlyList<SaldoCascoTipo> SaldoCascoDe(Guid clienteId) => saldoCasco
        .Where(e => e.Key.ClienteId == clienteId && e.Value != 0)
        .Select(e => new SaldoCascoTipo(e.Key.TipoCascoId, $"Tipo {e.Key.TipoCascoId}", e.Value))
        .ToList();

    /// <summary>Devolve as saídas antigas da venda (soft-delete), checa e grava as novas; falha não grava nada.</summary>
    private async Task<SaldoInsuficiente?> BaixarSaldoAsync(VendaGravacao gravacao)
    {
        var novas = gravacao.Itens
            .GroupBy(i => i.ProdutoMarcaId)
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

    public Task<Venda?> GetAsync(Guid vendaId, CancellationToken cancellationToken)
    {
        var gravacao = UltimaGravacao?.VendaId == vendaId ? UltimaGravacao : null;
        return Task.FromResult<Venda?>(VendasExistentes.Contains(vendaId)
            ? new Venda(vendaId, Guid.NewGuid(), Guid.NewGuid(), null, DateTimeOffset.UtcNow,
                0m, 0m, InfoPagamento?.TotalLiquido ?? 0m, InfoPagamento?.Status ?? StatusPagamento.PENDENTE,
                null, false, gravacao?.Itens ?? [], [],
                gravacao?.CascosDevolvidos ?? [],
                gravacao?.SucataEntregue ?? [],
                gravacao?.Vasilhames ?? [], null, null, gravacao?.DescontoSucata ?? 0m)
            : null);
    }

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

    public Task<IReadOnlyList<SaldoCascoTipo>> GetSaldoCascoClienteAsync(
        Guid clienteId, CancellationToken cancellationToken) =>
        Task.FromResult(SaldoCascoDe(clienteId));

    /// <summary>Compras já gravadas do cliente; Deletada simula venda ou item com deleted_at.</summary>
    public List<(Guid ClienteId, Guid ProdutoId, Guid MarcaId, UltimoPrecoVenda Compra, bool Deletada)> Compras { get; } = new();

    public Task<UltimoPrecoVenda?> GetUltimoPrecoAsync(
        Guid clienteId, Guid produtoId, Guid marcaId, CancellationToken cancellationToken) =>
        Task.FromResult(Compras
            .Where(c => c.ClienteId == clienteId && c.ProdutoId == produtoId && c.MarcaId == marcaId && !c.Deletada)
            .OrderByDescending(c => c.Compra.Data)
            .Select(c => c.Compra)
            .FirstOrDefault());
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
