using ControleEstoque.Vendas.Domain;

namespace ControleEstoque.Vendas.Tests;

public sealed class RegrasCascoTests
{
    private static readonly Guid Generico = Guid.NewGuid();
    private static readonly Guid Especifico = Guid.NewGuid();

    [Fact]
    public void Resolver_QuandoMarcaTemCascoEspecifico_EspecificoVenceOGenerico() =>
        Assert.Equal(Especifico, RegrasCasco.Resolver(TipoProduto.RETORNAVEL, Generico, Especifico));

    [Fact]
    public void Resolver_QuandoMarcaSemCasco_UsaOGenericoDoProduto() =>
        Assert.Equal(Generico, RegrasCasco.Resolver(TipoProduto.RETORNAVEL, Generico, null));

    [Fact]
    public void Resolver_QuandoDescartavel_NaoTemCasco()
    {
        Assert.Null(RegrasCasco.Resolver(TipoProduto.DESCARTAVEL, null, null));
        Assert.Null(RegrasCasco.Resolver(TipoProduto.DESCARTAVEL, Generico, Especifico));
    }

    private static MovimentoPerda Prod(TipoMovimentoPerda t, int q) => new(DestinoMovimento.PRODUTO, null, t, q);

    private static MovimentoPerda Casco(SituacaoCasco s, TipoMovimentoPerda t, int q) =>
        new(DestinoMovimento.CASCO, s, t, q);

    [Fact]
    public void MovimentosDaPerda_CheioQuebradoQueAceitaSucata_BaixaProdutoESobeSucata() =>
        Assert.Equal(
            [Prod(TipoMovimentoPerda.BAIXA_QUEBRA, -2), Casco(SituacaoCasco.SUCATA, TipoMovimentoPerda.ENTRADA_SUCATA, 2)],
            RegrasCasco.MovimentosDaPerda(GalaoPerda.CHEIO, MotivoPerda.QUEBRADO, 2, true));

    [Fact]
    public void MovimentosDaPerda_CheioPerdido_BaixaPerdaSemSucata() =>
        Assert.Equal(
            [Prod(TipoMovimentoPerda.BAIXA_PERDA, -2)],
            RegrasCasco.MovimentosDaPerda(GalaoPerda.CHEIO, MotivoPerda.PERDIDO, 2, true));

    [Fact]
    public void MovimentosDaPerda_VazioQuebradoQueAceitaSucata_BaixaVazioESobeSucata() =>
        Assert.Equal(
            [Casco(SituacaoCasco.VAZIO, TipoMovimentoPerda.BAIXA_QUEBRA, -3),
                Casco(SituacaoCasco.SUCATA, TipoMovimentoPerda.ENTRADA_SUCATA, 3)],
            RegrasCasco.MovimentosDaPerda(GalaoPerda.VAZIO, MotivoPerda.QUEBRADO, 3, true));

    [Fact]
    public void MovimentosDaPerda_VazioPerdido_BaixaPerdaDoVazioSemSucata() =>
        Assert.Equal(
            [Casco(SituacaoCasco.VAZIO, TipoMovimentoPerda.BAIXA_PERDA, -3)],
            RegrasCasco.MovimentosDaPerda(GalaoPerda.VAZIO, MotivoPerda.PERDIDO, 3, true));

    [Theory]
    [InlineData(GalaoPerda.CHEIO)]
    [InlineData(GalaoPerda.VAZIO)]
    public void MovimentosDaPerda_QuebraSemAceitaSucata_NaoGeraSucata(GalaoPerda galao) =>
        Assert.DoesNotContain(
            RegrasCasco.MovimentosDaPerda(galao, MotivoPerda.QUEBRADO, 1, false),
            m => m.Situacao == SituacaoCasco.SUCATA);
}
