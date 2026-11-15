using System.Text.Json;
using ControleEstoque.Vendas.Domain;

namespace ControleEstoque.Vendas.Tests;

public sealed class FaturamentoCategoriasTests
{
    private static IReadOnlyList<FaturamentoPorCategoria> Consolidar(
        params (string?, long, decimal)[] linhas) => FaturamentoCategorias.Consolidar(linhas);

    [Fact]
    public void CategoriaNula_ViraOutros() =>
        Assert.Equal(
            [new FaturamentoPorCategoria("Outros", 2, 10m)],
            Consolidar((null, 2, 10m)));

    [Fact]
    public void CategoriaVaziaOuEspacos_ViraOutros() =>
        Assert.Equal(
            [new FaturamentoPorCategoria("Outros", 2, 8m)],
            Consolidar(("", 1, 5m), ("  ", 1, 3m)));

    [Fact]
    public void CategoriaComEspacosNasPontas_EApada() =>
        Assert.Equal(
            [new FaturamentoPorCategoria("Água", 5, 50m)],
            Consolidar((" Água ", 5, 50m)));

    [Fact]
    public void CategoriasIguaisAposTrim_Fundem() =>
        Assert.Equal(
            [new FaturamentoPorCategoria("Carvão", 4, 80m)],
            Consolidar(("Carvão", 3, 60m), (" Carvão ", 1, 20m)));

    [Fact]
    public void Ordem_TotalDecrescente_EmpatePorNome() =>
        Assert.Equal(
            ["Carvão", "Gelo", "Copos", "Água", "Outros"],
            Consolidar(
                ("Água", 1, 40m), ("Carvão", 3, 60m), (" Carvão ", 1, 20m),
                ("Gelo", 4, 80m), ("Copos", 2, 40m), (null, 2, 10m),
                ("", 1, 5m)).Select(c => c.Categoria));

    [Fact]
    public void EntradaVazia_DevolveListaVazia() => Assert.Empty(Consolidar());

    [Fact]
    public void Serializacao_UsaChavesCamelCase()
    {
        var rel = new RelatorioFaturamento(0, 0, 0, [], [], [new FaturamentoPorCategoria("Água", 6, 90m)], 0, 0);
        var json = JsonSerializer.Serialize(rel, new JsonSerializerOptions(JsonSerializerDefaults.Web));
        using var doc = JsonDocument.Parse(json);
        var item = doc.RootElement.GetProperty("porCategoria")[0];
        Assert.Equal("Água", item.GetProperty("categoria").GetString());
        Assert.Equal(6, item.GetProperty("quantidade").GetInt64());
        Assert.Equal(90m, item.GetProperty("totalLiquido").GetDecimal());
    }
}
