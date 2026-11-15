using ControleEstoque.Shared.Results;

namespace ControleEstoque.Financeiro.Domain;

public interface IFiadoService
{
    Task<decimal> PagarAsync(
        Guid clienteId, decimal valor, string? forma, CancellationToken cancellationToken);
}

public sealed class FiadoService : IFiadoService
{
    private readonly IFiadoRepository fiado;

    public FiadoService(IFiadoRepository fiado) => this.fiado = fiado;

    public async Task<decimal> PagarAsync(
        Guid clienteId, decimal valor, string? forma, CancellationToken cancellationToken)
    {
        if (valor <= 0)
        {
            throw new RequestValidationException("VALOR_INVALIDO", "Valor do pagamento deve ser positivo.");
        }

        if (!await fiado.ClienteExisteAsync(clienteId, cancellationToken))
        {
            throw new EntityNotFoundException("CLIENTE_NAO_ENCONTRADO", $"Cliente {clienteId} não encontrado.");
        }

        var observacao = string.IsNullOrWhiteSpace(forma)
            ? "Pagamento de fiado"
            : $"Pagamento de fiado ({forma})";
        return await fiado.PagarAsync(clienteId, valor, observacao, cancellationToken);
    }
}
