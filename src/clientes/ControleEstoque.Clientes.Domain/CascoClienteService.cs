using ControleEstoque.Shared.Results;

namespace ControleEstoque.Clientes.Domain;

public interface ICascoClienteService
{
    Task<ResultadoDevolucaoCasco> DevolverAsync(
        Guid clienteId, int quantidade, CancellationToken cancellationToken);
    Task<ResultadoConversaoCasco> ConverterAsync(
        Guid clienteId, int quantidade, decimal valorUnitario, CancellationToken cancellationToken);
}

public sealed class CascoClienteService : ICascoClienteService
{
    private readonly ICascoClienteRepository cascos;
    private readonly IClienteRepository clientes;

    public CascoClienteService(ICascoClienteRepository cascos, IClienteRepository clientes)
    {
        this.cascos = cascos;
        this.clientes = clientes;
    }

    public async Task<ResultadoDevolucaoCasco> DevolverAsync(
        Guid clienteId, int quantidade, CancellationToken cancellationToken)
    {
        if (quantidade <= 0)
        {
            throw new RequestValidationException("QUANTIDADE_INVALIDA", "Quantidade deve ser positiva.");
        }

        await GarantirClienteAsync(clienteId, cancellationToken);
        return await cascos.DevolverAsync(clienteId, quantidade, cancellationToken);
    }

    public async Task<ResultadoConversaoCasco> ConverterAsync(
        Guid clienteId, int quantidade, decimal valorUnitario, CancellationToken cancellationToken)
    {
        if (quantidade <= 0)
        {
            throw new RequestValidationException("QUANTIDADE_INVALIDA", "Quantidade deve ser positiva.");
        }

        if (valorUnitario <= 0)
        {
            throw new RequestValidationException("VALOR_INVALIDO", "Valor unitário deve ser positivo.");
        }

        await GarantirClienteAsync(clienteId, cancellationToken);

        var saldo = await cascos.GetSaldoAsync(clienteId, cancellationToken);
        if (quantidade > saldo)
        {
            throw new BusinessRuleException(
                "CONVERSAO_MAIOR_QUE_SALDO",
                $"Cliente deve {saldo} casco(s); não é possível converter {quantidade}.");
        }

        return await cascos.ConverterAsync(clienteId, quantidade, valorUnitario, cancellationToken);
    }

    private async Task GarantirClienteAsync(Guid clienteId, CancellationToken cancellationToken)
    {
        if (!await clientes.ExistsAsync(clienteId, cancellationToken))
        {
            throw new EntityNotFoundException("CLIENTE_NAO_ENCONTRADO", $"Cliente {clienteId} não encontrado.");
        }
    }
}
