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
        Guid caixaId, IReadOnlyList<Guid> funcionariosPresentes, CancellationToken cancellationToken)
    {
        // Falta = funcionário simplesmente não listado; diária usa o valor do cadastro.
        if (funcionariosPresentes.Distinct().Count() != funcionariosPresentes.Count)
        {
            throw new RequestValidationException(
                "FUNCIONARIO_DUPLICADO", "Funcionário repetido na lista de presentes.");
        }

        // Estado, diárias, entradas e despesas são lidos pelo repositório, na transação do fechamento.
        return await caixas.FecharAsync(caixaId, funcionariosPresentes, cancellationToken);
    }

    private async Task<Caixa> ObterCaixaAsync(Guid caixaId, CancellationToken cancellationToken)
        => await caixas.GetAsync(caixaId, cancellationToken)
            ?? throw new EntityNotFoundException("CAIXA_NAO_ENCONTRADO", $"Caixa {caixaId} não encontrado.");
}
