using ControleEstoque.Shared.Results;

namespace ControleEstoque.Financeiro.Domain;

public interface IFiadoService
{
    Task<ResultadoPagamentoFiado> PagarAsync(
        Guid clienteId, decimal valor, string? forma, CancellationToken cancellationToken);
}

public sealed class FiadoService : IFiadoService
{
    private readonly IFiadoRepository fiado;

    public FiadoService(IFiadoRepository fiado) => this.fiado = fiado;

    public async Task<ResultadoPagamentoFiado> PagarAsync(
        Guid clienteId, decimal valor, string? forma, CancellationToken cancellationToken)
    {
        if (valor <= 0)
        {
            throw new RequestValidationException("VALOR_INVALIDO", "Valor do pagamento deve ser positivo.");
        }

        var formaPagamento = ValidarForma(forma);

        if (!await fiado.ClienteExisteAsync(clienteId, cancellationToken))
        {
            throw new EntityNotFoundException("CLIENTE_NAO_ENCONTRADO", $"Cliente {clienteId} não encontrado.");
        }

        return await fiado.PagarAsync(clienteId, valor, formaPagamento, cancellationToken);
    }

    // Só o nome exato do enum vale: Enum.TryParse aceitaria minúsculas e números como "1".
    private static FormaPagamento ValidarForma(string? forma)
    {
        if (string.IsNullOrWhiteSpace(forma))
        {
            throw new RequestValidationException("FORMA_OBRIGATORIA", "Forma de pagamento é obrigatória.");
        }

        if (!Enum.GetNames<FormaPagamento>().Contains(forma))
        {
            throw new RequestValidationException(
                "VALOR_ENUM_INVALIDO", $"Valor '{forma}' inválido para forma.");
        }

        var parsed = Enum.Parse<FormaPagamento>(forma);
        if (parsed == FormaPagamento.CREDITO_CLIENTE)
        {
            throw new BusinessRuleException(
                "FORMA_NAO_PERMITIDA", "Crédito do cliente só pode ser usado ao registrar a venda.");
        }

        return parsed;
    }
}
