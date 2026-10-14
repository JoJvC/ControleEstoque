using ControleEstoque.RH.Domain;
using ControleEstoque.Shared.Results;

namespace ControleEstoque.RH.Tests;

public sealed class CargoServiceTests
{
    private readonly FakeCargoRepository cargos = new();
    private readonly CargoService sut;

    public CargoServiceTests() => sut = new CargoService(cargos);

    [Fact]
    public async Task AtualizarAsync_QuandoCargoNativo_LancaCargoNativo()
    {
        var adm = cargos.Add("ADM", nativo: true);

        var e = await Assert.ThrowsAsync<BusinessRuleException>(
            () => sut.AtualizarAsync(adm.Id, "Novo Nome", [], CancellationToken.None));

        Assert.Equal("CARGO_NATIVO", e.Code);
    }

    [Fact]
    public async Task AtualizarAsync_QuandoCargoCustomizado_Atualiza()
    {
        var cargo = cargos.Add("Vendedor", nativo: false);

        var atualizado = await sut.AtualizarAsync(
            cargo.Id, "Vendedor Sênior", ["vendas.registrar", "vendas.editar"], CancellationToken.None);

        Assert.Equal("Vendedor Sênior", atualizado.Nome);
        Assert.Equal(2, atualizado.Permissoes.Count);
    }

    [Fact]
    public async Task CriarAsync_SempreCriaComoNaoNativo()
    {
        var cargo = await sut.CriarAsync("Entregador", ["vendas.registrar"], CancellationToken.None);

        Assert.False(cargo.Nativo);
    }
}

public sealed class ContaFuncionarioServiceTests
{
    private readonly FakeFuncionarioRepository funcionarios = new();
    private readonly FakeContaFuncionarioRepository conta = new();
    private readonly ContaFuncionarioService sut;

    public ContaFuncionarioServiceTests() => sut = new ContaFuncionarioService(conta, funcionarios);

    [Fact]
    public async Task RegistrarPagamentoAsync_QuandoExcedeSaldo_LancaPagamentoExcedeSaldo()
    {
        var funcionario = funcionarios.Add("João");
        conta.Lancar(funcionario.Id, TipoLancamentoFuncionario.DIARIA, 80m);

        var e = await Assert.ThrowsAsync<BusinessRuleException>(
            () => sut.RegistrarPagamentoAsync(funcionario.Id, 100m, null, CancellationToken.None));

        Assert.Equal("PAGAMENTO_EXCEDE_SALDO", e.Code);
    }

    [Fact]
    public async Task SaldoEhDiariasMenosValesMenosPagamentos()
    {
        // Ciclo da semana: 5 diárias de 80, um vale de 50, pagamento do restante.
        var funcionario = funcionarios.Add("Maria");
        for (var i = 0; i < 5; i++)
        {
            conta.Lancar(funcionario.Id, TipoLancamentoFuncionario.DIARIA, 80m);
        }

        var saldoAposVale = await sut.RegistrarValeAsync(funcionario.Id, 50m, null, CancellationToken.None);
        Assert.Equal(350m, saldoAposVale);

        var saldoFinal = await sut.RegistrarPagamentoAsync(
            funcionario.Id, 350m, "pagamento semanal", CancellationToken.None);
        Assert.Equal(0m, saldoFinal);
    }

    [Fact]
    public async Task RegistrarValeAsync_QuandoFuncionarioNaoExiste_LancaNotFound()
    {
        await Assert.ThrowsAsync<EntityNotFoundException>(
            () => sut.RegistrarValeAsync(Guid.NewGuid(), 10m, null, CancellationToken.None));
    }

    [Fact]
    public async Task RegistrarValeAsync_QuandoValorInvalido_LancaValidacao()
    {
        await Assert.ThrowsAsync<RequestValidationException>(
            () => sut.RegistrarValeAsync(Guid.NewGuid(), 0m, null, CancellationToken.None));
    }
}

internal sealed class FakeCargoRepository : ICargoRepository
{
    private readonly Dictionary<Guid, Cargo> cargos = new();

    public Cargo Add(string nome, bool nativo)
    {
        var cargo = new Cargo(Guid.NewGuid(), nome, nativo, []);
        cargos[cargo.Id] = cargo;
        return cargo;
    }

    public Task CreateAsync(Cargo cargo, CancellationToken cancellationToken)
    {
        cargos[cargo.Id] = cargo;
        return Task.CompletedTask;
    }

    public Task<Cargo?> GetAsync(Guid id, CancellationToken cancellationToken) =>
        Task.FromResult(cargos.GetValueOrDefault(id));

    public Task<IReadOnlyList<Cargo>> ListAsync(CancellationToken cancellationToken) =>
        Task.FromResult<IReadOnlyList<Cargo>>(cargos.Values.ToList());

    public Task UpdateAsync(Cargo cargo, CancellationToken cancellationToken)
    {
        cargos[cargo.Id] = cargo;
        return Task.CompletedTask;
    }

    public Task<bool> ExistsAsync(Guid id, CancellationToken cancellationToken) =>
        Task.FromResult(cargos.ContainsKey(id));
}

internal sealed class FakeFuncionarioRepository : IFuncionarioRepository
{
    private readonly Dictionary<Guid, Funcionario> funcionarios = new();

    public Funcionario Add(string nome)
    {
        var funcionario = new Funcionario(Guid.NewGuid(), nome, null, Guid.NewGuid(), null, 80m, true);
        funcionarios[funcionario.Id] = funcionario;
        return funcionario;
    }

    public Task CreateAsync(Funcionario funcionario, CancellationToken cancellationToken)
    {
        funcionarios[funcionario.Id] = funcionario;
        return Task.CompletedTask;
    }

    public Task<bool> UpdateAsync(Funcionario funcionario, CancellationToken cancellationToken)
    {
        if (!funcionarios.ContainsKey(funcionario.Id))
        {
            return Task.FromResult(false);
        }

        funcionarios[funcionario.Id] = funcionario;
        return Task.FromResult(true);
    }

    public Task<Funcionario?> GetAsync(Guid id, CancellationToken cancellationToken) =>
        Task.FromResult(funcionarios.GetValueOrDefault(id));

    public Task<bool> ExistsAsync(Guid id, CancellationToken cancellationToken) =>
        Task.FromResult(funcionarios.ContainsKey(id));

    public Task<IReadOnlyList<Funcionario>> ListAsync(CancellationToken cancellationToken) =>
        Task.FromResult<IReadOnlyList<Funcionario>>(funcionarios.Values.ToList());
}

internal sealed class FakeContaFuncionarioRepository : IContaFuncionarioRepository
{
    private readonly List<(Guid FuncionarioId, TipoLancamentoFuncionario Tipo, decimal Valor)> lancamentos = [];

    public void Lancar(Guid funcionarioId, TipoLancamentoFuncionario tipo, decimal valor) =>
        lancamentos.Add((funcionarioId, tipo, valor));

    public Task<decimal> GetSaldoAsync(Guid funcionarioId, CancellationToken cancellationToken) =>
        Task.FromResult(lancamentos
            .Where(l => l.FuncionarioId == funcionarioId)
            .Sum(l => l.Tipo == TipoLancamentoFuncionario.DIARIA ? l.Valor : -l.Valor));

    public Task AddLancamentoAsync(
        Guid funcionarioId, TipoLancamentoFuncionario tipo, decimal valor, string? observacao,
        CancellationToken cancellationToken)
    {
        Lancar(funcionarioId, tipo, valor);
        return Task.CompletedTask;
    }

    public Task<IReadOnlyList<LancamentoFuncionario>> GetLancamentosAsync(
        Guid funcionarioId, CancellationToken cancellationToken) =>
        Task.FromResult<IReadOnlyList<LancamentoFuncionario>>([]);

    public Task<IReadOnlyList<SaldoFuncionario>> ListSaldosAsync(CancellationToken cancellationToken) =>
        Task.FromResult<IReadOnlyList<SaldoFuncionario>>([]);
}
