using ControleEstoque.Estoque.Domain;
using ControleEstoque.Shared.Results;

namespace ControleEstoque.Estoque.Tests;

public sealed class AbastecimentoServiceTests
{
    private readonly FakeProdutoRepository produtos = new();
    private readonly FakeTipoCascoRepository tiposCasco = new();
    private readonly FakeAbastecimentoRepository abastecimentos = new();
    private readonly FakePermissaoLookup permissoes = new();
    private readonly AbastecimentoService sut;
    private readonly ProdutoMarca marca = new(Guid.NewGuid(), Guid.NewGuid(), "Marca A", 10m, 0, 0, null, null);
    private readonly Produto produto;
    private readonly TipoCasco casco;
    private readonly Guid dono;

    public AbastecimentoServiceTests()
    {
        sut = new AbastecimentoService(abastecimentos, produtos, tiposCasco, permissoes);
        produto = new Produto(Guid.NewGuid(), TipoProduto.DESCARTAVEL, "Copo 200ml", null, "200ml", null, [marca]);
        produtos.Add(produto);
        casco = tiposCasco.Add("Galão 20L");
        dono = permissoes.Add("estoque.custos");
    }

    // ---- Momento 1 ---------------------------------------------------------

    [Fact]
    public async Task RegistrarAsync_QuandoTipoFreteForaDaFaixa_LancaValorEnumInvalido()
    {
        var e = await Assert.ThrowsAsync<RequestValidationException>(
            () => sut.RegistrarAsync(Novo(frete: (TipoFrete)99), CancellationToken.None));

        Assert.Equal("VALOR_ENUM_INVALIDO", e.Code);
    }

    [Fact]
    public async Task RegistrarAsync_QuandoFuncionarioIdVazio_LancaIdInvalido()
    {
        var e = await Assert.ThrowsAsync<RequestValidationException>(
            () => sut.RegistrarAsync(Novo(funcionarioId: Guid.Empty), CancellationToken.None));

        Assert.Equal("ID_INVALIDO", e.Code);
    }

    [Fact]
    public async Task RegistrarAsync_QuandoProdutoMarcaIdVazio_LancaIdInvalido()
    {
        var e = await Assert.ThrowsAsync<RequestValidationException>(
            () => sut.RegistrarAsync(Novo(new AbastecimentoItem(Guid.Empty, 1)), CancellationToken.None));

        Assert.Equal("ID_INVALIDO", e.Code);
    }

    [Fact]
    public async Task RegistrarAsync_QuandoQuantidadeDeItemInvalida_LancaQuantidadeInvalida()
    {
        var e = await Assert.ThrowsAsync<RequestValidationException>(
            () => sut.RegistrarAsync(Novo(new AbastecimentoItem(marca.Id, 0)), CancellationToken.None));

        Assert.Equal("QUANTIDADE_INVALIDA", e.Code);
    }

    [Fact]
    public async Task RegistrarAsync_QuandoQuantidadeDeCascoInvalida_LancaQuantidadeInvalida()
    {
        var e = await Assert.ThrowsAsync<RequestValidationException>(
            () => sut.RegistrarAsync(
                new NovoAbastecimento(default, null, null, [], [new AbastecimentoCasco(casco.Id, 0)]),
                CancellationToken.None));

        Assert.Equal("QUANTIDADE_INVALIDA", e.Code);
    }

    [Fact]
    public async Task RegistrarAsync_QuandoAssociacaoNaoExiste_LancaNotFound()
    {
        var e = await Assert.ThrowsAsync<EntityNotFoundException>(
            () => sut.RegistrarAsync(Novo(new AbastecimentoItem(Guid.NewGuid(), 1)), CancellationToken.None));

        Assert.Equal("PRODUTO_MARCA_NAO_ENCONTRADA", e.Code);
    }

    [Fact]
    public async Task RegistrarAsync_QuandoTipoCascoNaoExiste_LancaNotFound404()
    {
        var e = await Assert.ThrowsAsync<EntityNotFoundException>(
            () => sut.RegistrarAsync(
                new NovoAbastecimento(default, null, null, [], [new AbastecimentoCasco(Guid.NewGuid(), 1)]),
                CancellationToken.None));

        Assert.Equal("TIPO_CASCO_NAO_ENCONTRADO", e.Code);
        Assert.Equal(404, e.StatusCode);
    }

    [Fact]
    public async Task RegistrarAsync_QuandoSemNenhumaLinha_LancaItensObrigatorios()
    {
        var e = await Assert.ThrowsAsync<RequestValidationException>(
            () => sut.RegistrarAsync(new NovoAbastecimento(default, null, null, [], []), CancellationToken.None));

        Assert.Equal("ITENS_OBRIGATORIOS", e.Code);
    }

    [Fact]
    public async Task RegistrarAsync_QuandoItensECascos_GravaSemValorNenhum()
    {
        var id = await sut.RegistrarAsync(
            new NovoAbastecimento(
                TipoFrete.PROPRIO, null, "obs", [new AbastecimentoItem(marca.Id, 10)],
                [new AbastecimentoCasco(casco.Id, 2)]),
            CancellationToken.None);

        var carga = abastecimentos.Cargas[id];
        Assert.Null(carga.Frete);
        var item = Assert.Single(carga.Itens);
        Assert.Equal((marca.Id, 10, (decimal?)null), (item.ReferenciaId, item.Quantidade, item.CustoUnitario));
        var c = Assert.Single(carga.Cascos);
        Assert.Equal((casco.Id, 2, (decimal?)null), (c.ReferenciaId, c.Quantidade, c.CustoUnitario));
    }

    [Fact]
    public async Task RegistrarAsync_QuandoSoCascos_Registra()
    {
        var id = await sut.RegistrarAsync(
            new NovoAbastecimento(default, null, null, [], [new AbastecimentoCasco(casco.Id, 3)]),
            CancellationToken.None);

        Assert.NotEqual(Guid.Empty, id);
    }

    // ---- Momento 2 ---------------------------------------------------------

    [Fact]
    public async Task LancarCustosAsync_Parcial_DepoisCompleto_FechaAPendencia()
    {
        var (id, item, c) = await CargaExemploAsync();

        var parcial = await sut.LancarCustosAsync(
            id, new LancamentoCustos(dono, null, [new CustoLinha(item, 5m)], []), CancellationToken.None);
        Assert.True(parcial.Custo.Pendente);
        Assert.True(parcial.Custo.FreteFaltando);
        Assert.Equal(1, parcial.Custo.LinhasSemCusto);
        Assert.Null(parcial.Custo.CustoTotal);
        Assert.Empty(parcial.Custo.CustoDaUnidade);

        // Linha e frete que não vieram mantêm o valor; só o casco e o frete entram agora.
        var completo = await sut.LancarCustosAsync(
            id, new LancamentoCustos(dono, 12m, [], [new CustoLinha(c, 0m)]), CancellationToken.None);
        Assert.False(completo.Custo.Pendente);
        Assert.Equal(5m, completo.Carga.Itens[0].CustoUnitario);
        Assert.Equal(12m, completo.Carga.Frete);
        Assert.Equal(62m, completo.Custo.CustoTotal);
    }

    [Fact]
    public async Task LancarCustosAsync_QuandoFreteNulo_MantemFreteAtual()
    {
        var (id, item, c) = await CargaExemploAsync();
        await sut.LancarCustosAsync(
            id, new LancamentoCustos(dono, 12m, [new CustoLinha(item, 5m)], [new CustoLinha(c, 0m)]),
            CancellationToken.None);

        var detalhe = await sut.LancarCustosAsync(
            id, new LancamentoCustos(dono, null, [new CustoLinha(item, 6m)], []), CancellationToken.None);

        Assert.Equal(12m, detalhe.Carga.Frete);
        Assert.Equal(72m, detalhe.Custo.CustoTotal);
    }

    [Fact]
    public async Task LancarCustosAsync_QuandoCustoNegativo_LancaCustoInvalido()
    {
        var (id, item, _) = await CargaExemploAsync();

        var e = await Assert.ThrowsAsync<RequestValidationException>(() => sut.LancarCustosAsync(
            id, new LancamentoCustos(dono, null, [new CustoLinha(item, -1m)], []), CancellationToken.None));

        Assert.Equal("CUSTO_INVALIDO", e.Code);
    }

    [Fact]
    public async Task LancarCustosAsync_QuandoFreteNegativo_LancaFreteInvalido()
    {
        var (id, _, _) = await CargaExemploAsync();

        var e = await Assert.ThrowsAsync<RequestValidationException>(() => sut.LancarCustosAsync(
            id, new LancamentoCustos(dono, -0.01m, [], []), CancellationToken.None));

        Assert.Equal("FRETE_INVALIDO", e.Code);
    }

    [Fact]
    public async Task LancarCustosAsync_QuandoLinhaDeOutraCarga_Lanca422()
    {
        var (id, _, _) = await CargaExemploAsync();
        var (_, itemOutra, _) = await CargaExemploAsync();

        var e = await Assert.ThrowsAsync<BusinessRuleException>(() => sut.LancarCustosAsync(
            id, new LancamentoCustos(dono, null, [new CustoLinha(itemOutra, 1m)], []), CancellationToken.None));

        Assert.Equal("LINHA_NAO_PERTENCE_A_CARGA", e.Code);
        Assert.Equal(422, e.StatusCode);
    }

    [Fact]
    public async Task LancarCustosAsync_QuandoLinhaRepetida_Lanca422()
    {
        var (id, item, _) = await CargaExemploAsync();

        var e = await Assert.ThrowsAsync<BusinessRuleException>(() => sut.LancarCustosAsync(
            id, new LancamentoCustos(dono, null, [new CustoLinha(item, 1m), new CustoLinha(item, 2m)], []),
            CancellationToken.None));

        Assert.Equal("LINHA_NAO_PERTENCE_A_CARGA", e.Code);
    }

    [Fact]
    public async Task LancarCustosAsync_QuandoLinhaDeCascoVemComoItem_Lanca422()
    {
        var (id, _, c) = await CargaExemploAsync();

        var e = await Assert.ThrowsAsync<BusinessRuleException>(() => sut.LancarCustosAsync(
            id, new LancamentoCustos(dono, null, [new CustoLinha(c, 1m)], []), CancellationToken.None));

        Assert.Equal("LINHA_NAO_PERTENCE_A_CARGA", e.Code);
    }

    [Fact]
    public async Task LancarCustosAsync_QuandoCargaNaoExiste_Lanca404()
    {
        var e = await Assert.ThrowsAsync<EntityNotFoundException>(() => sut.LancarCustosAsync(
            Guid.NewGuid(), new LancamentoCustos(dono, 1m, [], []), CancellationToken.None));

        Assert.Equal("ABASTECIMENTO_NAO_ENCONTRADO", e.Code);
    }

    [Fact]
    public async Task LancarCustosAsync_QuandoFuncionarioVazio_LancaIdInvalido()
    {
        var (id, _, _) = await CargaExemploAsync();

        var e = await Assert.ThrowsAsync<RequestValidationException>(() => sut.LancarCustosAsync(
            id, new LancamentoCustos(Guid.Empty, 1m, [], []), CancellationToken.None));

        Assert.Equal("ID_INVALIDO", e.Code);
    }

    // ---- Detalhe e pendentes -----------------------------------------------

    [Fact]
    public async Task ObterAsync_ComCustosCompletos_RateiaFreteComCascoContandoComoUnidade()
    {
        var (id, item, c) = await CargaExemploAsync();
        await sut.LancarCustosAsync(
            id, new LancamentoCustos(dono, 12m, [new CustoLinha(item, 5m)], [new CustoLinha(c, 0m)]),
            CancellationToken.None);

        var detalhe = await sut.ObterAsync(id, dono, CancellationToken.None);

        Assert.Equal(12, detalhe.Custo.TotalUnidades);
        Assert.Equal(6.0000m, detalhe.Custo.CustoDaUnidade[item]);
        Assert.Equal(1.0000m, detalhe.Custo.CustoDaUnidade[c]);
        Assert.Equal(62.00m, detalhe.Custo.CustoTotal);
        Assert.False(detalhe.Custo.Pendente);
    }

    [Fact]
    public async Task ObterAsync_SemFrete_FicaPendenteSemCustoDaUnidade()
    {
        var (id, item, c) = await CargaExemploAsync();
        await sut.LancarCustosAsync(
            id, new LancamentoCustos(dono, null, [new CustoLinha(item, 5m)], [new CustoLinha(c, 0m)]),
            CancellationToken.None);

        var detalhe = await sut.ObterAsync(id, dono, CancellationToken.None);

        Assert.True(detalhe.Custo.Pendente);
        Assert.True(detalhe.Custo.FreteFaltando);
        Assert.Null(detalhe.Custo.CustoTotal);
        Assert.Empty(detalhe.Custo.CustoDaUnidade);
    }

    [Fact]
    public async Task ObterAsync_ComFreteECascoSemCusto_FicaPendente()
    {
        var (id, item, _) = await CargaExemploAsync();
        await sut.LancarCustosAsync(
            id, new LancamentoCustos(dono, 12m, [new CustoLinha(item, 5m)], []), CancellationToken.None);

        var detalhe = await sut.ObterAsync(id, dono, CancellationToken.None);

        Assert.True(detalhe.Custo.Pendente);
        Assert.False(detalhe.Custo.FreteFaltando);
        Assert.Equal(1, detalhe.Custo.LinhasSemCusto);
        Assert.Null(detalhe.Custo.CustoTotal);
        Assert.Equal(6.0000m, detalhe.Custo.CustoDaUnidade[item]); // linha com custo e frete lançado
    }

    [Fact]
    public async Task ListarPendentesAsync_ListaSoAsPendentes()
    {
        var (pendente, item, c) = await CargaExemploAsync();
        var (completa, itemB, cB) = await CargaExemploAsync();
        await sut.LancarCustosAsync(
            completa, new LancamentoCustos(dono, 1m, [new CustoLinha(itemB, 1m)], [new CustoLinha(cB, 0m)]),
            CancellationToken.None);

        var lista = await sut.ListarPendentesAsync(dono, CancellationToken.None);

        var p = Assert.Single(lista);
        Assert.Equal(pendente, p.Id);
        Assert.Equal((12, 2, true), (p.TotalUnidades, p.LinhasSemCusto, p.FreteFaltando));
        Assert.NotEqual(Guid.Empty, item);
        Assert.NotEqual(Guid.Empty, c);
    }

    // ---- Permissão ---------------------------------------------------------

    [Fact]
    public async Task Custos_QuandoCargoSemEstoqueCustos_LancaForbiddenNoPutNoDetalheENosPendentes()
    {
        var (id, _, _) = await CargaExemploAsync();
        var sem = permissoes.Add("vendas.registrar");

        var put = await Assert.ThrowsAsync<ForbiddenException>(() => sut.LancarCustosAsync(
            id, new LancamentoCustos(sem, 1m, [], []), CancellationToken.None));
        var get = await Assert.ThrowsAsync<ForbiddenException>(() => sut.ObterAsync(id, sem, CancellationToken.None));
        var lista = await Assert.ThrowsAsync<ForbiddenException>(
            () => sut.ListarPendentesAsync(sem, CancellationToken.None));

        foreach (var e in new[] { put, get, lista })
        {
            Assert.Equal(403, e.StatusCode);
            Assert.Equal("PERMISSAO_NEGADA", e.Code);
        }

        Assert.Null(abastecimentos.Cargas[id].Frete);
    }

    [Fact]
    public async Task Custos_QuandoCargoTemCuringa_Aceita()
    {
        var (id, _, _) = await CargaExemploAsync();
        var adm = permissoes.Add("*");

        var detalhe = await sut.ObterAsync(id, adm, CancellationToken.None);

        Assert.Equal(id, detalhe.Carga.Id);
        Assert.Single(await sut.ListarPendentesAsync(adm, CancellationToken.None));
    }

    [Fact]
    public async Task Custos_QuandoFuncionarioNaoExiste_Lanca404()
    {
        var (id, _, _) = await CargaExemploAsync();

        var e = await Assert.ThrowsAsync<EntityNotFoundException>(
            () => sut.ObterAsync(id, Guid.NewGuid(), CancellationToken.None));

        Assert.Equal("FUNCIONARIO_NAO_ENCONTRADO", e.Code);
    }

    [Fact]
    public async Task Custos_QuandoFuncionarioInativo_Lanca403()
    {
        var (id, _, _) = await CargaExemploAsync();
        var inativo = permissoes.Add();

        var e = await Assert.ThrowsAsync<ForbiddenException>(
            () => sut.ObterAsync(id, inativo, CancellationToken.None));

        Assert.Equal(403, e.StatusCode);
    }

    // ---- CustoCarga (função pura) ------------------------------------------

    [Fact]
    public void CustoCarga_NaoArredondaNoMeio_UnidadeComQuatroCasasETotalComDuas()
    {
        var a = Guid.NewGuid();
        var b = Guid.NewGuid();
        var r = CustoCarga.Calcular([new LinhaCarga(a, Guid.NewGuid(), 1, 1m), new LinhaCarga(b, Guid.NewGuid(), 2, 0.01m)], 1m);

        Assert.Equal(1.3333m, r.CustoDaUnidade[a]);
        Assert.Equal(0.3433m, r.CustoDaUnidade[b]);
        Assert.Equal(2.02m, r.CustoTotal);
    }

    // ---- Apoio -------------------------------------------------------------

    /// <summary>10 itens + 2 cascos = 12 unidades, tudo sem valor.</summary>
    private async Task<(Guid Id, Guid Item, Guid Casco)> CargaExemploAsync()
    {
        var id = await sut.RegistrarAsync(
            new NovoAbastecimento(
                TipoFrete.TERCEIRIZADO, null, null, [new AbastecimentoItem(marca.Id, 10)],
                [new AbastecimentoCasco(casco.Id, 2)]),
            CancellationToken.None);
        var carga = abastecimentos.Cargas[id];
        return (id, carga.Itens[0].Id, carga.Cascos[0].Id);
    }

    private NovoAbastecimento Novo(
        AbastecimentoItem? item = null, TipoFrete frete = default, Guid? funcionarioId = null) => new(
        frete, funcionarioId, null, [item ?? new AbastecimentoItem(marca.Id, 1)], []);

    private sealed class FakeAbastecimentoRepository : IAbastecimentoRepository
    {
        public Dictionary<Guid, Abastecimento> Cargas { get; } = [];

        public Task<Guid> CreateAsync(NovoAbastecimento a, CancellationToken cancellationToken)
        {
            var id = Guid.NewGuid();
            Cargas[id] = new Abastecimento(
                id, DateOnly.FromDateTime(DateTime.Today), a.TipoFrete, a.FuncionarioId, a.Observacao, null,
                a.Itens.Select(i => new LinhaCarga(Guid.NewGuid(), i.ProdutoMarcaId, i.Quantidade, null)).ToList(),
                a.Cascos.Select(c => new LinhaCarga(Guid.NewGuid(), c.TipoCascoId, c.Quantidade, null)).ToList());
            return Task.FromResult(id);
        }

        public Task<Abastecimento?> GetAsync(Guid id, CancellationToken cancellationToken) =>
            Task.FromResult(Cargas.GetValueOrDefault(id));

        public Task LancarCustosAsync(Guid id, LancamentoCustos custos, CancellationToken cancellationToken)
        {
            var carga = Cargas[id];
            LinhaCarga Aplicar(LinhaCarga l, IReadOnlyList<CustoLinha> novos) =>
                novos.FirstOrDefault(n => n.Id == l.Id) is { } n ? l with { CustoUnitario = n.CustoUnitario } : l;

            Cargas[id] = carga with
            {
                Frete = custos.Frete ?? carga.Frete,
                Itens = carga.Itens.Select(l => Aplicar(l, custos.Itens)).ToList(),
                Cascos = carga.Cascos.Select(l => Aplicar(l, custos.Cascos)).ToList()
            };
            return Task.CompletedTask;
        }

        public Task<IReadOnlyList<AbastecimentoPendente>> ListPendentesAsync(CancellationToken cancellationToken) =>
            Task.FromResult<IReadOnlyList<AbastecimentoPendente>>(Cargas.Values
                .Select(c => (Carga: c, Custo: CustoCarga.Calcular([.. c.Itens, .. c.Cascos], c.Frete)))
                .Where(x => x.Custo.Pendente)
                .Select(x => new AbastecimentoPendente(
                    x.Carga.Id, x.Carga.Data, x.Carga.TipoFrete, x.Custo.TotalUnidades, x.Custo.LinhasSemCusto,
                    x.Custo.FreteFaltando))
                .ToList());
    }

    private sealed class FakePermissaoLookup : IPermissaoFuncionarioLookup
    {
        private readonly Dictionary<Guid, IReadOnlyList<string>> funcionarios = [];

        /// <summary>Sem permissões = funcionário inativo (o repositório real devolve lista vazia).</summary>
        public Guid Add(params string[] permissoes)
        {
            var id = Guid.NewGuid();
            funcionarios[id] = permissoes;
            return id;
        }

        public Task<IReadOnlyList<string>?> PermissoesAsync(Guid funcionarioId, CancellationToken cancellationToken) =>
            Task.FromResult(funcionarios.GetValueOrDefault(funcionarioId));
    }
}
