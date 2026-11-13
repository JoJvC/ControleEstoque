using ControleEstoque.Shared.Results;

namespace ControleEstoque.Shared.Hosting.Tests;

public class ValidacaoTests
{
    private static readonly DateOnly D1 = new(2026, 1, 1);
    private static readonly DateOnly D2 = new(2026, 2, 1);

    [Fact]
    public void Periodo_QuandoInicioDepoisDoFim_Lanca()
    {
        var e = Assert.Throws<RequestValidationException>(() => Validacao.Periodo(D2, D1));

        Assert.Equal("PERIODO_INVALIDO", e.Code);
        Assert.Equal(400, e.StatusCode);
    }

    [Theory]
    [InlineData(true, true)]
    [InlineData(true, false)]
    [InlineData(false, true)]
    [InlineData(false, false)]
    public void Periodo_QuandoIgualOuIncompleto_NaoLanca(bool temInicio, bool temFim)
    {
        Validacao.Periodo(temInicio ? D1 : null, temFim ? D1 : null);
    }

    [Fact]
    public void SemNulos_QuandoListaNula_DevolveVazia()
    {
        Assert.Empty(Validacao.SemNulos<string>(null, "Itens"));
    }

    [Fact]
    public void SemNulos_QuandoElementoNulo_Lanca()
    {
        var e = Assert.Throws<RequestValidationException>(
            () => Validacao.SemNulos<object>([new object(), null], "Itens"));

        Assert.Equal("ITEM_INVALIDO", e.Code);
    }

    [Fact]
    public void SemNulos_QuandoListaValida_DevolveMesmosElementos()
    {
        Assert.Equal(2, Validacao.SemNulos<object>([new object(), new object()], "Itens").Count);
    }
}
