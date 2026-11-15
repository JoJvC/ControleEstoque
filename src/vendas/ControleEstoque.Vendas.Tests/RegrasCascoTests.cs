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
}
