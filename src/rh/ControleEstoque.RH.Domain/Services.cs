using ControleEstoque.Shared.Results;

namespace ControleEstoque.RH.Domain;

public interface ICargoService
{
    Task<Cargo> CriarAsync(string nome, IReadOnlyList<string> permissoes, CancellationToken cancellationToken);
    Task<Cargo> AtualizarAsync(
        Guid id, string nome, IReadOnlyList<string> permissoes, CancellationToken cancellationToken);
    Task<IReadOnlyList<Cargo>> ListarAsync(CancellationToken cancellationToken);
}

public sealed class CargoService : ICargoService
{
    private readonly ICargoRepository cargos;

    public CargoService(ICargoRepository cargos) => this.cargos = cargos;

    public async Task<Cargo> CriarAsync(
        string nome, IReadOnlyList<string> permissoes, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(nome))
        {
            throw new RequestValidationException("NOME_OBRIGATORIO", "Nome do cargo é obrigatório.");
        }

        var cargo = new Cargo(Guid.NewGuid(), nome.Trim(), false, permissoes);
        await cargos.CreateAsync(cargo, cancellationToken);
        return cargo;
    }

    public async Task<Cargo> AtualizarAsync(
        Guid id, string nome, IReadOnlyList<string> permissoes, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(nome))
        {
            throw new RequestValidationException("NOME_OBRIGATORIO", "Nome do cargo é obrigatório.");
        }

        var existente = await cargos.GetAsync(id, cancellationToken)
            ?? throw new EntityNotFoundException("CARGO_NAO_ENCONTRADO", $"Cargo {id} não encontrado.");

        // ADM é cargo nativo do sistema: não editável nem removível.
        if (existente.Nativo)
        {
            throw new BusinessRuleException("CARGO_NATIVO", "Cargo nativo do sistema não pode ser alterado.");
        }

        var atualizado = existente with { Nome = nome.Trim(), Permissoes = permissoes };
        await cargos.UpdateAsync(atualizado, cancellationToken);
        return atualizado;
    }

    public Task<IReadOnlyList<Cargo>> ListarAsync(CancellationToken cancellationToken)
        => cargos.ListAsync(cancellationToken);
}

public interface IFuncionarioService
{
    Task<Funcionario> CriarAsync(Funcionario funcionario, CancellationToken cancellationToken);
    Task<Funcionario> AtualizarAsync(Funcionario funcionario, CancellationToken cancellationToken);
    Task<Funcionario> ObterAsync(Guid id, CancellationToken cancellationToken);
    Task<IReadOnlyList<Funcionario>> ListarAsync(CancellationToken cancellationToken);
}

public sealed class FuncionarioService : IFuncionarioService
{
    private readonly IFuncionarioRepository funcionarios;
    private readonly ICargoRepository cargos;

    public FuncionarioService(IFuncionarioRepository funcionarios, ICargoRepository cargos)
    {
        this.funcionarios = funcionarios;
        this.cargos = cargos;
    }

    public async Task<Funcionario> CriarAsync(Funcionario funcionario, CancellationToken cancellationToken)
    {
        await ValidarAsync(funcionario, cancellationToken);
        var novo = funcionario with { Id = funcionario.Id == Guid.Empty ? Guid.NewGuid() : funcionario.Id };
        await funcionarios.CreateAsync(novo, cancellationToken);
        return novo;
    }

    public async Task<Funcionario> AtualizarAsync(Funcionario funcionario, CancellationToken cancellationToken)
    {
        await ValidarAsync(funcionario, cancellationToken);
        if (!await funcionarios.UpdateAsync(funcionario, cancellationToken))
        {
            throw new EntityNotFoundException(
                "FUNCIONARIO_NAO_ENCONTRADO", $"Funcionário {funcionario.Id} não encontrado.");
        }

        return funcionario;
    }

    public async Task<Funcionario> ObterAsync(Guid id, CancellationToken cancellationToken)
        => await funcionarios.GetAsync(id, cancellationToken)
            ?? throw new EntityNotFoundException(
                "FUNCIONARIO_NAO_ENCONTRADO", $"Funcionário {id} não encontrado.");

    public Task<IReadOnlyList<Funcionario>> ListarAsync(CancellationToken cancellationToken)
        => funcionarios.ListAsync(cancellationToken);

    private async Task ValidarAsync(Funcionario funcionario, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(funcionario.Nome))
        {
            throw new RequestValidationException("NOME_OBRIGATORIO", "Nome do funcionário é obrigatório.");
        }

        if (funcionario.ValorDiaria < 0)
        {
            throw new RequestValidationException("DIARIA_INVALIDA", "Valor da diária não pode ser negativo.");
        }

        if (!await cargos.ExistsAsync(funcionario.CargoId, cancellationToken))
        {
            throw new BusinessRuleException(
                "CARGO_INEXISTENTE", $"Cargo {funcionario.CargoId} não cadastrado.");
        }
    }
}

public interface IContaFuncionarioService
{
    Task<ExtratoFuncionario> ObterExtratoAsync(Guid funcionarioId, CancellationToken cancellationToken);
    Task<decimal> RegistrarValeAsync(
        Guid funcionarioId, decimal valor, string? observacao, CancellationToken cancellationToken);
    Task<decimal> RegistrarPagamentoAsync(
        Guid funcionarioId, decimal valor, string? observacao, CancellationToken cancellationToken);
}

public sealed class ContaFuncionarioService : IContaFuncionarioService
{
    private readonly IContaFuncionarioRepository conta;
    private readonly IFuncionarioRepository funcionarios;

    public ContaFuncionarioService(IContaFuncionarioRepository conta, IFuncionarioRepository funcionarios)
    {
        this.conta = conta;
        this.funcionarios = funcionarios;
    }

    public async Task<ExtratoFuncionario> ObterExtratoAsync(
        Guid funcionarioId, CancellationToken cancellationToken)
    {
        await GarantirFuncionarioAsync(funcionarioId, cancellationToken);
        var saldo = await conta.GetSaldoAsync(funcionarioId, cancellationToken);
        var lancamentos = await conta.GetLancamentosAsync(funcionarioId, cancellationToken);
        return new ExtratoFuncionario(funcionarioId, saldo, lancamentos);
    }

    public async Task<decimal> RegistrarValeAsync(
        Guid funcionarioId, decimal valor, string? observacao, CancellationToken cancellationToken)
    {
        ValidarValor(valor);
        await GarantirFuncionarioAsync(funcionarioId, cancellationToken);
        await conta.AddLancamentoAsync(
            funcionarioId, TipoLancamentoFuncionario.VALE, valor, observacao, cancellationToken);
        return await conta.GetSaldoAsync(funcionarioId, cancellationToken);
    }

    public async Task<decimal> RegistrarPagamentoAsync(
        Guid funcionarioId, decimal valor, string? observacao, CancellationToken cancellationToken)
    {
        ValidarValor(valor);
        await GarantirFuncionarioAsync(funcionarioId, cancellationToken);

        var saldo = await conta.GetSaldoAsync(funcionarioId, cancellationToken);
        if (valor > saldo)
        {
            throw new BusinessRuleException(
                "PAGAMENTO_EXCEDE_SALDO",
                $"Pagamento de {valor:F2} excede o saldo a pagar de {saldo:F2}.");
        }

        await conta.AddLancamentoAsync(
            funcionarioId, TipoLancamentoFuncionario.PAGAMENTO, valor, observacao, cancellationToken);
        return saldo - valor;
    }

    private static void ValidarValor(decimal valor)
    {
        if (valor <= 0)
        {
            throw new RequestValidationException("VALOR_INVALIDO", "Valor deve ser positivo.");
        }
    }

    private async Task GarantirFuncionarioAsync(Guid funcionarioId, CancellationToken cancellationToken)
    {
        if (!await funcionarios.ExistsAsync(funcionarioId, cancellationToken))
        {
            throw new EntityNotFoundException(
                "FUNCIONARIO_NAO_ENCONTRADO", $"Funcionário {funcionarioId} não encontrado.");
        }
    }
}
