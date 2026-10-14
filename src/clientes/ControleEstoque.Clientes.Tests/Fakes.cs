using ControleEstoque.Clientes.Domain;

namespace ControleEstoque.Clientes.Tests;

internal sealed class FakeClienteRepository : IClienteRepository
{
    private readonly Dictionary<Guid, Cliente> clientes = new();

    public Cliente Add(string nome)
    {
        var cliente = new Cliente(Guid.NewGuid(), nome, null, null, []);
        clientes[cliente.Id] = cliente;
        return cliente;
    }

    public Task CreateAsync(Cliente cliente, CancellationToken cancellationToken)
    {
        clientes[cliente.Id] = cliente;
        return Task.CompletedTask;
    }

    public Task<bool> UpdateAsync(Cliente cliente, CancellationToken cancellationToken)
    {
        if (!clientes.ContainsKey(cliente.Id))
        {
            return Task.FromResult(false);
        }

        clientes[cliente.Id] = cliente;
        return Task.FromResult(true);
    }

    public Task<Cliente?> GetAsync(Guid id, CancellationToken cancellationToken) =>
        Task.FromResult(clientes.GetValueOrDefault(id));

    public Task<bool> ExistsAsync(Guid id, CancellationToken cancellationToken) =>
        Task.FromResult(clientes.ContainsKey(id));

    public Task<IReadOnlyList<Cliente>> ListAsync(
        string? nome, int page, int pageSize, CancellationToken cancellationToken) =>
        Task.FromResult<IReadOnlyList<Cliente>>(clientes.Values.ToList());

    public Task AddEnderecoAsync(Endereco endereco, CancellationToken cancellationToken) =>
        Task.CompletedTask;
}

/// <summary>
/// Ledger de casco em memória. Registra todas as chamadas para permitir
/// afirmar que a entrega de sucata NUNCA movimenta este ledger.
/// </summary>
internal sealed class FakeCascoClienteRepository : ICascoClienteRepository
{
    private readonly Dictionary<Guid, long> saldos = new();

    public int TotalChamadasDeEscrita { get; private set; }

    public void SetSaldo(Guid clienteId, long saldo) => saldos[clienteId] = saldo;

    public Task<long> GetSaldoAsync(Guid clienteId, CancellationToken cancellationToken) =>
        Task.FromResult(saldos.GetValueOrDefault(clienteId));

    public Task<ResultadoDevolucaoCasco> DevolverAsync(
        Guid clienteId, int quantidade, CancellationToken cancellationToken)
    {
        TotalChamadasDeEscrita++;
        saldos[clienteId] = saldos.GetValueOrDefault(clienteId) - quantidade;
        return Task.FromResult(new ResultadoDevolucaoCasco(saldos[clienteId]));
    }

    public Task<ResultadoConversaoCasco> ConverterAsync(
        Guid clienteId, int quantidade, decimal valorUnitario, CancellationToken cancellationToken)
    {
        TotalChamadasDeEscrita++;
        saldos[clienteId] = saldos.GetValueOrDefault(clienteId) - quantidade;
        return Task.FromResult(new ResultadoConversaoCasco(saldos[clienteId], quantidade * valorUnitario));
    }
}

internal sealed class FakeSucataClienteRepository : ISucataClienteRepository
{
    private readonly Dictionary<Guid, long> totais = new();
    private readonly Dictionary<Guid, decimal> creditosFiado = new();

    public Task<ResultadoEntregaSucata> EntregarAsync(
        Guid clienteId, int quantidade, decimal? valorConversao, CancellationToken cancellationToken)
    {
        totais[clienteId] = totais.GetValueOrDefault(clienteId) + quantidade;
        if (valorConversao is > 0)
        {
            creditosFiado[clienteId] = creditosFiado.GetValueOrDefault(clienteId) - valorConversao.Value;
        }

        return Task.FromResult(new ResultadoEntregaSucata(
            totais[clienteId], creditosFiado.GetValueOrDefault(clienteId)));
    }
}
