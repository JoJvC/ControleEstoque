using ControleEstoque.Shared.Results;

namespace ControleEstoque.Vendas.Domain;

public static class PermissoesVendas
{
    public const string Cancelar = "vendas.cancelar";

    /// <summary>Exige <c>vendas.cancelar</c> (ou <c>*</c>) do funcionário informado.</summary>
    public static async Task ExigirCancelarAsync(
        IPermissaoFuncionarioLookup permissoes, Guid funcionarioId, CancellationToken cancellationToken)
    {
        Validacao.IdPreenchido(funcionarioId, "FuncionarioId");
        var lista = await permissoes.PermissoesAsync(funcionarioId, cancellationToken)
            ?? throw new EntityNotFoundException(
                "FUNCIONARIO_NAO_ENCONTRADO", $"Funcionário {funcionarioId} não encontrado.");
        if (!lista.Contains(Cancelar) && !lista.Contains("*"))
        {
            throw new ForbiddenException($"Funcionário sem a permissão {Cancelar}.");
        }
    }
}
