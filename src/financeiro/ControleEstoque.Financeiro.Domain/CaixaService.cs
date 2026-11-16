using ControleEstoque.Shared.Results;

namespace ControleEstoque.Financeiro.Domain;

public interface ICaixaService
{
    Task<Caixa> AbrirAsync(DateOnly? data, decimal saldoInicial, CancellationToken cancellationToken);
    Task<ResumoCaixa> ObterResumoAsync(DateOnly data, CancellationToken cancellationToken);
    Task AdicionarDespesaAsync(
        Guid caixaId, Guid tipoDespesaId, decimal valor, string? descricao,
        CancellationToken cancellationToken);
    Task<ResultadoFechamento> FecharAsync(
        Guid caixaId, IReadOnlyList<DiariaFechamento> funcionariosPresentes, CancellationToken cancellationToken);

    /// <summary>Fecha pelo sistema os caixas abertos de dia anterior ao de hoje em São Paulo; devolve quantos.</summary>
    Task<int> FecharVencidosAsync(CancellationToken cancellationToken);

    Task<ResultadoLancamentoDiarias> LancarDiariasPendentesAsync(
        Guid caixaId, IReadOnlyList<DiariaFechamento> funcionariosPresentes, CancellationToken cancellationToken);
}

public sealed class CaixaService : ICaixaService
{
    private readonly ICaixaRepository caixas;
    private readonly ITipoDespesaRepository tiposDespesa;
    private readonly TimeProvider relogio;

    public CaixaService(
        ICaixaRepository caixas, ITipoDespesaRepository tiposDespesa, TimeProvider? relogio = null)
    {
        this.caixas = caixas;
        this.tiposDespesa = tiposDespesa;
        this.relogio = relogio ?? TimeProvider.System;
    }

    public async Task<Caixa> AbrirAsync(DateOnly? data, decimal saldoInicial, CancellationToken cancellationToken)
    {
        await FecharVencidosAsync(cancellationToken);

        if (saldoInicial < 0)
        {
            throw new RequestValidationException("SALDO_INVALIDO", "Saldo inicial não pode ser negativo.");
        }

        return await caixas.AbrirAsync(data, saldoInicial, cancellationToken);
    }

    public async Task<ResumoCaixa> ObterResumoAsync(DateOnly data, CancellationToken cancellationToken)
    {
        await FecharVencidosAsync(cancellationToken);

        var caixa = await caixas.GetByDataAsync(data, cancellationToken)
            ?? throw new EntityNotFoundException("CAIXA_NAO_ENCONTRADO", $"Não há caixa para {data:yyyy-MM-dd}.");

        var entradas = await caixas.GetEntradasAsync(data, cancellationToken);
        var despesas = await caixas.ListDespesasAsync(caixa.Id, cancellationToken);
        var totalDespesas = despesas.Sum(d => d.Valor);

        return new ResumoCaixa(
            caixa, entradas, totalDespesas,
            caixa.SaldoInicial + entradas - totalDespesas, despesas,
            await caixas.ListComDiariasPendentesAsync(cancellationToken));
    }

    public async Task AdicionarDespesaAsync(
        Guid caixaId, Guid tipoDespesaId, decimal valor, string? descricao,
        CancellationToken cancellationToken)
    {
        if (valor <= 0)
        {
            throw new RequestValidationException("VALOR_INVALIDO", "Valor da despesa deve ser positivo.");
        }

        Validacao.IdPreenchido(tipoDespesaId, "TipoDespesaId");

        // A checagem de caixa fechado é do repositório (atômica com o INSERT).
        await ObterCaixaAsync(caixaId, cancellationToken);

        // Toda despesa deve ter um tipo associado (regra de negócio do caixa).
        if (!await tiposDespesa.ExistsAsync(tipoDespesaId, cancellationToken))
        {
            throw new BusinessRuleException(
                "TIPO_DESPESA_INEXISTENTE", $"Tipo de despesa {tipoDespesaId} não cadastrado.");
        }

        await caixas.AddDespesaAsync(caixaId, tipoDespesaId, valor, descricao, cancellationToken);
    }

    public async Task<ResultadoFechamento> FecharAsync(
        Guid caixaId, IReadOnlyList<DiariaFechamento> funcionariosPresentes, CancellationToken cancellationToken)
    {
        ValidarDiarias(funcionariosPresentes);

        // Estado, diárias, entradas e despesas são lidos pelo repositório, na transação do fechamento.
        return await caixas.FecharAsync(caixaId, funcionariosPresentes, cancellationToken);
    }

    public async Task<int> FecharVencidosAsync(CancellationToken cancellationToken)
    {
        var hoje = RelogioCaixa.HojeEmSaoPaulo(relogio.GetUtcNow());
        var fechados = 0;
        foreach (var caixa in await caixas.ListAbertosAntesDeAsync(hoje, cancellationToken))
        {
            if (await caixas.FecharPeloSistemaAsync(
                    caixa.Id, RelogioCaixa.MeiaNoiteSeguinte(caixa.Data), cancellationToken))
            {
                fechados++;
            }
        }

        return fechados;
    }

    public async Task<ResultadoLancamentoDiarias> LancarDiariasPendentesAsync(
        Guid caixaId, IReadOnlyList<DiariaFechamento> funcionariosPresentes, CancellationToken cancellationToken)
    {
        ValidarDiarias(funcionariosPresentes);

        // Pré-checagem; o repositório repete sob a trava FOR UPDATE.
        var caixa = await ObterCaixaAsync(caixaId, cancellationToken);
        if (!caixa.FechadoPeloSistema)
        {
            throw new BusinessRuleException(
                "CAIXA_SEM_DIARIAS_PENDENTES", "O caixa não foi fechado pelo sistema: não há diárias pendentes.");
        }

        if (!caixa.DiariasPendentes)
        {
            throw DiariasJaLancadas(caixa.Data);
        }

        return await caixas.LancarDiariasPendentesAsync(
            caixaId, funcionariosPresentes, RelogioCaixa.InstanteDaDiaria(caixa.Data), cancellationToken);
    }

    public static ConflictException DiariasJaLancadas(DateOnly data) =>
        new("DIARIAS_JA_LANCADAS", $"As diárias do caixa de {data:dd/MM/yyyy} já foram lançadas.");

    private static void ValidarDiarias(IReadOnlyList<DiariaFechamento> funcionariosPresentes)
    {
        foreach (var diaria in funcionariosPresentes)
        {
            Validacao.IdPreenchido(diaria.FuncionarioId, "FuncionarioId");
        }

        // Falta = funcionário simplesmente não listado; Valor nulo usa a diária do cadastro.
        if (funcionariosPresentes.Select(d => d.FuncionarioId).Distinct().Count() != funcionariosPresentes.Count)
        {
            throw new RequestValidationException(
                "FUNCIONARIO_DUPLICADO", "Funcionário repetido na lista de presentes.");
        }

        if (funcionariosPresentes.Any(d => d.Valor < 0))
        {
            throw new RequestValidationException(
                "DIARIA_INVALIDA", "Valor da diária não pode ser negativo.");
        }
    }

    private async Task<Caixa> ObterCaixaAsync(Guid caixaId, CancellationToken cancellationToken)
        => await caixas.GetAsync(caixaId, cancellationToken)
            ?? throw new EntityNotFoundException("CAIXA_NAO_ENCONTRADO", $"Caixa {caixaId} não encontrado.");
}
