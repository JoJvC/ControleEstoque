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

    public Caixa AddCaixa(DateOnly data, decimal saldoInicial, StatusCaixa status = StatusCaixa.ABERTO)
    {
        var caixa = new Caixa(Guid.NewGuid(), data, status, saldoInicial, null, null, null, null);
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
        AddDespesa(caixaId, valor);
        return Task.CompletedTask;
    }

    public Task<decimal> GetEntradasAsync(DateOnly data, CancellationToken cancellationToken) =>
        Task.FromResult(Entradas);

    public Task<IReadOnlyList<Despesa>> ListDespesasAsync(Guid caixaId, CancellationToken cancellationToken) =>
        Task.FromResult<IReadOnlyList<Despesa>>(despesas.GetValueOrDefault(caixaId) ?? []);

    public Task FecharAsync(
        Guid caixaId, IReadOnlyList<(Guid FuncionarioId, decimal Valor)> diarias,
        decimal totalEntradas, decimal totalSaidas, decimal saldoFinal,
        CancellationToken cancellationToken)
    {
        DiariasLancadas.AddRange(diarias);
        Fechamento = (totalEntradas, totalSaidas, saldoFinal);
        caixas[caixaId] = caixas[caixaId] with
        {
            Status = StatusCaixa.FECHADO,
            TotalEntradas = totalEntradas,
            TotalSaidas = totalSaidas,
            SaldoFinal = saldoFinal
        };
        return Task.CompletedTask;
    }

    public Task<IReadOnlyDictionary<Guid, decimal>> GetValoresDiariaAsync(
        IReadOnlyCollection<Guid> funcionarioIds, CancellationToken cancellationToken) =>
        Task.FromResult<IReadOnlyDictionary<Guid, decimal>>(funcionarioIds
            .Where(ValoresDiaria.ContainsKey)
            .ToDictionary(id => id, id => ValoresDiaria[id]));
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

    public Task<bool> ClienteExisteAsync(Guid clienteId, CancellationToken cancellationToken) =>
        Task.FromResult(Clientes.Contains(clienteId));

    public Task<decimal> GetSaldoAsync(Guid clienteId, CancellationToken cancellationToken) =>
        Task.FromResult(Saldos.GetValueOrDefault(clienteId));

    public Task<decimal> PagarAsync(
        Guid clienteId, decimal valor, string? observacao, CancellationToken cancellationToken)
    {
        Saldos[clienteId] = Saldos.GetValueOrDefault(clienteId) - valor;
        return Task.FromResult(Saldos[clienteId]);
    }

    public Task<IReadOnlyList<SaldoFiadoCliente>> ListSaldosDevedoresAsync(
        CancellationToken cancellationToken) =>
        Task.FromResult<IReadOnlyList<SaldoFiadoCliente>>([]);
}
