namespace ControleEstoque.Vendas.Tests;

/// <summary>Sem Postgres na verificação: o SQL do recebido por dia é conferido pelo texto do repositório.</summary>
public sealed class RecebidoPorDiaSemContagemDuplaTests
{
    [Fact]
    public void RecebidoPorDia_ExcluiPagamentosDoRecebimentoDeFiadoEMantemOPagamentoAvulso()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null && !File.Exists(Path.Combine(dir.FullName, "infra", "postgres", "init.sql")))
            dir = dir.Parent;
        Assert.NotNull(dir);
        var cs = File.ReadAllText(Path.Combine(
            dir!.FullName, "src", "vendas", "ControleEstoque.Vendas.Repository", "PostgresRelatorioVendasRepository.cs"));
        var i = cs.IndexOf("RecebidoPorDia = ", StringComparison.Ordinal);
        Assert.True(i >= 0);
        var sql = cs[i..cs.IndexOf("\"\"\";", i, StringComparison.Ordinal)];

        Assert.Contains("p.lancamento_fiado_id IS NULL", sql);
        Assert.Contains("l.venda_id IS NULL", sql);
    }

    [Fact]
    public void DebitoFiadoRestante_DescontaLinhasLigadasAoRecebimento()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null && !File.Exists(Path.Combine(dir.FullName, "infra", "postgres", "init.sql")))
            dir = dir.Parent;
        Assert.NotNull(dir);
        var cs = File.ReadAllText(Path.Combine(
            dir!.FullName, "src", "vendas", "ControleEstoque.Vendas.Repository", "PostgresVendaRepository.cs"));
        var i = cs.IndexOf("GetInfoPagamento = ", StringComparison.Ordinal);

        Assert.True(i >= 0);
        Assert.Contains("p.lancamento_fiado_id IS NOT NULL", cs[i..cs.IndexOf("\"\"\";", i, StringComparison.Ordinal)]);
    }
}
