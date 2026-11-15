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
    Task<Endereco> AtualizarEnderecoAsync(Endereco endereco, CancellationToken cancellationToken);
    Task RemoverEnderecoAsync(Guid clienteId, Guid enderecoId, CancellationToken cancellationToken);
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
        ValidarEndereco(endereco);
        await GarantirClienteAsync(endereco.ClienteId, cancellationToken);
        var existentes = await clientes.ListEnderecosAsync(endereco.ClienteId, cancellationToken);
        // Primeiro endereço ativo do cliente é sempre o principal.
        var novo = endereco with { Id = Guid.NewGuid(), Principal = endereco.Principal || existentes.Count == 0 };
        await clientes.AddEnderecoAsync(novo, novo.Principal, cancellationToken);
        return novo;
    }

    public async Task<Endereco> AtualizarEnderecoAsync(Endereco endereco, CancellationToken cancellationToken)
    {
        ValidarEndereco(endereco);
        await GarantirClienteAsync(endereco.ClienteId, cancellationToken);
        var atual = await ObterEnderecoAsync(endereco.ClienteId, endereco.Id, cancellationToken);
        // Não se desmarca o principal direto: só marcando outro.
        var atualizado = endereco with { Principal = endereco.Principal || atual.Principal };
        if (!await clientes.UpdateEnderecoAsync(atualizado, atualizado.Principal, cancellationToken))
        {
            throw EnderecoNaoEncontrado(endereco.Id);
        }

        return atualizado;
    }

    public async Task RemoverEnderecoAsync(Guid clienteId, Guid enderecoId, CancellationToken cancellationToken)
    {
        await GarantirClienteAsync(clienteId, cancellationToken);
        var existentes = await clientes.ListEnderecosAsync(clienteId, cancellationToken);
        var removido = existentes.FirstOrDefault(e => e.Id == enderecoId)
            ?? throw EnderecoNaoEncontrado(enderecoId);
        // Removeu o principal: promove o mais antigo dos que sobram (lista vem por created_at).
        Guid? promovido = removido.Principal
            ? existentes.FirstOrDefault(e => e.Id != enderecoId)?.Id
            : null;
        if (!await clientes.RemoveEnderecoAsync(clienteId, enderecoId, promovido, cancellationToken))
        {
            throw EnderecoNaoEncontrado(enderecoId);
        }
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

    private async Task<Endereco> ObterEnderecoAsync(Guid clienteId, Guid enderecoId, CancellationToken cancellationToken)
        => (await clientes.ListEnderecosAsync(clienteId, cancellationToken)).FirstOrDefault(e => e.Id == enderecoId)
            ?? throw EnderecoNaoEncontrado(enderecoId);

    private static EntityNotFoundException EnderecoNaoEncontrado(Guid id)
        => new("ENDERECO_NAO_ENCONTRADO", $"Endereço {id} não encontrado.");

    private static void ValidarEndereco(Endereco endereco)
    {
        if (string.IsNullOrWhiteSpace(endereco.Logradouro))
        {
            throw new RequestValidationException("LOGRADOURO_OBRIGATORIO", "Logradouro é obrigatório.");
        }
    }
}
