using System.Text.RegularExpressions;

namespace ControleEstoque.Clientes.Tests;

/// <summary>Sem Postgres na verificação: as consultas de cascos são conferidas pelo texto do repositório.</summary>
public sealed class SaldosCascosSqlTests
{
    private static string Sql(string arquivo, string nome)
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null && !Directory.Exists(Path.Combine(dir.FullName, "src", "clientes")))
            dir = dir.Parent;
        Assert.NotNull(dir);
        var fonte = File.ReadAllText(Path.Combine(
            dir!.FullName, "src", "clientes", "ControleEstoque.Clientes.Repository", arquivo));
        var ini = fonte.IndexOf($"const string {nome} =", StringComparison.Ordinal);
        Assert.True(ini >= 0, $"{nome} não encontrada");
        return fonte[ini..fonte.IndexOf(';', ini)];
    }

    [Theory]
    [InlineData("PostgresSaldosRepository.cs", "ListSaldosCasco")]
    [InlineData("PostgresSaldosRepository.cs", "TotalCascosNaRua")]
    [InlineData("PostgresCascoClienteRepository.cs", "GetSaldo")]
    public void TotaisDeCascos_SomamSoOsPositivosPorTipo(string arquivo, string nome)
    {
        var sql = Sql(arquivo, nome);

        Assert.Contains("GREATEST(saldo_cascos, 0)", sql);
        Assert.DoesNotMatch(@"SUM\(\s*saldo_cascos\s*\)", sql);
    }

    [Fact]
    public void ListSaldosCasco_TrazOAFavorEOrdenaPeloPositivo()
    {
        var sql = Sql("PostgresSaldosRepository.cs", "ListSaldosCasco");

        Assert.Contains("GREATEST(-saldo_cascos, 0)", sql);
        Assert.Contains("ORDER BY cascos DESC, a_favor DESC, nome", sql);
    }
}
