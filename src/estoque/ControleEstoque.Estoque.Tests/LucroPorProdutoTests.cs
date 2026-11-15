using ControleEstoque.Estoque.Domain;
using ControleEstoque.Shared.Results;

namespace ControleEstoque.Estoque.Tests;

public sealed class LucroPorProdutoTests
{
    private static readonly Guid Pm1 = Guid.NewGuid();
    private static readonly Guid Pm2 = Guid.NewGuid();
    private static readonly Guid Pm3 = Guid.NewGuid();
    private static readonly Guid CascoTipo = Guid.NewGuid();

    private static DateOnly D(int dia) => new(2026, 11, dia);

    private static LinhaCarga Linha(Guid referencia, int qtd, decimal? custo) =>
        new(Guid.NewGuid(), referencia, qtd, custo);

    private static VendaProdutoMarcaDia Venda(Guid pm, string produto, int dia, int qtd, decimal receita) =>
        new(pm, Guid.NewGuid(), produto, Guid.NewGuid(), "Marca", D(dia), qtd, receita);

    private static CargaCusto CargaA() =>
        new(D(1), 10m, [Linha(Pm1, 8, 5m)], [Linha(CascoTipo, 2, 1m)]);

    private static CargaCusto CargaB() =>
        new(D(5), 12m, [Linha(Pm1, 4, 6.5m), Linha(Pm2, 2, 3m)], []);

    private static CargaCusto CargaCPendente() =>
        new(D(2), null, [Linha(Pm3, 1, 2m)], []);

    private static RelatorioLucro Calcular(IReadOnlyList<VendaProdutoMarcaDia> vendas, params CargaCusto[] cargas) =>
        LucroPorProduto.Calcular(D(1), D(30), vendas, cargas);

    [Fact]
    public void Calcular_ExemploDaSpec_BateComOsNumerosExatos()
    {
        var pm1 = Venda(Pm1, "A", 3, 3, 30m);
        var pm1Dia6 = Venda(Pm1, "A", 6, 2, 20m);
        var pm3 = Venda(Pm3, "B", 4, 1, 12m);

        var r = Calcular([pm1, pm1Dia6, pm3], CargaA(), CargaB(), CargaCPendente());

        var l1 = r.Linhas.Single(l => l.ProdutoMarcaId == Pm1);
        Assert.Equal((5, 50m, 26m, 5.67m, 18.33m, false),
            (l1.QuantidadeVendida, l1.Receita, l1.CustoProdutos, l1.Frete, l1.Lucro, l1.CustoPendente));
        var l3 = r.Linhas.Single(l => l.ProdutoMarcaId == Pm3);
        Assert.Equal((1, 12m, true), (l3.QuantidadeVendida, l3.Receita, l3.CustoPendente));
        Assert.Null(l3.CustoProdutos);
        Assert.Null(l3.Frete);
        Assert.Null(l3.Lucro);
        Assert.Equal(new TotaisLucro(6, 62m, 0m, 26m, 5.67m, 18.33m, 1), r.Totais);
    }

    [Fact]
    public void Calcular_VasilhamePago_SeparaDaReceitaELucroUsaSoOProduto()
    {
        // 2 un a 12 + vasilhame pago a 30: total_item 84 = 24 de produto + 60 de vasilhame.
        var venda = new VendaProdutoMarcaDia(Pm1, Guid.NewGuid(), "A", Guid.NewGuid(), "Marca", D(3), 2, 84m, 60m);

        var r = Calcular([venda], CargaA());

        var l = r.Linhas.Single();
        Assert.Equal((24m, 60m, 10m, 2m, 12m), (l.Receita, l.ReceitaVasilhame, l.CustoProdutos, l.Frete, l.Lucro));
        Assert.Equal(new TotaisLucro(2, 24m, 60m, 10m, 2m, 12m, 0), r.Totais);
    }

    [Fact]
    public void RatearVasilhame_ProporcionalAoBrutoDoItem()
    {
        // sem desconto: 2 × 30
        Assert.Equal(60m, LucroPorProduto.RatearVasilhame(84m, 2, 12m, true, 30m));
        // desconto de 10: 74 × 60 ÷ 84 = 52,857… → 52,86 (por item, AwayFromZero)
        Assert.Equal(52.86m, LucroPorProduto.RatearVasilhame(74m, 2, 12m, true, 30m));
        // não pagou o vasilhame
        Assert.Equal(0m, LucroPorProduto.RatearVasilhame(84m, 2, 12m, false, null));
        // bruto zero: sem divisão por zero
        Assert.Equal(0m, LucroPorProduto.RatearVasilhame(0m, 2, 0m, true, 0m));
    }

    [Fact]
    public void Calcular_MediaPonderadaMudaConformeADataDaVenda()
    {
        var antes = Calcular([Venda(Pm1, "A", 3, 1, 10m)], CargaA(), CargaB()).Linhas[0];
        var depois = Calcular([Venda(Pm1, "A", 6, 1, 10m)], CargaA(), CargaB()).Linhas[0];

        Assert.Equal((5m, 1m), (antes.CustoProdutos, antes.Frete));
        Assert.Equal((5.5m, 1.33m), (depois.CustoProdutos, depois.Frete));
    }

    [Fact]
    public void Calcular_CargaIncompletaEhIgnorada()
    {
        var incompleta = new CargaCusto(D(2), 5m, [Linha(Pm1, 10, null)], []);
        var cascoSemCusto = new CargaCusto(D(2), 5m, [Linha(Pm1, 10, 9m)], [Linha(CascoTipo, 1, null)]);

        var l = Calcular([Venda(Pm1, "A", 3, 1, 10m)], CargaA(), incompleta, cascoSemCusto).Linhas[0];

        Assert.Equal((5m, 1m), (l.CustoProdutos, l.Frete));
    }

    [Fact]
    public void Calcular_CascoContaNoRateioDoFrete()
    {
        // 8 itens + 2 cascos = 10 unidades; frete 10 => 1,00 por unidade (sem casco seria 1,25).
        var l = Calcular([Venda(Pm1, "A", 3, 4, 40m)], CargaA()).Linhas[0];

        Assert.Equal(4m, l.Frete);
        Assert.Equal(20m, l.CustoProdutos);
        Assert.Equal(16m, l.Lucro);
    }

    [Fact]
    public void Calcular_VendaAntesDaPrimeiraCargaCompleta_FicaPendente()
    {
        var r = Calcular([Venda(Pm1, "A", 1, 1, 10m), Venda(Pm1, "A", 3, 1, 10m)], new CargaCusto(
            D(2), 4m, [Linha(Pm1, 4, 2m)], []));

        var l = r.Linhas.Single();
        Assert.True(l.CustoPendente);
        Assert.Equal((2, 20m), (l.QuantidadeVendida, l.Receita));
        Assert.Null(l.Lucro);
    }

    [Fact]
    public void Calcular_ProdutoMarcaSemCarga_FicaPendenteEOsTotaisSomamSoOsCompletos()
    {
        var r = Calcular([Venda(Pm1, "A", 3, 1, 10m), Venda(Pm2, "B", 3, 2, 20m)], CargaA());

        Assert.Equal(new TotaisLucro(3, 30m, 0m, 5m, 1m, 4m, 1), r.Totais);
        Assert.True(r.Linhas.Single(l => l.ProdutoMarcaId == Pm2).CustoPendente);
    }

    [Fact]
    public void Calcular_ArredondaSoNoFimDaLinha()
    {
        // frete por unidade 1/3: 1 un + 1 un em dias diferentes soma 0,6667 => 0,67 (arredondar por dia daria 0,66).
        var carga = new CargaCusto(D(1), 1m, [Linha(Pm1, 3, 0m)], []);

        var l = Calcular([Venda(Pm1, "A", 2, 1, 5m), Venda(Pm1, "A", 3, 1, 5m)], carga).Linhas[0];

        Assert.Equal(0.67m, l.Frete);
        Assert.Equal(9.33m, l.Lucro);
    }

    [Fact]
    public void Calcular_OrdenaPorProdutoEDepoisMarca()
    {
        var r = Calcular(
        [
            Venda(Pm2, "Zebra", 3, 1, 1m),
            new VendaProdutoMarcaDia(Pm3, Guid.NewGuid(), "Agua", Guid.NewGuid(), "Z", D(3), 1, 1m),
            new VendaProdutoMarcaDia(Pm1, Guid.NewGuid(), "Agua", Guid.NewGuid(), "B", D(3), 1, 1m)
        ]);

        Assert.Equal([Pm1, Pm3, Pm2], r.Linhas.Select(l => l.ProdutoMarcaId));
    }

    // ---- Serviço -------------------------------------------------------------

    private sealed class FakeLucroRepository : IRelatorioLucroRepository
    {
        public Task<IReadOnlyList<VendaProdutoMarcaDia>> ListVendasAsync(
            DateOnly? inicio, DateOnly? fim, CancellationToken cancellationToken) =>
            Task.FromResult<IReadOnlyList<VendaProdutoMarcaDia>>([Venda(Pm1, "A", 3, 1, 10m)]);

        public Task<IReadOnlyList<CargaCusto>> ListCargasAsync(
            DateOnly? fim, IReadOnlyList<Guid> produtoMarcaIds, CancellationToken cancellationToken) =>
            Task.FromResult<IReadOnlyList<CargaCusto>>([CargaA()]);
    }

    private sealed class FakePermissoes : IPermissaoFuncionarioLookup
    {
        public Dictionary<Guid, IReadOnlyList<string>> Funcionarios { get; } = [];

        public Task<IReadOnlyList<string>?> PermissoesAsync(Guid funcionarioId, CancellationToken cancellationToken) =>
            Task.FromResult(Funcionarios.GetValueOrDefault(funcionarioId));
    }

    private readonly FakePermissoes permissoes = new();

    private Guid Funcionario(params string[] perms)
    {
        var id = Guid.NewGuid();
        permissoes.Funcionarios[id] = perms;
        return id;
    }

    private LucroService Servico() => new(new FakeLucroRepository(), permissoes);

    [Fact]
    public async Task ObterAsync_SemPermissaoCustos_LancaForbidden()
    {
        await Assert.ThrowsAsync<ForbiddenException>(
            () => Servico().ObterAsync(null, null, Funcionario("vendas.criar"), CancellationToken.None));
    }

    [Theory]
    [InlineData("estoque.custos")]
    [InlineData("*")]
    public async Task ObterAsync_ComPermissao_DevolveORelatorio(string permissao)
    {
        var r = await Servico().ObterAsync(D(1), D(30), Funcionario(permissao), CancellationToken.None);

        Assert.Equal(5m, r.Linhas.Single().CustoProdutos);
    }

    [Fact]
    public async Task ObterAsync_FuncionarioInexistente_LancaFuncionarioNaoEncontrado()
    {
        var ex = await Assert.ThrowsAsync<EntityNotFoundException>(
            () => Servico().ObterAsync(null, null, Guid.NewGuid(), CancellationToken.None));

        Assert.Equal("FUNCIONARIO_NAO_ENCONTRADO", ex.Code);
    }

    [Fact]
    public async Task ObterAsync_InicioDepoisDoFim_LancaPeriodoInvalido()
    {
        var ex = await Assert.ThrowsAsync<RequestValidationException>(
            () => Servico().ObterAsync(D(10), D(1), Funcionario("*"), CancellationToken.None));

        Assert.Equal("PERIODO_INVALIDO", ex.Code);
    }
}
