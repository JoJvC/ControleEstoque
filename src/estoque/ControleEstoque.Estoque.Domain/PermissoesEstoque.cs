using ControleEstoque.Shared.Results;

namespace ControleEstoque.Estoque.Domain;

public static class PermissoesEstoque
{
    public const string Custos = "estoque.custos";

    /// <summary>Exige <c>estoque.custos</c> (ou <c>*</c>) do funcionário informado.</summary>
    public static async Task ExigirCustosAsync(
        IPermissaoFuncionarioLookup permissoes, Guid funcionarioId, CancellationToken cancellationToken)
    {
        Validacao.IdPreenchido(funcionarioId, "FuncionarioId");
        var lista = await permissoes.PermissoesAsync(funcionarioId, cancellationToken)
            ?? throw new EntityNotFoundException(
                "FUNCIONARIO_NAO_ENCONTRADO", $"Funcionário {funcionarioId} não encontrado.");
        if (!lista.Contains(Custos) && !lista.Contains("*"))
        {
            throw new ForbiddenException($"Funcionário sem a permissão {Custos}.");
        }
    }
}
