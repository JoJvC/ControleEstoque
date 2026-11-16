using System.Text.RegularExpressions;
using ControleEstoque.Financeiro.Domain;

namespace ControleEstoque.Financeiro.Tests;

/// <summary>Sem Postgres na verificação: schema e SQL do recebimento de fiado conferidos pelo texto dos arquivos.</summary>
public sealed class CaixaSemContagemDuplaTests
{
    private static string Ler(params string[] caminho)
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null && !File.Exists(Path.Combine(dir.FullName, "infra", "postgres", "init.sql")))
            dir = dir.Parent;
        Assert.NotNull(dir);
        return File.ReadAllText(Path.Combine([dir!.FullName, .. caminho]));
    }

    private static string Fonte(string projeto, string arquivo) =>
        Ler("src", projeto.Split('.')[1].ToLowerInvariant(), projeto, arquivo);

    [Fact]
    public void InitSql_VendaPagamentosTemLancamentoFiadoComFkEIndice()
    {
        var sql = Ler("infra", "postgres", "init.sql");

        Assert.Matches(
            @"ALTER TABLE venda_pagamentos ADD COLUMN IF NOT EXISTS lancamento_fiado_id UUID REFERENCES lancamentos_fiado\(id\)",
            sql);
        Assert.Matches(
            @"CREATE INDEX IF NOT EXISTS idx_venda_pagamentos_lancamento_fiado\s+ON venda_pagamentos \(lancamento_fiado_id\) WHERE lancamento_fiado_id IS NOT NULL",
            sql);
        Assert.True(
            sql.IndexOf("CREATE TABLE lancamentos_fiado", StringComparison.Ordinal)
            < sql.IndexOf("ADD COLUMN IF NOT EXISTS lancamento_fiado_id", StringComparison.Ordinal),
            "a FK exige lancamentos_fiado criada antes");
    }

    [Theory]
    [InlineData("ControleEstoque.Financeiro.Repository", "PostgresCaixaRepository.cs")]
    [InlineData("ControleEstoque.Financeiro.Repository", "PostgresRelatorioCaixaRepository.cs")]
    public void EntradasDoCaixa_SomamVendaPagamentosSemOsDoRecebimentoEOPagamentoAvulso(
        string projeto, string arquivo)
    {
        var cs = Fonte(projeto, arquivo);

        Assert.Contains("p.lancamento_fiado_id IS NULL", cs);
        Assert.Contains("l.venda_id IS NULL", cs);
    }

    // Os enums do Financeiro espelham o init.sql (sem referenciar o contexto Vendas).
    [Theory]
    [InlineData("forma_pagamento", typeof(FormaPagamento))]
    [InlineData("status_pagamento_venda", typeof(StatusPagamento))]
    public void EnumsLocais_TemOsMesmosRotulosDoInitSql(string tipoSql, Type tipo)
    {
        var sql = Ler("infra", "postgres", "init.sql");
        var m = Regex.Match(sql, $@"CREATE TYPE {tipoSql} AS ENUM\s*\(([^)]*)\)");
        Assert.True(m.Success, $"CREATE TYPE {tipoSql} não encontrado");
        var rotulos = Regex.Matches(m.Groups[1].Value, "'([A-Z_]+)'").Select(x => x.Groups[1].Value);

        Assert.Equal(rotulos.OrderBy(x => x), Enum.GetNames(tipo).OrderBy(x => x));
    }

    [Theory]
    [InlineData(50, 0, StatusPagamento.PENDENTE)]
    [InlineData(50, 20, StatusPagamento.PARCIAL)]
    [InlineData(50, 50, StatusPagamento.PAGA)]
    [InlineData(50, 60, StatusPagamento.PAGA)]
    public void CalcularStatus_EspelhaARegraDaVenda(decimal liquido, decimal pago, StatusPagamento esperado) =>
        Assert.Equal(esperado, FiadoFifo.CalcularStatus(liquido, pago));
}
