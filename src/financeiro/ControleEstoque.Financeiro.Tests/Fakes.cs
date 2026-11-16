using ControleEstoque.Financeiro.Domain;
using ControleEstoque.Shared.Results;

namespace ControleEstoque.Financeiro.Tests;

internal sealed class FakeCaixaRepository : ICaixaRepository
{
    private readonly Dictionary<Guid, Caixa> caixas = new();
    private readonly Dictionary<Guid, List<Despesa>> despesas = new();

    public Dictionary<Guid, decimal> ValoresDiaria { get; } = new();
    public decimal Entradas { get; set; }
    public List<(Guid FuncionarioId, decimal Valor)> DiariasLancadas { get; } = new();
    public (decimal Entradas, decimal Saidas, decimal SaldoFinal)? Fechamento { get; private set; }

    /// <summary>Linhas que o UPDATE condicional do fechamento informa; ≠ 1 vira CAIXA_JA_FECHADO.</summary>
    public int LinhasAfetadasNoFechamento { get; set; } = 1;

    /// <summary>Simula o UniqueViolation de lancamentos_funcionario (caixa, funcionário, DIARIA).</summary>
    public bool DiariaDuplicadaNoBanco { get; set; }

    /// <summary>Leituras avulsas de entradas/despesas: o fechamento deve ler dentro do repositório.</summary>
    public int LeiturasAvulsas { get; private set; }

    public List<(Guid FuncionarioId, decimal Valor, DateTimeOffset CriadoEm)> DiariasPendentesLancadas { get; } = new();

    public Caixa AddCaixa(
        DateOnly data, decimal saldoInicial, StatusCaixa status = StatusCaixa.ABERTO,
        DateTimeOffset? fechadoEm = null, bool fechadoPeloSistema = false, bool diariasPendentes = false)
    {
        var caixa = new Caixa(
            Guid.NewGuid(), data, status, saldoInicial, null, null, null, fechadoEm,
            fechadoPeloSistema, diariasPendentes);
        caixas[caixa.Id] = caixa;
        return caixa;
    }

    public void AddDespesa(Guid caixaId, decimal valor)
    {
        var lista = despesas.TryGetValue(caixaId, out var l) ? l : despesas[caixaId] = [];
        lista.Add(new Despesa(Guid.NewGuid(), Guid.NewGuid(), "Teste", valor, null));
    }

    public Task<Caixa> AbrirAsync(DateOnly? data, decimal saldoInicial, CancellationToken cancellationToken)
    {
        var dia = data ?? DateOnly.FromDateTime(DateTime.UtcNow);
        if (caixas.Values.Any(c => c.Data == dia))
        {
            throw new ConflictException("CAIXA_JA_EXISTE", "Já existe caixa para esta data.");
        }

        return Task.FromResult(AddCaixa(dia, saldoInicial));
    }

    public Task<Caixa?> GetAsync(Guid id, CancellationToken cancellationToken) =>
        Task.FromResult(caixas.GetValueOrDefault(id));

    public Task<Caixa?> GetByDataAsync(DateOnly data, CancellationToken cancellationToken) =>
        Task.FromResult(caixas.Values.FirstOrDefault(c => c.Data == data));

    public Task AddDespesaAsync(
        Guid caixaId, Guid tipoDespesaId, decimal valor, string? descricao,
        CancellationToken cancellationToken)
    {
        var caixa = caixas.GetValueOrDefault(caixaId)
            ?? throw new EntityNotFoundException("CAIXA_NAO_ENCONTRADO", "Caixa não encontrado.");
        if (caixa.Status == StatusCaixa.FECHADO)
        {
            throw new ConflictException("CAIXA_FECHADO", "Não é possível lançar despesa em caixa fechado.");
        }

        AddDespesa(caixaId, valor);
        return Task.CompletedTask;
    }

    public Task<decimal> GetEntradasAsync(DateOnly data, CancellationToken cancellationToken)
    {
        LeiturasAvulsas++;
        return Task.FromResult(Entradas);
    }

    public Task<IReadOnlyList<Despesa>> ListDespesasAsync(Guid caixaId, CancellationToken cancellationToken)
    {
        LeiturasAvulsas++;
        return Task.FromResult<IReadOnlyList<Despesa>>(despesas.GetValueOrDefault(caixaId) ?? []);
    }

    /// <summary>Cumpre o contrato C1: estado, diárias, entradas e despesas lidos no próprio fechamento.</summary>
    public Task<ResultadoFechamento> FecharAsync(
        Guid caixaId, IReadOnlyList<DiariaFechamento> funcionarioIds, CancellationToken cancellationToken)
    {
        var caixa = caixas.GetValueOrDefault(caixaId)
            ?? throw new EntityNotFoundException("CAIXA_NAO_ENCONTRADO", "Caixa não encontrado.");
        if (caixa.Status == StatusCaixa.FECHADO)
        {
            throw new ConflictException("CAIXA_JA_FECHADO", "Caixa já foi fechado.");
        }

        var diarias = new List<(Guid FuncionarioId, decimal Valor)>();
        foreach (var (funcionarioId, informado) in funcionarioIds)
        {
            if (!ValoresDiaria.TryGetValue(funcionarioId, out var cadastro))
            {
                throw new EntityNotFoundException(
                    "FUNCIONARIO_NAO_ENCONTRADO", $"Funcionário {funcionarioId} não encontrado.");
            }

            var valor = informado ?? cadastro;
            if (valor > 0)
            {
                diarias.Add((funcionarioId, valor));
            }
        }

        if (DiariaDuplicadaNoBanco || LinhasAfetadasNoFechamento != 1)
        {
            throw new ConflictException("CAIXA_JA_FECHADO", "Caixa já foi fechado.");
        }

        var totalSaidas = (despesas.GetValueOrDefault(caixaId) ?? []).Sum(d => d.Valor);
        var saldoFinal = caixa.SaldoInicial + Entradas - totalSaidas;
        DiariasLancadas.AddRange(diarias);
        Fechamento = (Entradas, totalSaidas, saldoFinal);
        caixas[caixaId] = caixa with
        {
            Status = StatusCaixa.FECHADO,
            TotalEntradas = Entradas,
            TotalSaidas = totalSaidas,
            SaldoFinal = saldoFinal
        };
        return Task.FromResult(new ResultadoFechamento(
            caixaId, caixa.Data, Entradas, totalSaidas, saldoFinal, diarias.Count));
    }

    public Task<IReadOnlyList<Caixa>> ListAbertosAntesDeAsync(DateOnly data, CancellationToken cancellationToken) =>
        Task.FromResult<IReadOnlyList<Caixa>>(
            caixas.Values.Where(c => c.Status == StatusCaixa.ABERTO && c.Data < data).OrderBy(c => c.Data).ToList());

    public Task<bool> FecharPeloSistemaAsync(
        Guid caixaId, DateTimeOffset fechadoEm, CancellationToken cancellationToken)
    {
        var caixa = caixas.GetValueOrDefault(caixaId);
        if (caixa is null || caixa.Status != StatusCaixa.ABERTO)
        {
            return Task.FromResult(false);
        }

        var totalSaidas = (despesas.GetValueOrDefault(caixaId) ?? []).Sum(d => d.Valor);
        caixas[caixaId] = caixa with
        {
            Status = StatusCaixa.FECHADO,
            TotalEntradas = Entradas,
            TotalSaidas = totalSaidas,
            SaldoFinal = caixa.SaldoInicial + Entradas - totalSaidas,
            FechadoEm = fechadoEm,
            FechadoPeloSistema = true,
            DiariasPendentes = true
        };
        return Task.FromResult(true);
    }

    public Task<IReadOnlyList<CaixaDiariasPendentes>> ListComDiariasPendentesAsync(
        CancellationToken cancellationToken) =>
        Task.FromResult<IReadOnlyList<CaixaDiariasPendentes>>(
            caixas.Values.Where(c => c.FechadoPeloSistema && c.DiariasPendentes)
                .OrderBy(c => c.Data).Select(c => new CaixaDiariasPendentes(c.Id, c.Data)).ToList());

    public Task<ResultadoLancamentoDiarias> LancarDiariasPendentesAsync(
        Guid caixaId, IReadOnlyList<DiariaFechamento> diarias, DateTimeOffset instante,
        CancellationToken cancellationToken)
    {
        var caixa = caixas.GetValueOrDefault(caixaId)
            ?? throw new EntityNotFoundException("CAIXA_NAO_ENCONTRADO", "Caixa não encontrado.");
        if (!caixa.FechadoPeloSistema)
        {
            throw new BusinessRuleException("CAIXA_SEM_DIARIAS_PENDENTES", "Sem diárias pendentes.");
        }

        if (!caixa.DiariasPendentes)
        {
            throw CaixaService.DiariasJaLancadas(caixa.Data);
        }

        var lancadas = new List<(Guid FuncionarioId, decimal Valor, DateTimeOffset CriadoEm)>();
        foreach (var (funcionarioId, informado) in diarias)
        {
            if (!ValoresDiaria.TryGetValue(funcionarioId, out var cadastro))
            {
                throw new EntityNotFoundException(
                    "FUNCIONARIO_NAO_ENCONTRADO", $"Funcionário {funcionarioId} não encontrado.");
            }

            var valor = informado ?? cadastro;
            if (valor > 0)
            {
                lancadas.Add((funcionarioId, valor, instante));
            }
        }

        DiariasPendentesLancadas.AddRange(lancadas);
        caixas[caixaId] = caixa with { DiariasPendentes = false };
        return Task.FromResult(new ResultadoLancamentoDiarias(caixaId, caixa.Data, lancadas.Count));
    }
}

internal sealed class FakeTipoDespesaRepository : ITipoDespesaRepository
{
    private readonly Dictionary<Guid, TipoDespesa> tipos = new();

    public TipoDespesa Add(string nome)
    {
        var tipo = new TipoDespesa(Guid.NewGuid(), nome);
        tipos[tipo.Id] = tipo;
        return tipo;
    }

    public Task<TipoDespesa> CreateAsync(string nome, CancellationToken cancellationToken) =>
        Task.FromResult(Add(nome));

    public Task<IReadOnlyList<TipoDespesa>> ListAsync(CancellationToken cancellationToken) =>
        Task.FromResult<IReadOnlyList<TipoDespesa>>(tipos.Values.ToList());

    public Task<bool> ExistsAsync(Guid id, CancellationToken cancellationToken) =>
        Task.FromResult(tipos.ContainsKey(id));
}

internal sealed class FakeFiadoRepository : IFiadoRepository
{
    public HashSet<Guid> Clientes { get; } = new();
    public Dictionary<Guid, decimal> Saldos { get; } = new();

    /// <summary>Simula o caixa de hoje FECHADO sob a trava FOR SHARE do repositório.</summary>
    public bool CaixaHojeFechado { get; set; }

    public List<decimal> PagamentosLancados { get; } = new();

    /// <summary>Vendas PENDENTE/PARCIAL por cliente, na ordem em que o SQL as entregaria (data, id).</summary>
    public Dictionary<Guid, List<VendaPendente>> VendasPendentes { get; } = new();

    public List<FormaPagamento> FormasRecebidas { get; } = new();

    public Task<bool> ClienteExisteAsync(Guid clienteId, CancellationToken cancellationToken) =>
        Task.FromResult(Clientes.Contains(clienteId));

    public Task<decimal> GetSaldoAsync(Guid clienteId, CancellationToken cancellationToken) =>
        Task.FromResult(Saldos.GetValueOrDefault(clienteId));

    public Task<ResultadoPagamentoFiado> PagarAsync(
        Guid clienteId, decimal valor, FormaPagamento forma, CancellationToken cancellationToken)
    {
        if (CaixaHojeFechado)
        {
            throw new ConflictException("CAIXA_FECHADO", "Não é possível lançar pagamento em caixa fechado.");
        }

        PagamentosLancados.Add(valor);
        FormasRecebidas.Add(forma);
        var distribuicao = FiadoFifo.Distribuir(
            valor, VendasPendentes.GetValueOrDefault(clienteId) ?? new List<VendaPendente>());
        Saldos[clienteId] = Saldos.GetValueOrDefault(clienteId) - valor;
        return Task.FromResult(new ResultadoPagamentoFiado(
            Saldos[clienteId], distribuicao.Abatimentos,
            FiadoFifo.CreditoGerado(distribuicao.Sobra, 0m - Saldos[clienteId])));
    }

    public Task<IReadOnlyList<SaldoFiadoCliente>> ListSaldosDevedoresAsync(
        CancellationToken cancellationToken) =>
        Task.FromResult<IReadOnlyList<SaldoFiadoCliente>>([]);
}

/// <summary>Relógio dublê: GetUtcNow fixo.</summary>
internal sealed class RelogioFixo : TimeProvider
{
    private readonly DateTimeOffset agora;

    public RelogioFixo(DateTimeOffset agora) => this.agora = agora;

    public override DateTimeOffset GetUtcNow() => agora;
}
