namespace ControleEstoque.RH.Domain;

public interface ICargoRepository
{
    Task CreateAsync(Cargo cargo, CancellationToken cancellationToken);
    Task<Cargo?> GetAsync(Guid id, CancellationToken cancellationToken);
    Task<IReadOnlyList<Cargo>> ListAsync(CancellationToken cancellationToken);

    /// <summary>Atualiza nome e permissões (substituição completa das permissões).</summary>
    Task UpdateAsync(Cargo cargo, CancellationToken cancellationToken);

    Task<bool> ExistsAsync(Guid id, CancellationToken cancellationToken);
}

public interface IFuncionarioRepository
{
    Task CreateAsync(Funcionario funcionario, CancellationToken cancellationToken);
    Task<bool> UpdateAsync(Funcionario funcionario, CancellationToken cancellationToken);
    Task<Funcionario?> GetAsync(Guid id, CancellationToken cancellationToken);
    Task<bool> ExistsAsync(Guid id, CancellationToken cancellationToken);
    Task<IReadOnlyList<Funcionario>> ListAsync(CancellationToken cancellationToken);
}

public interface IContaFuncionarioRepository
{
    Task<decimal> GetSaldoAsync(Guid funcionarioId, CancellationToken cancellationToken);
    Task AddLancamentoAsync(
        Guid funcionarioId, TipoLancamentoFuncionario tipo, decimal valor, string? observacao,
        CancellationToken cancellationToken);
    /// <summary>
    /// Grava o pagamento só se <paramref name="valor"/> couber no saldo, lido e gravado de forma atômica.
    /// Devolve o saldo resultante quando gravou; quando não coube, <c>Registrado = false</c> e o saldo atual.
    /// </summary>
    Task<(bool Registrado, decimal Saldo)> AddPagamentoAsync(
        Guid funcionarioId, decimal valor, string? observacao, CancellationToken cancellationToken);
    Task<IReadOnlyList<LancamentoFuncionario>> GetLancamentosAsync(
        Guid funcionarioId, CancellationToken cancellationToken);
    Task<IReadOnlyList<SaldoFuncionario>> ListSaldosAsync(CancellationToken cancellationToken);
}
