using ControleEstoque.Shared.Results;

namespace ControleEstoque.Financeiro.Domain;

public static class PermissoesCaixa
{
    public const string Reabrir = "caixa.reabrir";

    /// <summary>Exige <c>caixa.reabrir</c> (ou <c>*</c>) do funcionário informado.</summary>
    public static async Task ExigirReabrirAsync(
        IPermissaoFuncionarioLookup permissoes, Guid funcionarioId, CancellationToken cancellationToken)
    {
        Validacao.IdPreenchido(funcionarioId, "FuncionarioId");
        var lista = await permissoes.PermissoesAsync(funcionarioId, cancellationToken)
            ?? throw new EntityNotFoundException(
                "FUNCIONARIO_NAO_ENCONTRADO", $"Funcionário {funcionarioId} não encontrado.");
        if (!lista.Contains(Reabrir) && !lista.Contains("*"))
        {
            throw new ForbiddenException($"Funcionário sem a permissão {Reabrir}.");
        }
    }
}
