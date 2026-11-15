using ControleEstoque.Shared.Results;

namespace ControleEstoque.Clientes.Domain;

public interface ICascoClienteService
{
    Task<ResultadoDevolucaoCasco> DevolverAsync(
        Guid clienteId, Guid tipoCascoId, int quantidade, CancellationToken cancellationToken);
    Task<ResultadoConversaoCasco> ConverterAsync(
        Guid clienteId, Guid tipoCascoId, int quantidade, CancellationToken cancellationToken);
}

public sealed class CascoClienteService : ICascoClienteService
{
    private readonly ICascoClienteRepository cascos;
    private readonly IClienteRepository clientes;
    private readonly ITipoCascoLeituraRepository tipos;

    public CascoClienteService(
        ICascoClienteRepository cascos, IClienteRepository clientes, ITipoCascoLeituraRepository tipos)
    {
        this.cascos = cascos;
        this.clientes = clientes;
        this.tipos = tipos;
    }

    public async Task<ResultadoDevolucaoCasco> DevolverAsync(
        Guid clienteId, Guid tipoCascoId, int quantidade, CancellationToken cancellationToken)
    {
        if (quantidade <= 0)
        {
            throw new RequestValidationException("QUANTIDADE_INVALIDA", "Quantidade deve ser positiva.");
        }

        await GarantirClienteAsync(clienteId, cancellationToken);
        await ObterTipoAsync(tipoCascoId, cancellationToken);
        return await cascos.DevolverAsync(clienteId, tipoCascoId, quantidade, cancellationToken);
    }

    public async Task<ResultadoConversaoCasco> ConverterAsync(
        Guid clienteId, Guid tipoCascoId, int quantidade, CancellationToken cancellationToken)
    {
        if (quantidade <= 0)
        {
            throw new RequestValidationException("QUANTIDADE_INVALIDA", "Quantidade deve ser positiva.");
        }

        await GarantirClienteAsync(clienteId, cancellationToken);
        var tipo = await ObterTipoAsync(tipoCascoId, cancellationToken);

        if (tipo.PrecoVasilhame <= 0)
        {
            throw new BusinessRuleException(
                "PRECO_VASILHAME_NAO_DEFINIDO",
                $"Tipo de casco '{tipo.Nome}' não tem preço de vasilhame; não é possível converter em valor.");
        }

        var saldo = await cascos.GetSaldoAsync(clienteId, tipoCascoId, cancellationToken);
        if (quantidade > saldo)
        {
            throw new BusinessRuleException(
                "CONVERSAO_MAIOR_QUE_SALDO",
                $"Cliente deve {saldo} casco(s) de '{tipo.Nome}'; não é possível converter {quantidade}.");
        }

        return await cascos.ConverterAsync(
            clienteId, tipoCascoId, quantidade, tipo.PrecoVasilhame, cancellationToken);
    }

    private async Task<TipoCascoCliente> ObterTipoAsync(Guid tipoCascoId, CancellationToken cancellationToken) =>
        await tipos.GetAsync(tipoCascoId, cancellationToken)
        ?? throw new EntityNotFoundException(
            "TIPO_CASCO_NAO_ENCONTRADO", $"Tipo de casco {tipoCascoId} não encontrado.");

    private async Task GarantirClienteAsync(Guid clienteId, CancellationToken cancellationToken)
    {
        if (!await clientes.ExistsAsync(clienteId, cancellationToken))
        {
            throw new EntityNotFoundException("CLIENTE_NAO_ENCONTRADO", $"Cliente {clienteId} não encontrado.");
        }
    }
}
