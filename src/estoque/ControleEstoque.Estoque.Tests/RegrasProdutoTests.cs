using ControleEstoque.Estoque.Domain;

namespace ControleEstoque.Estoque.Tests;

/// <summary>Funções puras do modelo de produto: estoque geral, alerta por associação e casco resolvido.</summary>
public sealed class RegrasProdutoTests
{
    private static readonly Guid CascoGenerico = Guid.NewGuid();
    private static readonly Guid CascoEspecificoB = Guid.NewGuid();

    [Fact]
    public void EstoqueGeral_SomaAsMarcasEAlertaEPorAssociacao()
    {
        // 'Galão 20L': marca A com 3 e mínimo 5; marca B com 4 e mínimo 0.
        var a = Marca(quantidade: 3, minimo: 5);
        var b = Marca(quantidade: 4, minimo: 0);
        var produto = Produto(TipoProduto.RETORNAVEL, a, b);

        Assert.Equal(7, produto.EstoqueGeral);
        Assert.True(a.AbaixoMinimo);
        Assert.False(b.AbaixoMinimo);
    }

    [Fact]
    public void EstoqueGeral_SemAssociacao_EZero() =>
        Assert.Equal(0, Produto(TipoProduto.DESCARTAVEL).EstoqueGeral);

    [Theory]
    [InlineData(3, 5, true)]
    [InlineData(5, 5, false)]
    [InlineData(0, 0, false)]
    public void AbaixoMinimo_AplicaARegraPorAssociacao(long quantidade, int minimo, bool esperado) =>
        Assert.Equal(esperado, Marca(quantidade, minimo).AbaixoMinimo);

    [Fact]
    public void Resolver_CascoEspecificoVenceOGenerico()
    {
        var a = Marca(tipoCascoId: null);
        var b = Marca(tipoCascoId: CascoEspecificoB);
        var produto = Produto(TipoProduto.RETORNAVEL, a, b);

        Assert.Equal(CascoEspecificoB, RegrasCasco.Resolver(produto, b));
        Assert.Equal(CascoGenerico, RegrasCasco.Resolver(produto, a));
    }

    [Fact]
    public void Resolver_Descartavel_FicaSemCasco()
    {
        var a = Marca();
        var produto = Produto(TipoProduto.DESCARTAVEL, a) with { TipoCascoId = null };

        Assert.Null(RegrasCasco.Resolver(produto, a));
    }

    [Fact]
    public void MovimentosDaQuebra_TipoQueAceitaSucata_SaiDoVazioEEntraNaSucata()
    {
        var movimentos = RegrasCasco.MovimentosDaQuebra(2, aceitaSucata: true);

        Assert.Equal(
            [
                new MovimentoCasco(SituacaoCasco.VAZIO, TipoMovimentoEstoque.BAIXA_QUEBRA, -2),
                new MovimentoCasco(SituacaoCasco.SUCATA, TipoMovimentoEstoque.ENTRADA_SUCATA, 2)
            ],
            movimentos);
    }

    [Fact]
    public void MovimentosDaQuebra_TipoQueNaoAceitaSucata_SoSaiDoVazio() =>
        Assert.Equal(
            [new MovimentoCasco(SituacaoCasco.VAZIO, TipoMovimentoEstoque.BAIXA_QUEBRA, -2)],
            RegrasCasco.MovimentosDaQuebra(2, aceitaSucata: false));

    [Fact]
    public void MovimentosDaPerda_SoSaiDoVazioComBaixaPerda() =>
        Assert.Equal(
            [new MovimentoCasco(SituacaoCasco.VAZIO, TipoMovimentoEstoque.BAIXA_PERDA, -2)],
            RegrasCasco.MovimentosDaPerda(2));

    private static ProdutoMarca Marca(long quantidade = 0, int minimo = 0, Guid? tipoCascoId = null) => new(
        Guid.NewGuid(), Guid.NewGuid(), "Marca", 10m, minimo, quantidade, null, tipoCascoId);

    private static Produto Produto(TipoProduto tipo, params ProdutoMarca[] marcas) => new(
        Guid.NewGuid(), tipo, "Galão 20L", null, "20L", tipo == TipoProduto.RETORNAVEL ? CascoGenerico : null, marcas);
}
