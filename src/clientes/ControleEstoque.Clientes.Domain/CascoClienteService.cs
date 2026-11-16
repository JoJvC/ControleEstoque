using ControleEstoque.Shared.Results;

namespace ControleEstoque.Clientes.Domain;

public interface ICascoClienteService
{
    Task<ResultadoDevolucaoCasco> DevolverAsync(
        Guid clienteId, IReadOnlyList<LinhaDevolucaoCasco>? linhas, CancellationToken cancellationToken);
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
        Guid clienteId, IReadOnlyList<LinhaDevolucaoCasco>? linhas, CancellationToken cancellationToken)
    {
        if (linhas is null || linhas.Count == 0)
        {
            throw new RequestValidationException("ITENS_OBRIGATORIOS", "Informe ao menos um tipo de casco.");
        }

        if (linhas.Any(l => l.Quantidade <= 0))
        {
            throw new RequestValidationException("QUANTIDADE_INVALIDA", "Quantidade deve ser positiva.");
        }

        if (linhas.GroupBy(l => l.TipoCascoId).Any(g => g.Count() > 1))
        {
            throw new RequestValidationException(
                "TIPO_CASCO_DUPLICADO", "Cada tipo de casco aparece no máximo uma vez.");
        }

        await GarantirClienteAsync(clienteId, cancellationToken);
        foreach (var linha in linhas)
        {
            await ObterTipoAsync(linha.TipoCascoId, cancellationToken);
        }

        return await cascos.DevolverAsync(clienteId, linhas, cancellationToken);
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
