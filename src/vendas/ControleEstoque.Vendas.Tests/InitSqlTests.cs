using System.Text.RegularExpressions;

namespace ControleEstoque.Vendas.Tests;

/// <summary>Sem Postgres na verificação: o schema da venda é conferido pelo texto do init.sql.</summary>
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

    /// <summary>Corpo do CREATE TABLE (até o fechamento <c>);</c> no início de linha).</summary>
    private static string Tabela(string sql, string nome)
    {
        var ini = sql.IndexOf($"CREATE TABLE {nome} (", StringComparison.Ordinal);
        if (ini < 0)
            ini = sql.IndexOf($"CREATE TABLE IF NOT EXISTS {nome} (", StringComparison.Ordinal);
        Assert.True(ini >= 0, $"CREATE TABLE {nome} não encontrado");
        return sql[ini..sql.IndexOf("\n);", ini, StringComparison.Ordinal)];
    }

    [Fact]
    public void VendaItens_ReferenciaProdutoMarcaETemOsCamposDoVasilhame()
    {
        var tabela = Tabela(Ler(), "venda_itens");

        Assert.Matches(@"produto_marca_id\s+UUID NOT NULL REFERENCES produto_marcas\(id\)", tabela);
        Assert.Matches(@"tipo_casco_id\s+UUID REFERENCES tipos_casco\(id\)", tabela);
        Assert.Matches(@"pagou_vasilhame\s+BOOLEAN NOT NULL DEFAULT FALSE", tabela);
        Assert.Matches(@"preco_vasilhame\s+NUMERIC\(19,2\) CHECK \(preco_vasilhame >= 0\)", tabela);
        Assert.DoesNotMatch(@"\bproduto_id\b", tabela);
    }

    [Fact]
    public void VendaItens_VasilhamePagoExigeTipoDeCascoEPrecoAplicado()
    {
        var tabela = Tabela(Ler(), "venda_itens");

        Assert.Matches(
            @"CONSTRAINT chk_venda_itens_vasilhame_pago CHECK \(\s*NOT pagou_vasilhame OR \(tipo_casco_id IS NOT NULL AND preco_vasilhame IS NOT NULL\)\s*\)",
            tabela);
    }

    [Fact]
    public void VendaItens_IndiceEPorProdutoMarca()
    {
        var sql = Ler();

        Assert.Matches(@"CREATE INDEX \w+\s+ON venda_itens\(produto_marca_id\)", sql);
        Assert.DoesNotMatch(@"ON venda_itens\(produto_id\)", sql);
    }

    [Fact]
    public void MovimentosEstoqueCasco_TemVendaIdComReferenciaAVendas()
    {
        var sql = Ler();

        Assert.Matches(@"venda_id\s+UUID REFERENCES vendas\(id\)", Tabela(sql, "movimentos_estoque_casco"));
        Assert.Contains(
            "ALTER TABLE movimentos_estoque_casco ADD COLUMN IF NOT EXISTS venda_id UUID REFERENCES vendas(id);", sql);
    }

    [Fact]
    public void FormaPagamento_RotulosDoInitSqlSaoOsDoEnumCSharp()
    {
        var sql = Ler();

        var ini = sql.IndexOf("CREATE TYPE forma_pagamento AS ENUM", StringComparison.Ordinal);
        Assert.True(ini >= 0, "forma_pagamento deve ser um ENUM");
        var bloco = sql[ini..sql.IndexOf(';', ini)];

        var rotulos = Regex.Matches(bloco, "'([A-Z_]+)'").Select(m => m.Groups[1].Value).ToArray();
        Assert.Equal(Enum.GetNames<ControleEstoque.Vendas.Domain.FormaPagamento>(), rotulos);
    }

    [Fact]
    public void TipoLancamentoFiado_TemDebitoUsoCredito()
    {
        var sql = Ler();

        var ini = sql.IndexOf("CREATE TYPE tipo_lancamento_fiado AS ENUM", StringComparison.Ordinal);
        Assert.True(ini >= 0, "tipo_lancamento_fiado deve ser um ENUM");
        Assert.Contains("'DEBITO_USO_CREDITO'", sql[ini..sql.IndexOf(';', ini)]);
        Assert.Contains("ALTER TYPE tipo_lancamento_fiado ADD VALUE IF NOT EXISTS 'DEBITO_USO_CREDITO';", sql);
        Assert.Contains("ALTER TYPE forma_pagamento ADD VALUE IF NOT EXISTS 'CREDITO_CLIENTE';", sql);
    }

    [Fact]
    public void ViewSaldoFiado_SomaUsoDeCreditoComoDebitoETemSaldoComoUltimaColuna()
    {
        var sql = Ler();

        var ini = sql.IndexOf("VIEW vw_saldo_fiado_cliente AS", StringComparison.Ordinal);
        Assert.True(ini >= 0, "vw_saldo_fiado_cliente não encontrada");
        var view = sql[ini..sql.IndexOf(';', ini)];

        Assert.Matches(@"WHEN 'DEBITO_USO_CREDITO'\s+THEN\s+l\.valor", view);
        Assert.Contains("AS saldo_devedor", view);
        Assert.True(view.IndexOf("AS saldo\n", StringComparison.Ordinal) > view.IndexOf("AS saldo_devedor", StringComparison.Ordinal),
            "saldo deve ser a última coluna");
    }
}
