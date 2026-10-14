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
        Guid caixaId, IReadOnlyList<Guid> funcionariosPresentes, CancellationToken cancellationToken);
}

public sealed class CaixaService : ICaixaService
{
    private readonly ICaixaRepository caixas;
    private readonly ITipoDespesaRepository tiposDespesa;

    public CaixaService(ICaixaRepository caixas, ITipoDespesaRepository tiposDespesa)
    {
        this.caixas = caixas;
        this.tiposDespesa = tiposDespesa;
    }

    public Task<Caixa> AbrirAsync(DateOnly? data, decimal saldoInicial, CancellationToken cancellationToken)
    {
        if (saldoInicial < 0)
        {
            throw new RequestValidationException("SALDO_INVALIDO", "Saldo inicial não pode ser negativo.");
        }

        return caixas.AbrirAsync(data, saldoInicial, cancellationToken);
    }

    public async Task<ResumoCaixa> ObterResumoAsync(DateOnly data, CancellationToken cancellationToken)
    {
        var caixa = await caixas.GetByDataAsync(data, cancellationToken)
            ?? throw new EntityNotFoundException("CAIXA_NAO_ENCONTRADO", $"Não há caixa para {data:yyyy-MM-dd}.");

        var entradas = await caixas.GetEntradasAsync(data, cancellationToken);
        var despesas = await caixas.ListDespesasAsync(caixa.Id, cancellationToken);
        var totalDespesas = despesas.Sum(d => d.Valor);

        return new ResumoCaixa(
            caixa, entradas, totalDespesas,
            caixa.SaldoInicial + entradas - totalDespesas, despesas);
    }

    public async Task AdicionarDespesaAsync(
        Guid caixaId, Guid tipoDespesaId, decimal valor, string? descricao,
        CancellationToken cancellationToken)
    {
        if (valor <= 0)
        {
            throw new RequestValidationException("VALOR_INVALIDO", "Valor da despesa deve ser positivo.");
        }

        var caixa = await ObterCaixaAsync(caixaId, cancellationToken);
        if (caixa.Status == StatusCaixa.FECHADO)
        {
            throw new BusinessRuleException("CAIXA_FECHADO", "Não é possível lançar despesa em caixa fechado.");
        }

        // Toda despesa deve ter um tipo associado (regra de negócio do caixa).
        if (!await tiposDespesa.ExistsAsync(tipoDespesaId, cancellationToken))
        {
            throw new BusinessRuleException(
                "TIPO_DESPESA_INEXISTENTE", $"Tipo de despesa {tipoDespesaId} não cadastrado.");
        }

        await caixas.AddDespesaAsync(caixaId, tipoDespesaId, valor, descricao, cancellationToken);
    }

    public async Task<ResultadoFechamento> FecharAsync(
        Guid caixaId, IReadOnlyList<Guid> funcionariosPresentes, CancellationToken cancellationToken)
    {
        var caixa = await ObterCaixaAsync(caixaId, cancellationToken);
        if (caixa.Status == StatusCaixa.FECHADO)
        {
            throw new BusinessRuleException("CAIXA_JA_FECHADO", "Caixa já foi fechado.");
        }

        // Falta = funcionário simplesmente não listado; diária usa o valor do cadastro.
        var presentes = funcionariosPresentes.Distinct().ToList();
        var valores = await caixas.GetValoresDiariaAsync(presentes, cancellationToken);
        var diarias = new List<(Guid FuncionarioId, decimal Valor)>();
        foreach (var funcionarioId in presentes)
        {
            if (!valores.TryGetValue(funcionarioId, out var valor))
            {
                throw new EntityNotFoundException(
                    "FUNCIONARIO_NAO_ENCONTRADO", $"Funcionário {funcionarioId} não encontrado.");
            }

            diarias.Add((funcionarioId, valor));
        }

        var entradas = await caixas.GetEntradasAsync(caixa.Data, cancellationToken);
        var despesas = await caixas.ListDespesasAsync(caixaId, cancellationToken);
        var totalSaidas = despesas.Sum(d => d.Valor); // diária NÃO sai do caixa (regra crítica 7)
        var saldoFinal = caixa.SaldoInicial + entradas - totalSaidas;

        await caixas.FecharAsync(caixaId, diarias, entradas, totalSaidas, saldoFinal, cancellationToken);
        return new ResultadoFechamento(caixaId, caixa.Data, entradas, totalSaidas, saldoFinal, diarias.Count);
    }

    private async Task<Caixa> ObterCaixaAsync(Guid caixaId, CancellationToken cancellationToken)
        => await caixas.GetAsync(caixaId, cancellationToken)
            ?? throw new EntityNotFoundException("CAIXA_NAO_ENCONTRADO", $"Caixa {caixaId} não encontrado.");
}
