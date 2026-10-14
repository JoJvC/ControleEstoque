using ControleEstoque.RH.Domain;

namespace ControleEstoque.RH.Contracts;

public sealed record CreateCargoRequest(string Nome, List<string>? Permissoes);

public sealed record CargoResponse(Guid Id, string Nome, bool Nativo, IReadOnlyList<string> Permissoes)
{
    public static CargoResponse From(Cargo c) => new(c.Id, c.Nome, c.Nativo, c.Permissoes);
}

public sealed record CreateFuncionarioRequest(
    string Nome, string? Telefone, Guid CargoId, decimal ValorDiaria, bool Ativo = true);

public sealed record FuncionarioResponse(
    Guid Id, string Nome, string? Telefone, Guid CargoId, string? Cargo, decimal ValorDiaria, bool Ativo)
{
    public static FuncionarioResponse From(Funcionario f) => new(
        f.Id, f.Nome, f.Telefone, f.CargoId, f.CargoNome, f.ValorDiaria, f.Ativo);
}

public sealed record LancamentoResponse(
    Guid Id, TipoLancamentoFuncionario Tipo, decimal Valor, DateTimeOffset Data, string? Observacao);

public sealed record ExtratoResponse(
    Guid FuncionarioId, decimal SaldoAPagar, IReadOnlyList<LancamentoResponse> Lancamentos)
{
    public static ExtratoResponse From(ExtratoFuncionario e) => new(
        e.FuncionarioId, e.SaldoAPagar,
        e.Lancamentos.Select(l =>
            new LancamentoResponse(l.Id, l.Tipo, l.Valor, l.Data, l.Observacao)).ToList());
}

public sealed record LancamentoContaRequest(decimal Valor, string? Observacao);

public sealed record SaldoContaResponse(decimal SaldoAPagar);
