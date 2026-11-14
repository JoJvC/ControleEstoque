using ControleEstoque.Estoque.Domain;

namespace ControleEstoque.Estoque.Tests;

public class EstoqueMinimoTests
{
    [Theory]
    [InlineData(3, 5, true)]
    [InlineData(5, 5, false)]
    [InlineData(0, 0, false)]
    [InlineData(6, 5, false)]
    public void Abaixo_SoQuandoQuantidadeMenorQueMinimoPositivo(long quantidade, int minimo, bool esperado)
        => Assert.Equal(esperado, EstoqueMinimo.Abaixo(quantidade, minimo));

    [Fact]
    public void ViewSql_UsaMenorQueEMinimoPositivo()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null && !File.Exists(Path.Combine(dir.FullName, "infra", "postgres", "init.sql")))
            dir = dir.Parent;
        Assert.NotNull(dir);
        var sql = File.ReadAllText(Path.Combine(dir!.FullName, "infra", "postgres", "init.sql"));

        var ini = sql.IndexOf("CREATE OR REPLACE VIEW vw_estoque_atual", StringComparison.Ordinal);
        Assert.True(ini >= 0, "vw_estoque_atual deve ser CREATE OR REPLACE VIEW");
        var fim = sql.IndexOf(';', ini);
        var bloco = sql[ini..fim];

        Assert.StartsWith("CREATE OR REPLACE VIEW vw_estoque_atual", bloco);
        Assert.Contains("estoque_minimo > 0", bloco);
        Assert.Contains("< p.estoque_minimo", bloco);
        Assert.DoesNotContain("<= p.estoque_minimo", bloco);
    }
}
