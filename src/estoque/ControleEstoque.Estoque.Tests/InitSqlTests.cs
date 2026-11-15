using System.Text.RegularExpressions;

namespace ControleEstoque.Estoque.Tests;

internal static class InitSql
{
    /// <summary>Texto de infra/postgres/init.sql, achado subindo a partir da pasta dos testes.</summary>
    public static string Ler()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null && !File.Exists(Path.Combine(dir.FullName, "infra", "postgres", "init.sql")))
            dir = dir.Parent;
        Assert.NotNull(dir);
        return File.ReadAllText(Path.Combine(dir!.FullName, "infra", "postgres", "init.sql"));
    }
}

/// <summary>Sem Postgres na verificação: o schema é conferido pelo texto do init.sql.</summary>
public sealed class InitSqlTests
{
    [Fact]
    public void TipoProduto_SoTemRetornavelEDescartavel()
    {
        var sql = InitSql.Ler();

        var ini = sql.IndexOf("CREATE TYPE tipo_produto AS ENUM", StringComparison.Ordinal);
        Assert.True(ini >= 0, "tipo_produto deve ser um ENUM");
        var bloco = sql[ini..sql.IndexOf(';', ini)];

        var rotulos = Regex.Matches(bloco, "'([A-Z_]+)'").Select(m => m.Groups[1].Value).ToArray();
        Assert.Equal(["RETORNAVEL", "DESCARTAVEL"], rotulos);
    }

    [Fact]
    public void ProdutoMarcas_TemUnicidadeProdutoMarca()
    {
        var sql = InitSql.Ler();

        Assert.Contains("CREATE TABLE IF NOT EXISTS produto_marcas", sql);
        Assert.Matches(
            @"CREATE UNIQUE INDEX IF NOT EXISTS \w+\s+ON produto_marcas\(produto_id, marca_id\)", sql);
    }

    [Fact]
    public void Seeds_NaoCriamMaisProdutosDeCascoESucata()
    {
        var sql = InitSql.Ler();

        Assert.DoesNotContain("INSERT INTO produtos", sql);
    }
}
