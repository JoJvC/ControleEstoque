using System.Text.RegularExpressions;

namespace ControleEstoque.Clientes.Tests;

/// <summary>Sem Postgres na verificação: o schema é conferido pelo texto do init.sql.</summary>
public sealed class InitSqlTests
{
    private static string Ler()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null && !File.Exists(Path.Combine(dir.FullName, "infra", "postgres", "init.sql")))
            dir = dir.Parent;
        Assert.NotNull(dir);
        return File.ReadAllText(Path.Combine(dir!.FullName, "infra", "postgres", "init.sql"));
    }

    /// <summary>Do começo do bloco até o ';' que o fecha.</summary>
    private static string Bloco(string sql, string inicio)
    {
        var ini = sql.IndexOf(inicio, StringComparison.Ordinal);
        Assert.True(ini >= 0, $"{inicio} não encontrado");
        return sql[ini..sql.IndexOf(';', ini)];
    }

    [Theory]
    [InlineData("CREATE TABLE movimentos_casco_cliente")]
    [InlineData("CREATE TABLE entregas_sucata_cliente")]
    public void TabelasDeCascoESucataDoCliente_TemTipoCascoIdObrigatorio(string inicio)
    {
        var bloco = Bloco(Ler(), inicio);

        Assert.Matches(@"tipo_casco_id\s+UUID NOT NULL REFERENCES tipos_casco\(id\)", bloco);
    }

    [Theory]
    [InlineData("CREATE VIEW vw_saldo_casco_cliente")]
    [InlineData("CREATE VIEW vw_sucata_entregue_cliente")]
    public void ViewsDeSaldoESucataDoCliente_AgrupamPorTipoCasco(string inicio)
    {
        var bloco = Bloco(Ler(), inicio);

        Assert.Matches(@"GROUP BY c\.id,\s*\w+\.tipo_casco_id", bloco);
        Assert.Matches(@"\w+\.tipo_casco_id,", bloco);
    }
}
