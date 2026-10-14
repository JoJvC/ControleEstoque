using ControleEstoque.Shared.Results;

namespace ControleEstoque.Clientes.Domain;

public interface IClienteService
{
    Task<Cliente> CriarAsync(Cliente cliente, CancellationToken cancellationToken);
    Task<Cliente> AtualizarAsync(Cliente cliente, CancellationToken cancellationToken);
    Task<Cliente> ObterAsync(Guid id, CancellationToken cancellationToken);
    Task<IReadOnlyList<Cliente>> ListarAsync(
        string? nome, int page, int pageSize, CancellationToken cancellationToken);
    Task<Endereco> AdicionarEnderecoAsync(Endereco endereco, CancellationToken cancellationToken);
    Task<SaldosCliente> ObterSaldosAsync(Guid id, CancellationToken cancellationToken);
}

public sealed class ClienteService : IClienteService
{
    private readonly IClienteRepository clientes;
    private readonly ISaldosRepository saldos;

    public ClienteService(IClienteRepository clientes, ISaldosRepository saldos)
    {
        this.clientes = clientes;
        this.saldos = saldos;
    }

    public async Task<Cliente> CriarAsync(Cliente cliente, CancellationToken cancellationToken)
    {
        Validar(cliente);
        var novo = cliente with { Id = cliente.Id == Guid.Empty ? Guid.NewGuid() : cliente.Id };
        await clientes.CreateAsync(novo, cancellationToken);
        return novo;
    }

    public async Task<Cliente> AtualizarAsync(Cliente cliente, CancellationToken cancellationToken)
    {
        Validar(cliente);
        if (!await clientes.UpdateAsync(cliente, cancellationToken))
        {
            throw new EntityNotFoundException("CLIENTE_NAO_ENCONTRADO", $"Cliente {cliente.Id} não encontrado.");
        }

        return cliente;
    }

    public async Task<Cliente> ObterAsync(Guid id, CancellationToken cancellationToken)
        => await clientes.GetAsync(id, cancellationToken)
            ?? throw new EntityNotFoundException("CLIENTE_NAO_ENCONTRADO", $"Cliente {id} não encontrado.");

    public Task<IReadOnlyList<Cliente>> ListarAsync(
        string? nome, int page, int pageSize, CancellationToken cancellationToken)
    {
        var pagina = Math.Max(1, page);
        var tamanho = Math.Clamp(pageSize, 1, 200);
        return clientes.ListAsync(nome, pagina, tamanho, cancellationToken);
    }

    public async Task<Endereco> AdicionarEnderecoAsync(Endereco endereco, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(endereco.Logradouro))
        {
            throw new RequestValidationException("LOGRADOURO_OBRIGATORIO", "Logradouro é obrigatório.");
        }

        await GarantirClienteAsync(endereco.ClienteId, cancellationToken);
        var novo = endereco with { Id = Guid.NewGuid() };
        await clientes.AddEnderecoAsync(novo, cancellationToken);
        return novo;
    }

    public async Task<SaldosCliente> ObterSaldosAsync(Guid id, CancellationToken cancellationToken)
    {
        await GarantirClienteAsync(id, cancellationToken);
        return await saldos.GetSaldosAsync(id, cancellationToken);
    }

    private async Task GarantirClienteAsync(Guid id, CancellationToken cancellationToken)
    {
        if (!await clientes.ExistsAsync(id, cancellationToken))
        {
            throw new EntityNotFoundException("CLIENTE_NAO_ENCONTRADO", $"Cliente {id} não encontrado.");
        }
    }

    private static void Validar(Cliente cliente)
    {
        if (string.IsNullOrWhiteSpace(cliente.Nome))
        {
            throw new RequestValidationException("NOME_OBRIGATORIO", "Nome do cliente é obrigatório.");
        }
    }
}
