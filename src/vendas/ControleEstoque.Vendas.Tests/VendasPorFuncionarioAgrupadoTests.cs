using ControleEstoque.Vendas.Domain;

namespace ControleEstoque.Vendas.Tests;

public sealed class VendasPorFuncionarioAgrupadoTests
{
    private static readonly FuncionarioRelatorio Ana = new(Guid.NewGuid(), "Ana");
    private static readonly FuncionarioRelatorio Bruno = new(Guid.NewGuid(), "Bruno");
    private static readonly FuncionarioRelatorio Caio = new(Guid.NewGuid(), "Caio");
    private static readonly FuncionarioRelatorio Dora = new(Guid.NewGuid(), "Dora");

    private static readonly Guid Agua = Guid.NewGuid();
    private static readonly Guid Gas = Guid.NewGuid();
    private static readonly Guid Indaia = Guid.NewGuid();
    private static readonly Guid Naya = Guid.NewGuid();
    private static readonly Guid Generica = Guid.NewGuid();
    private static readonly Guid Casco20 = Guid.NewGuid();
    private static readonly Guid Casco10 = Guid.NewGuid();

    private static ItemVendaRelatorio Item(Guid produto, string nome, Guid marca, string marcaNome, int qtd, decimal total) =>
        new(produto, nome, marca, marcaNome, qtd, total);

    private static VendaParaRelatorio Balcao(
        FuncionarioRelatorio por, decimal liquido, ItemVendaRelatorio[] itens,
        VasilhameVendaRelatorio[]? vasilhames = null, decimal sucata = 0) =>
        new(Guid.NewGuid(), por, false, [], liquido, sucata, itens, vasilhames ?? []);

    private static VendaParaRelatorio Entrega(
        FuncionarioRelatorio concluiu, FuncionarioRelatorio[] pedido, decimal liquido, ItemVendaRelatorio[] itens,
        VasilhameVendaRelatorio[]? vasilhames = null) =>
        new(Guid.NewGuid(), concluiu, true, pedido, liquido, 0m, itens, vasilhames ?? []);

    private static RelatorioVendasPorFuncionario Montar(params VendaParaRelatorio[] vendas) =>
        VendasPorFuncionarioAgrupado.Montar(null, null, vendas);

    [Fact]
    public void BalcaoCreditaOFuncionarioDaVendaComUnidadesEValor()
    {
        var v1 = Balcao(Ana, 55m, [Item(Agua, "Água 20L", Indaia, "Indaiá", 2, 30m)],
            [new VasilhameVendaRelatorio(Casco20, "20L", 1, 25m)]);

        var r = Montar(v1);

        var ana = Assert.Single(r.Funcionarios);
        Assert.Equal((1L, 0L, 55m), (ana.QuantidadeVendas, ana.QuantidadeEntregas, ana.TotalLiquido));
        Assert.Equal(
            [("PRODUTO", 2, 30m), ("VASILHAME", 1, 25m)],
            ana.Itens.Select(i => (i.Tipo, i.Quantidade, i.Total)));
        Assert.Equal("Indaiá", ana.Itens[0].MarcaNome);
        Assert.Equal("20L", ana.Itens[1].TipoCascoNome);
    }

    [Fact]
    public void PedidoCreditaEntregaInteiraACadaFuncionarioENaoAQuemConcluiuFora()
    {
        var v2 = Entrega(Dora, [Bruno, Caio], 330m, [Item(Gas, "Gás P13", Generica, "Genérica", 3, 330m)]);

        var r = Montar(v2);

        Assert.Equal(["Bruno", "Caio"], r.Funcionarios.Select(f => f.Nome));
        Assert.All(r.Funcionarios, f =>
        {
            Assert.Equal((0L, 1L, 330m), (f.QuantidadeVendas, f.QuantidadeEntregas, f.TotalLiquido));
            Assert.Equal((3, 330m), (f.Itens[0].Quantidade, f.Itens[0].Total));
        });
        Assert.DoesNotContain(r.Funcionarios, f => f.FuncionarioId == Dora.Id);
    }

    [Fact]
    public void QuemConcluiuRecebeSoSeEstiverNoPedido()
    {
        var r = Montar(Entrega(Dora, [Dora, Bruno], 100m, []));

        Assert.Equal(["Bruno", "Dora"], r.Funcionarios.Select(f => f.Nome).Order());
    }

    [Fact]
    public void TotaisContamCadaVendaUmaVezSo()
    {
        var v1 = Balcao(Ana, 55m, []);
        var v2 = Entrega(Dora, [Bruno, Caio], 330m, []);

        var r = Montar(v1, v2);

        Assert.Equal(new TotaisVendasPorFuncionario(1, 1, 385m), r.Totais);
        Assert.Equal(3, r.Funcionarios.Count);
    }

    [Fact]
    public void MesmoProdutoEmMarcasDiferentesGeraLinhasSeparadasEMesmaMarcaSoma()
    {
        var v1 = Balcao(Ana, 40m, [Item(Agua, "Água 20L", Indaia, "Indaiá", 1, 15m), Item(Agua, "Água 20L", Naya, "Naya", 1, 25m)]);
        var v2 = Balcao(Ana, 30m, [Item(Agua, "Água 20L", Indaia, "Indaiá", 2, 30m)]);

        var ana = Assert.Single(Montar(v1, v2).Funcionarios);

        Assert.Equal(
            [("Indaiá", 3, 45m), ("Naya", 1, 25m)],
            ana.Itens.Select(i => (i.MarcaNome!, i.Quantidade, i.Total)));
    }

    [Fact]
    public void VasilhameGeraUmaLinhaPorTipoDeCascoSomadoEntreVendas()
    {
        var v1 = Balcao(Ana, 50m, [], [new VasilhameVendaRelatorio(Casco20, "20L", 1, 25m)]);
        var v2 = Balcao(Ana, 75m, [], [new VasilhameVendaRelatorio(Casco20, "20L", 1, 25m), new VasilhameVendaRelatorio(Casco10, "10L", 2, 50m)]);

        var ana = Assert.Single(Montar(v1, v2).Funcionarios);

        Assert.Equal(
            [("10L", 2, 50m), ("20L", 2, 50m)],
            ana.Itens.Select(i => (i.TipoCascoNome!, i.Quantidade, i.Total)));
        Assert.All(ana.Itens, i => Assert.Equal("VASILHAME", i.Tipo));
    }

    [Fact]
    public void PedidoSemFuncionariosCaiParaQuemConcluiuComoEntrega()
    {
        var r = Montar(Entrega(Dora, [], 80m, []));

        var dora = Assert.Single(r.Funcionarios);
        Assert.Equal((0L, 1L, 80m), (dora.QuantidadeVendas, dora.QuantidadeEntregas, dora.TotalLiquido));
        Assert.Equal(new TotaisVendasPorFuncionario(0, 1, 80m), r.Totais);
    }

    [Fact]
    public void DescontoDeSucataReduzOValorDoFuncionarioSemMexerNasLinhas()
    {
        // linhas somam 55, a sucata abate 5: total líquido 50
        var v = Balcao(Ana, 50m, [Item(Agua, "Água 20L", Indaia, "Indaiá", 2, 30m)],
            [new VasilhameVendaRelatorio(Casco20, "20L", 1, 25m)], sucata: 5m);

        var ana = Assert.Single(Montar(v).Funcionarios);

        Assert.Equal(50m, ana.TotalLiquido);
        Assert.Equal(5m, ana.DescontoSucata);
        Assert.Equal(55m, ana.Itens.Sum(i => i.Total));
    }

    [Fact]
    public void OrdenaPorTotalDecrescenteENomeEProdutosAntesDeVasilhames()
    {
        var r = Montar(
            Balcao(Caio, 10m, []), Balcao(Bruno, 10m, []), Balcao(Ana, 5m, []),
            Balcao(Dora, 99m, [Item(Gas, "Gás P13", Generica, "Genérica", 1, 10m), Item(Agua, "Água 20L", Indaia, "Indaiá", 1, 5m)],
                [new VasilhameVendaRelatorio(Casco20, "20L", 1, 1m)]));

        Assert.Equal(["Dora", "Bruno", "Caio", "Ana"], r.Funcionarios.Select(f => f.Nome));
        Assert.Equal(["Água 20L", "Gás P13", null], r.Funcionarios[0].Itens.Select(i => i.ProdutoNome));
    }

    [Fact]
    public void LinhasDoMesmoProdutoOrdenamPeloRotuloExibidoSemMarcaDepoisDeIndaia()
    {
        var v = Balcao(Ana, 20m, [
            Item(Gas, "Gás P13", Indaia, "Indaiá", 1, 10m), Item(Gas, "Gás P13", Generica, "Genérica", 1, 10m)]);

        var ana = Assert.Single(Montar(v).Funcionarios);

        Assert.Equal(["Indaiá", "Genérica"], ana.Itens.Select(i => i.MarcaNome));
    }

    [Fact]
    public void PeriodoSemVendasDevolveTotaisZeroEListaVazia()
    {
        var r = Montar();

        Assert.Equal(new TotaisVendasPorFuncionario(0, 0, 0m), r.Totais);
        Assert.Empty(r.Funcionarios);
    }
}
