using ControleEstoque.Shared.Results;

namespace ControleEstoque.Clientes.Domain;

public interface ISucataClienteService
{
    Task<ResultadoEntregaSucata> EntregarAsync(
        Guid clienteId, Guid tipoCascoId, int quantidade, decimal? valorConversao,
        CancellationToken cancellationToken);
}

/// <summary>
/// Entrega de sucata é um recebimento independente: NÃO abate o débito de
/// casco normal do cliente (regra crítica 1 do plano).
/// </summary>
public sealed class SucataClienteService : ISucataClienteService
{
    private readonly ISucataClienteRepository sucatas;
    private readonly IClienteRepository clientes;
    private readonly ITipoCascoLeituraRepository tipos;

    public SucataClienteService(
        ISucataClienteRepository sucatas, IClienteRepository clientes, ITipoCascoLeituraRepository tipos)
    {
        this.sucatas = sucatas;
        this.clientes = clientes;
        this.tipos = tipos;
    }

    public async Task<ResultadoEntregaSucata> EntregarAsync(
        Guid clienteId, Guid tipoCascoId, int quantidade, decimal? valorConversao,
        CancellationToken cancellationToken)
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

        var tipo = await tipos.GetAsync(tipoCascoId, cancellationToken)
            ?? throw new EntityNotFoundException(
                "TIPO_CASCO_NAO_ENCONTRADO", $"Tipo de casco {tipoCascoId} não encontrado.");
        if (!tipo.AceitaSucata)
        {
            throw new BusinessRuleException(
                "SUCATA_NAO_ACEITA", $"Tipo de casco '{tipo.Nome}' não aceita sucata.");
        }

        return await sucatas.EntregarAsync(clienteId, tipoCascoId, quantidade, valorConversao, cancellationToken);
    }
}
