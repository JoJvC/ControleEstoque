namespace ControleEstoque.Financeiro.Domain;

public interface ICaixaRepository
{
    /// <summary>Abre o caixa do dia (um por data). Lança ConflictException se já existir.</summary>
    Task<Caixa> AbrirAsync(DateOnly? data, decimal saldoInicial, CancellationToken cancellationToken);

    Task<Caixa?> GetAsync(Guid id, CancellationToken cancellationToken);
    Task<Caixa?> GetByDataAsync(DateOnly data, CancellationToken cancellationToken);

    Task AddDespesaAsync(
        Guid caixaId, Guid tipoDespesaId, decimal valor, string? descricao,
        CancellationToken cancellationToken);

    /// <summary>Entradas do dia: pagamentos de venda + pagamentos de fiado lançados na data.</summary>
    Task<decimal> GetEntradasAsync(DateOnly data, CancellationToken cancellationToken);

    Task<IReadOnlyList<Despesa>> ListDespesasAsync(Guid caixaId, CancellationToken cancellationToken);

    /// <summary>
    /// Fecha o caixa em uma transação: lança DIARIA na conta corrente de cada
    /// funcionário (regra crítica 7 — diária NÃO é saída de caixa) e grava os
    /// consolidados.
    /// </summary>
    Task FecharAsync(
        Guid caixaId,
        IReadOnlyList<(Guid FuncionarioId, decimal Valor)> diarias,
        decimal totalEntradas,
        decimal totalSaidas,
        decimal saldoFinal,
        CancellationToken cancellationToken);

    /// <summary>Valor de diária cadastrado por funcionário; ausência indica funcionário inexistente.</summary>
    Task<IReadOnlyDictionary<Guid, decimal>> GetValoresDiariaAsync(
        IReadOnlyCollection<Guid> funcionarioIds, CancellationToken cancellationToken);
}

public interface ITipoDespesaRepository
{
    Task<TipoDespesa> CreateAsync(string nome, CancellationToken cancellationToken);
    Task<IReadOnlyList<TipoDespesa>> ListAsync(CancellationToken cancellationToken);
    Task<bool> ExistsAsync(Guid id, CancellationToken cancellationToken);
}

public interface IFiadoRepository
{
    Task<bool> ClienteExisteAsync(Guid clienteId, CancellationToken cancellationToken);
    Task<decimal> GetSaldoAsync(Guid clienteId, CancellationToken cancellationToken);

    /// <summary>Lança PAGAMENTO no fiado e retorna o novo saldo devedor.</summary>
    Task<decimal> PagarAsync(
        Guid clienteId, decimal valor, string? observacao, CancellationToken cancellationToken);

    Task<IReadOnlyList<SaldoFiadoCliente>> ListSaldosDevedoresAsync(CancellationToken cancellationToken);
}

public interface IRelatorioCaixaRepository
{
    Task<RelatorioCaixa> CaixaPorPeriodoAsync(
        DateOnly? inicio, DateOnly? fim, CancellationToken cancellationToken);
}
