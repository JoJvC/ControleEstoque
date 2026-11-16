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

    /// <summary>Caixas (não apagados) de <paramref name="inicio"/> a <paramref name="fim"/>, data decrescente.</summary>
    Task<IReadOnlyList<Caixa>> ListByPeriodoAsync(DateOnly inicio, DateOnly fim, CancellationToken cancellationToken);

    /// <summary>Entradas do dia uma a uma, com o mesmo filtro de <see cref="GetEntradasAsync"/>.</summary>
    Task<IReadOnlyList<EntradaCaixa>> ListEntradasAsync(DateOnly data, CancellationToken cancellationToken);

    Task<IReadOnlyList<DiariaLancada>> ListDiariasAsync(Guid caixaId, CancellationToken cancellationToken);

    Task<AuditoriaCaixa> GetAuditoriaAsync(Guid caixaId, CancellationToken cancellationToken);

    /// <summary>
    /// Fecha o caixa em uma transação: trava o caixa (FOR UPDATE), lê diárias, entradas e despesas dentro
    /// dela, lança DIARIA na conta corrente de cada funcionário (regra crítica 7 — diária NÃO é saída
    /// de caixa) e grava os consolidados. Lança EntityNotFoundException (caixa ou funcionário) e
    /// ConflictException CAIXA_JA_FECHADO (inclusive sob corrida). As diárias
    /// recebem created_at = <paramref name="instanteDiarias"/>; nulo mantém now().
    /// </summary>
    Task<ResultadoFechamento> FecharAsync(
        Guid caixaId, IReadOnlyList<DiariaFechamento> funcionarioIds, DateTimeOffset? instanteDiarias,
        CancellationToken cancellationToken);

    /// <summary>
    /// Caixas ABERTO (não apagados) com data anterior a <paramref name="data"/>, sem reabertura: o caixa reaberto
    /// só fecha à mão.
    /// </summary>
    Task<IReadOnlyList<Caixa>> ListAbertosAntesDeAsync(DateOnly data, CancellationToken cancellationToken);

    /// <summary>
    /// Fecha o caixa pelo sistema (FOR UPDATE; consolidados como no fechamento manual; fechado_em informado;
    /// diárias pendentes; nenhuma diária lançada). Devolve null, sem erro, se o caixa já não estiver ABERTO
    /// ou se tiver reabertura.
    /// </summary>
    Task<ResultadoFechamento?> FecharPeloSistemaAsync(
        Guid caixaId, DateTimeOffset fechadoEm, CancellationToken cancellationToken);

    /// <summary>Caixas fechados pelo sistema que ainda esperam o lançamento das diárias, por data.</summary>
    Task<IReadOnlyList<CaixaDiariasPendentes>> ListComDiariasPendentesAsync(CancellationToken cancellationToken);

    /// <summary>
    /// Lança as diárias de um caixa fechado pelo sistema, com created_at = <paramref name="instante"/>, e tira
    /// a pendência, na mesma transação (caixa travado FOR UPDATE). Não reabre o caixa. Lança
    /// EntityNotFoundException (caixa ou funcionário), BusinessRuleException CAIXA_SEM_DIARIAS_PENDENTES e
    /// ConflictException DIARIAS_JA_LANCADAS (inclusive sob corrida).
    /// </summary>
    Task<ResultadoLancamentoDiarias> LancarDiariasPendentesAsync(
        Guid caixaId, IReadOnlyList<DiariaFechamento> diarias, DateTimeOffset instante,
        CancellationToken cancellationToken);

    /// <summary>
    /// Reabre o caixa FECHADO numa transação (FOR UPDATE): grava a reabertura (quem, quando, motivo), volta o caixa
    /// a ABERTO sem os campos do fechamento nem as flags de sistema e soft-deleta as diárias do caixa (VALE e
    /// PAGAMENTO ficam). Lança EntityNotFoundException CAIXA_NAO_ENCONTRADO e ConflictException CAIXA_JA_ABERTO.
    /// </summary>
    Task<Caixa> ReabrirAsync(
        Guid caixaId, Guid funcionarioId, string motivo, DateTimeOffset reabertoEm,
        CancellationToken cancellationToken);
}

/// <summary>Permissões do cargo de um funcionário (a autenticação ainda não existe: ele vem informado).</summary>
public interface IPermissaoFuncionarioLookup
{
    /// <summary>Nulo se o funcionário não existe ou foi excluído; vazia se está inativo.</summary>
    Task<IReadOnlyList<string>?> PermissoesAsync(Guid funcionarioId, CancellationToken cancellationToken);
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
