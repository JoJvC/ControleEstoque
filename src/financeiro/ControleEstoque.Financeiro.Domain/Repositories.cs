namespace ControleEstoque.Financeiro.Domain;

public interface ICaixaRepository
{
    /// <summary>Abre o caixa do dia (um por data). Lança ConflictException se já existir.</summary>
    Task<Caixa> AbrirAsync(DateOnly? data, decimal saldoInicial, CancellationToken cancellationToken);

    Task<Caixa?> GetAsync(Guid id, CancellationToken cancellationToken);
    Task<Caixa?> GetByDataAsync(DateOnly data, CancellationToken cancellationToken);

    /// <summary>
    /// Lança a despesa na mesma transação que trava o caixa (FOR SHARE); caixa FECHADO lança
    /// ConflictException CAIXA_FECHADO e nada é gravado.
    /// </summary>
    Task AddDespesaAsync(
        Guid caixaId, Guid tipoDespesaId, decimal valor, string? descricao,
        CancellationToken cancellationToken);

    /// <summary>Entradas do dia: pagamentos de venda + pagamentos de fiado lançados na data.</summary>
    Task<decimal> GetEntradasAsync(DateOnly data, CancellationToken cancellationToken);

    Task<IReadOnlyList<Despesa>> ListDespesasAsync(Guid caixaId, CancellationToken cancellationToken);

    /// <summary>
    /// Fecha o caixa em uma transação: trava o caixa (FOR UPDATE), lê diárias, entradas e despesas dentro
    /// dela, lança DIARIA na conta corrente de cada funcionário (regra crítica 7 — diária NÃO é saída
    /// de caixa) e grava os consolidados. Lança EntityNotFoundException (caixa ou funcionário) e
    /// ConflictException CAIXA_JA_FECHADO (inclusive sob corrida).
    /// </summary>
    Task<ResultadoFechamento> FecharAsync(
        Guid caixaId, IReadOnlyList<DiariaFechamento> funcionarioIds, CancellationToken cancellationToken);
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

    /// <summary>
    /// Lança PAGAMENTO do valor inteiro no fiado, abate as vendas PENDENTE/PARCIAL do cliente da mais antiga
    /// para a mais nova (FiadoFifo) e retorna o novo saldo devedor (negativo = crédito: o que passa do devido
    /// vira crédito do cliente). Na mesma transação trava o caixa de hoje (FOR SHARE; FECHADO lança
    /// ConflictException CAIXA_FECHADO), o cliente e as vendas (FOR UPDATE).
    /// </summary>
    Task<ResultadoPagamentoFiado> PagarAsync(
        Guid clienteId, decimal valor, FormaPagamento forma, CancellationToken cancellationToken);

    Task<IReadOnlyList<SaldoFiadoCliente>> ListSaldosDevedoresAsync(CancellationToken cancellationToken);
}

public interface IRelatorioCaixaRepository
{
    Task<RelatorioCaixa> CaixaPorPeriodoAsync(
        DateOnly? inicio, DateOnly? fim, CancellationToken cancellationToken);
}
