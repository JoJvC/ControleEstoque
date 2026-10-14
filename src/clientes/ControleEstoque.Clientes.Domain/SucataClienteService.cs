using ControleEstoque.Shared.Results;

namespace ControleEstoque.Clientes.Domain;

public interface ISucataClienteService
{
    Task<ResultadoEntregaSucata> EntregarAsync(
        Guid clienteId, int quantidade, decimal? valorConversao, CancellationToken cancellationToken);
}

/// <summary>
/// Entrega de sucata é um recebimento independente: NÃO abate o débito de
/// casco normal do cliente (regra crítica 1 do plano).
/// </summary>
public sealed class SucataClienteService : ISucataClienteService
{
    private readonly ISucataClienteRepository sucatas;
    private readonly IClienteRepository clientes;

    public SucataClienteService(ISucataClienteRepository sucatas, IClienteRepository clientes)
    {
        this.sucatas = sucatas;
        this.clientes = clientes;
    }

    public async Task<ResultadoEntregaSucata> EntregarAsync(
        Guid clienteId, int quantidade, decimal? valorConversao, CancellationToken cancellationToken)
    {
        if (quantidade <= 0)
        {
            throw new RequestValidationException("QUANTIDADE_INVALIDA", "Quantidade deve ser positiva.");
        }

        if (valorConversao is <= 0)
        {
            throw new RequestValidationException(
                "VALOR_INVALIDO", "Valor de conversão, quando informado, deve ser positivo.");
        }

        if (!await clientes.ExistsAsync(clienteId, cancellationToken))
        {
            throw new EntityNotFoundException("CLIENTE_NAO_ENCONTRADO", $"Cliente {clienteId} não encontrado.");
        }

        return await sucatas.EntregarAsync(clienteId, quantidade, valorConversao, cancellationToken);
    }
}
