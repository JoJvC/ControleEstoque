namespace ControleEstoque.RH.Domain;

public enum TipoLancamentoFuncionario
{
    DIARIA,
    VALE,
    PAGAMENTO
}

public sealed record Cargo(Guid Id, string Nome, bool Nativo, IReadOnlyList<string> Permissoes);

public sealed record Funcionario(
    Guid Id,
    string Nome,
    string? Telefone,
    Guid CargoId,
    string? CargoNome,
    decimal ValorDiaria,
    bool Ativo);

public sealed record LancamentoFuncionario(
    Guid Id,
    TipoLancamentoFuncionario Tipo,
    decimal Valor,
    DateTimeOffset Data,
    string? Observacao);

public sealed record ExtratoFuncionario(
    Guid FuncionarioId,
    decimal SaldoAPagar,
    IReadOnlyList<LancamentoFuncionario> Lancamentos);

public sealed record SaldoFuncionario(Guid FuncionarioId, string Nome, decimal SaldoAPagar);
