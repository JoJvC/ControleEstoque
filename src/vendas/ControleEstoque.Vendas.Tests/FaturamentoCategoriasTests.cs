using System.Text.Json;
using ControleEstoque.Vendas.Domain;

namespace ControleEstoque.Vendas.Tests;

public sealed class FaturamentoCategoriasTests
{
    private static IReadOnlyList<FaturamentoPorCategoria> Consolidar(
        params (TipoProduto, string?, long, decimal)[] linhas) => FaturamentoCategorias.Consolidar(linhas);

    [Fact]
    public void Agua_ComCategoriaNula_ViraAgua() =>
        Assert.Equal(
            [new FaturamentoPorCategoria("Água", 5, 50m)],
            Consolidar((TipoProduto.AGUA, null, 5, 50m)));

    [Fact]
    public void AguaEGalao_ComCategoriasDiferentes_FundemEmAgua() =>
        Assert.Equal(
            [new FaturamentoPorCategoria("Água", 6, 90m)],
            Consolidar((TipoProduto.AGUA, "X", 5, 50m), (TipoProduto.GALAO_COMPLETO, "Galões", 1, 40m)));

    [Fact]
    public void CascoESucata_IgnoramCategoria() =>
        Assert.Equal(
            [new FaturamentoPorCategoria("Casco", 2, 40m), new FaturamentoPorCategoria("Sucata", 1, 1m)],
            Consolidar((TipoProduto.CASCO, "a", 2, 40m), (TipoProduto.SUCATA, "qualquer", 1, 1m)));

    [Fact]
    public void Descartavel_ComCategoriaNula_ViraOutros() =>
        Assert.Equal(
            [new FaturamentoPorCategoria("Outros", 2, 10m)],
            Consolidar((TipoProduto.DESCARTAVEL, null, 2, 10m)));

    [Fact]
    public void Descartavel_ComVazioOuEspacos_ViraOutros() =>
        Assert.Equal(
            [new FaturamentoPorCategoria("Outros", 2, 8m)],
            Consolidar((TipoProduto.DESCARTAVEL, "", 1, 5m), (TipoProduto.DESCARTAVEL, "  ", 1, 3m)));

    [Fact]
    public void Descartavel_NomesIguaisAposTrim_Fundem() =>
        Assert.Equal(
            [new FaturamentoPorCategoria("Carvão", 4, 80m)],
            Consolidar((TipoProduto.DESCARTAVEL, "Carvão", 3, 60m), (TipoProduto.DESCARTAVEL, " Carvão ", 1, 20m)));

    [Fact]
    public void Ordem_TotalDecrescente_EmpatePorNome() =>
        Assert.Equal(
            ["Água", "Carvão", "Gelo", "Casco", "Outros", "Sucata"],
            Consolidar(
                (TipoProduto.AGUA, null, 5, 50m), (TipoProduto.GALAO_COMPLETO, "Galões", 1, 40m),
                (TipoProduto.DESCARTAVEL, "Carvão", 3, 60m), (TipoProduto.DESCARTAVEL, " Carvão ", 1, 20m),
                (TipoProduto.DESCARTAVEL, "Gelo", 4, 80m), (TipoProduto.DESCARTAVEL, null, 2, 10m),
                (TipoProduto.DESCARTAVEL, "", 1, 5m), (TipoProduto.CASCO, null, 2, 40m),
                (TipoProduto.SUCATA, "qualquer", 1, 1m)).Select(c => c.Categoria));

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
