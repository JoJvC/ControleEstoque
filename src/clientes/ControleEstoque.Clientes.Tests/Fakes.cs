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

    public List<Endereco> Enderecos { get; } = [];

    public Task<IReadOnlyList<Endereco>> ListEnderecosAsync(Guid clienteId, CancellationToken cancellationToken) =>
        Task.FromResult<IReadOnlyList<Endereco>>(Enderecos.Where(e => e.ClienteId == clienteId).ToList());

    public Task AddEnderecoAsync(Endereco endereco, bool desmarcarOutros, CancellationToken cancellationToken)
    {
        if (desmarcarOutros)
        {
            DesmarcarOutros(endereco.ClienteId, endereco.Id);
        }

        Enderecos.Add(endereco);
        return Task.CompletedTask;
    }

    public Task<bool> UpdateEnderecoAsync(
        Endereco endereco, bool desmarcarOutros, CancellationToken cancellationToken)
    {
        var i = Enderecos.FindIndex(e => e.Id == endereco.Id && e.ClienteId == endereco.ClienteId);
        if (i < 0)
        {
            return Task.FromResult(false);
        }

        Enderecos[i] = endereco;
        if (desmarcarOutros)
        {
            DesmarcarOutros(endereco.ClienteId, endereco.Id);
        }

        return Task.FromResult(true);
    }

    public Task<bool> RemoveEnderecoAsync(
        Guid clienteId, Guid enderecoId, Guid? novoPrincipalId, CancellationToken cancellationToken)
    {
        if (Enderecos.RemoveAll(e => e.Id == enderecoId && e.ClienteId == clienteId) == 0)
        {
            return Task.FromResult(false);
        }

        var i = Enderecos.FindIndex(e => e.Id == novoPrincipalId);
        if (i >= 0)
        {
            Enderecos[i] = Enderecos[i] with { Principal = true };
        }

        return Task.FromResult(true);
    }

    private void DesmarcarOutros(Guid clienteId, Guid exceto)
    {
        for (var i = 0; i < Enderecos.Count; i++)
        {
            if (Enderecos[i].ClienteId == clienteId && Enderecos[i].Id != exceto)
            {
                Enderecos[i] = Enderecos[i] with { Principal = false };
            }
        }
    }
}

internal sealed class FakeTipoCascoLeituraRepository : ITipoCascoLeituraRepository
{
    private readonly Dictionary<Guid, TipoCascoCliente> tipos = new();

    /// <summary>Tipo apagado não é cadastrado aqui: a leitura devolve null, como o Postgres com deleted_at.</summary>
    public TipoCascoCliente Add(string nome, decimal precoVasilhame = 0m, bool aceitaSucata = false)
    {
        var tipo = new TipoCascoCliente(Guid.NewGuid(), nome, aceitaSucata, precoVasilhame);
        tipos[tipo.Id] = tipo;
        return tipo;
    }

    public Task<TipoCascoCliente?> GetAsync(Guid tipoCascoId, CancellationToken cancellationToken) =>
        Task.FromResult(tipos.GetValueOrDefault(tipoCascoId));
}

/// <summary>
/// Ledger de casco em memória, por cliente e tipo. Registra as escritas para permitir
/// afirmar que a entrega de sucata NUNCA movimenta este ledger.
/// </summary>
internal sealed class FakeCascoClienteRepository : ICascoClienteRepository
{
    private readonly Dictionary<(Guid Cliente, Guid Tipo), long> saldos = new();

    public int TotalChamadasDeEscrita { get; private set; }

    public List<(Guid Tipo, int Quantidade, decimal ValorUnitario)> Conversoes { get; } = new();

    public void SetSaldo(Guid clienteId, Guid tipoCascoId, long saldo) => saldos[(clienteId, tipoCascoId)] = saldo;

    public Task<long> GetSaldoAsync(Guid clienteId, Guid tipoCascoId, CancellationToken cancellationToken) =>
        Task.FromResult(saldos.GetValueOrDefault((clienteId, tipoCascoId)));

    private long Total(Guid clienteId) => saldos.Where(kv => kv.Key.Cliente == clienteId).Sum(kv => kv.Value);

    public Task<ResultadoDevolucaoCasco> DevolverAsync(
        Guid clienteId, Guid tipoCascoId, int quantidade, CancellationToken cancellationToken)
    {
        TotalChamadasDeEscrita++;
        saldos[(clienteId, tipoCascoId)] = saldos.GetValueOrDefault((clienteId, tipoCascoId)) - quantidade;
        return Task.FromResult(new ResultadoDevolucaoCasco(Total(clienteId)));
    }

    public Task<ResultadoConversaoCasco> ConverterAsync(
        Guid clienteId, Guid tipoCascoId, int quantidade, decimal valorUnitario,
        CancellationToken cancellationToken)
    {
        TotalChamadasDeEscrita++;
        Conversoes.Add((tipoCascoId, quantidade, valorUnitario));
        saldos[(clienteId, tipoCascoId)] = saldos.GetValueOrDefault((clienteId, tipoCascoId)) - quantidade;
        return Task.FromResult(new ResultadoConversaoCasco(Total(clienteId), quantidade * valorUnitario));
    }
}

internal sealed class FakeSucataClienteRepository : ISucataClienteRepository
{
    private readonly Dictionary<Guid, long> totais = new();
    private readonly Dictionary<Guid, decimal> creditosFiado = new();

    public List<(Guid Tipo, int Quantidade)> Entregas { get; } = new();

    public Task<ResultadoEntregaSucata> EntregarAsync(
        Guid clienteId, Guid tipoCascoId, int quantidade, decimal? valorConversao,
        CancellationToken cancellationToken)
    {
        Entregas.Add((tipoCascoId, quantidade));
        totais[clienteId] = totais.GetValueOrDefault(clienteId) + quantidade;
        if (valorConversao is > 0)
        {
            creditosFiado[clienteId] = creditosFiado.GetValueOrDefault(clienteId) - valorConversao.Value;
        }

        return Task.FromResult(new ResultadoEntregaSucata(
            totais[clienteId], creditosFiado.GetValueOrDefault(clienteId)));
    }
}
