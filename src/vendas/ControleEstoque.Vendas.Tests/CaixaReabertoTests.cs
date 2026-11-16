using ControleEstoque.Shared.Results;
using ControleEstoque.Vendas.Domain;

namespace ControleEstoque.Vendas.Tests;

public sealed class CaixaReabertoTests
{
    private static readonly TimeSpan Sp = TimeSpan.FromHours(-3);
    private static readonly DateOnly Dia10 = new(2026, 11, 10);

    private readonly FakeVendaLookup lookup = new();
    private readonly FakePermissaoLookup permissoes = new();
    private readonly FakeCupomFiscalRepository cupons = new();
    private readonly FakeVendaRepository vendas;
    private readonly ProdutoVenda agua;
    private readonly Guid clienteId = Guid.NewGuid();
    private readonly Guid funcionarioId = Guid.NewGuid();

    public CaixaReabertoTests()
    {
        vendas = new FakeVendaRepository(lookup.SaldosEstoque);
        lookup.Clientes.Add(clienteId);
        lookup.Funcionarios.Add(funcionarioId);
        agua = lookup.AddProduto(TipoProduto.DESCARTAVEL, "Carvão 5kg", 100);
    }

    private static DateTimeOffset Em(int dia, int h, int m = 0) => new(2026, 11, dia, h, m, 0, Sp);

    private VendaService ServicoEm(DateTimeOffset agora) =>
        new(vendas, lookup, cupons, permissoes, new RelogioFixo(agora));

    private NovaVenda NovaVendaNoCaixa(Guid? caixaId, bool aPrazo = false) => new(
        clienteId, funcionarioId, null,
        [new ItemVenda(agua.ProdutoId, agua.MarcaId, 2, 10m, null)],
        [], aPrazo ? [] : [new PagamentoVenda(FormaPagamento.DINHEIRO, 20m)], [], [], null, caixaId);

    private Guid FuncionarioComPermissao(params string[] chaves)
    {
        var id = Guid.NewGuid();
        permissoes.PermissoesPorFuncionario[id] = chaves;
        return id;
    }

    // ---- InstanteDoLancamento -------------------------------------------------------------

    [Fact]
    public void InstanteDoLancamento_CaixaDeHoje_DevolveNulo()
    {
        Assert.Null(RelogioLancamento.InstanteDoLancamento(new DateOnly(2026, 11, 12), Em(12, 10)));
    }

    [Fact]
    public void InstanteDoLancamento_CaixaAnterior_DevolveMeioDiaDoCaixaEmSaoPaulo()
    {
        var instante = RelogioLancamento.InstanteDoLancamento(Dia10, Em(12, 10));

        Assert.Equal(Em(10, 12), instante);
        Assert.Equal(new DateTime(2026, 11, 10, 15, 0, 0), instante!.Value.UtcDateTime);
    }

    [Fact]
    public void InstanteDoLancamento_As2330EmSpComUtcJaNoDiaSeguinte_AindaEHoje()
    {
        var agora = Em(11, 23, 30);
        Assert.Equal(new DateOnly(2026, 11, 12), DateOnly.FromDateTime(agora.UtcDateTime)); // UTC já é 12/11

        Assert.Null(RelogioLancamento.InstanteDoLancamento(new DateOnly(2026, 11, 11), agora));
    }

    [Fact]
    public void InstanteDoLancamento_AMeiaNoiteEmSp_OCaixaDeOntemJaNaoEHoje()
    {
        var instante = RelogioLancamento.InstanteDoLancamento(new DateOnly(2026, 11, 11), Em(12, 0));

        Assert.Equal(Em(11, 12), instante);
    }

    // ---- Lançar venda no caixa escolhido ---------------------------------------------------------

    [Fact]
    public async Task CriarAsync_ComCaixaIdDoReaberto_ComRelogioEmOutroDia_RepassaInstanteComADataDoCaixa()
    {
        var caixa = lookup.AddCaixa(Dia10);

        await ServicoEm(Em(12, 10)).CriarAsync(NovaVendaNoCaixa(caixa.Id), default);

        var g = vendas.UltimaGravacao!;
        Assert.Equal(caixa.Id, g.CaixaId);
        Assert.Equal(Em(10, 12), g.Instante);
    }

    [Fact]
    public async Task CriarAsync_ComCaixaIdDoCaixaDeHoje_NaoRepassaInstante()
    {
        var hoje = lookup.AddCaixa(new DateOnly(2026, 11, 12));

        await ServicoEm(Em(12, 10)).CriarAsync(NovaVendaNoCaixa(hoje.Id), default);

        Assert.Null(vendas.UltimaGravacao!.Instante);
    }

    [Fact]
    public async Task CriarAsync_SemCaixaId_ComportamentoAtual()
    {
        await ServicoEm(Em(12, 10)).CriarAsync(NovaVendaNoCaixa(null), default);

        Assert.Null(vendas.UltimaGravacao!.Instante);
        Assert.Null(vendas.UltimaGravacao.CaixaId);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task CriarAsync_ComCaixaIdDeCaixaFechado_LancaCaixaFechado_MesmoSoFiado(bool soFiado)
    {
        var fechado = lookup.AddCaixa(Dia10, aberto: false);

        var e = await Assert.ThrowsAsync<ConflictException>(
            () => ServicoEm(Em(12, 10)).CriarAsync(NovaVendaNoCaixa(fechado.Id, soFiado), default));

        Assert.Equal("CAIXA_FECHADO", e.Code);
        Assert.Null(vendas.UltimaGravacao);
    }

    [Fact]
    public async Task CriarAsync_ComCaixaIdInexistente_LancaCaixaNaoEncontrado()
    {
        var e = await Assert.ThrowsAsync<EntityNotFoundException>(
            () => ServicoEm(Em(12, 10)).CriarAsync(NovaVendaNoCaixa(Guid.NewGuid()), default));

        Assert.Equal("CAIXA_NAO_ENCONTRADO", e.Code);
    }

    // ---- Alterar -------------------------------------------------------------------------

    [Fact]
    public async Task EditarAsync_VendaDoDiaReaberto_ReinsereEfeitosComOInstanteOriginalDaVenda()
    {
        var caixa = lookup.AddCaixa(Dia10);
        var servico = ServicoEm(Em(12, 10));
        var criada = await servico.CriarAsync(NovaVendaNoCaixa(caixa.Id), default);

        await servico.EditarAsync(criada.Id, NovaVendaNoCaixa(null), default);

        Assert.Equal(Em(10, 12), vendas.UltimaEdicao!.Instante);
    }

    // ---- Cancelar -------------------------------------------------------------------------

    [Fact]
    public async Task CancelarAsync_VendaDoDiaReaberto_RegistraQuemQuandoERemoveAVenda()
    {
        var caixa = lookup.AddCaixa(Dia10);
        var criada = await ServicoEm(Em(12, 9)).CriarAsync(NovaVendaNoCaixa(caixa.Id), default);
        var gerente = FuncionarioComPermissao(PermissoesVendas.Cancelar);

        await ServicoEm(Em(12, 10)).CancelarAsync(criada.Id, gerente, default);

        Assert.Equal((criada.Id, gerente, Em(12, 10)), Assert.Single(vendas.Cancelamentos));
        Assert.DoesNotContain(criada.Id, vendas.VendasExistentes);
    }

    [Fact]
    public async Task CancelarAsync_ComAsterisco_Cancela()
    {
        var criada = await ServicoEm(Em(12, 9)).CriarAsync(NovaVendaNoCaixa(null), default);

        await ServicoEm(Em(12, 10)).CancelarAsync(criada.Id, FuncionarioComPermissao("*"), default);

        Assert.Single(vendas.Cancelamentos);
    }

    [Fact]
    public async Task CancelarAsync_SemAPermissao_LancaPermissaoNegadaENaoCancela()
    {
        var criada = await ServicoEm(Em(12, 9)).CriarAsync(NovaVendaNoCaixa(null), default);

        var e = await Assert.ThrowsAsync<ForbiddenException>(
            () => ServicoEm(Em(12, 10)).CancelarAsync(criada.Id, FuncionarioComPermissao("vendas.registrar"), default));

        Assert.Equal("PERMISSAO_NEGADA", e.Code);
        Assert.Empty(vendas.Cancelamentos);
    }

    [Fact]
    public async Task CancelarAsync_FuncionarioVazio_LancaIdInvalido()
    {
        var e = await Assert.ThrowsAsync<RequestValidationException>(
            () => ServicoEm(Em(12, 10)).CancelarAsync(Guid.NewGuid(), Guid.Empty, default));

        Assert.Equal("ID_INVALIDO", e.Code);
    }

    [Fact]
    public async Task CancelarAsync_VendaInexistente_LancaVendaNaoEncontrada()
    {
        var e = await Assert.ThrowsAsync<EntityNotFoundException>(
            () => ServicoEm(Em(12, 10)).CancelarAsync(Guid.NewGuid(), FuncionarioComPermissao("*"), default));

        Assert.Equal("VENDA_NAO_ENCONTRADA", e.Code);
    }

    [Fact]
    public async Task CancelarAsync_VendaJaCancelada_LancaVendaNaoEncontrada()
    {
        var criada = await ServicoEm(Em(12, 9)).CriarAsync(NovaVendaNoCaixa(null), default);
        var dono = FuncionarioComPermissao("*");
        await ServicoEm(Em(12, 10)).CancelarAsync(criada.Id, dono, default);

        var e = await Assert.ThrowsAsync<EntityNotFoundException>(
            () => ServicoEm(Em(12, 11)).CancelarAsync(criada.Id, dono, default));

        Assert.Equal("VENDA_NAO_ENCONTRADA", e.Code);
    }

    [Fact]
    public async Task CancelarAsync_ComOCaixaDoDiaDaVendaFechado_LancaCaixaFechado()
    {
        var caixa = lookup.AddCaixa(Dia10);
        var criada = await ServicoEm(Em(12, 9)).CriarAsync(NovaVendaNoCaixa(caixa.Id), default);
        vendas.DiasDeCaixaFechado.Add(Dia10);

        var e = await Assert.ThrowsAsync<ConflictException>(
            () => ServicoEm(Em(12, 10)).CancelarAsync(criada.Id, FuncionarioComPermissao("*"), default));

        Assert.Equal("CAIXA_FECHADO", e.Code);
        Assert.Empty(vendas.Cancelamentos);
    }
}
