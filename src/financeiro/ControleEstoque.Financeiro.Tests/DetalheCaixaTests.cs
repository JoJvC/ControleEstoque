using ControleEstoque.Financeiro.Domain;
using ControleEstoque.Shared.Results;

namespace ControleEstoque.Financeiro.Tests;

public sealed class DetalheCaixaTests
{
    private static readonly TimeSpan Sp = TimeSpan.FromHours(-3);
    private static readonly DateOnly Hoje = new(2026, 11, 16);
    private static readonly DateOnly Ontem = new(2026, 11, 15);

    private readonly FakeCaixaRepository caixas = new();
    private readonly FakeTipoDespesaRepository tipos = new();

    private static DateTimeOffset Em(int dia, int h, int m = 0) => new(2026, 11, dia, h, m, 0, Sp);

    private CaixaService Servico(DateTimeOffset? agora = null) =>
        new(caixas, tipos, new FakePermissaoLookup(), new RelogioFixo(agora ?? Em(16, 15)));

    /// <summary>Exemplo da spec: saldo 50; V1 30 DINHEIRO + 20 PIX; V2 a fiado; fiado 40 DINHEIRO; despesa 15; diária 60.</summary>
    private Caixa CenarioDaSpec(DateOnly data, StatusCaixa status = StatusCaixa.ABERTO)
    {
        var caixa = caixas.AddCaixa(data, 50m, status);
        caixas.AddEntrada(FormaPagamento.DINHEIRO, 30m, hora: Em(16, 9), cliente: "Ana");
        caixas.AddEntrada(FormaPagamento.PIX, 20m, hora: Em(16, 9), cliente: "Ana");
        caixas.AddEntrada(FormaPagamento.DINHEIRO, 40m, OrigemEntrada.RECEBIMENTO_FIADO, "Bia", Em(16, 11));
        caixas.AddDespesa(caixa.Id, 15m, "gelo", Em(16, 10));
        caixas.DiariasDoCaixa.Add(new DiariaLancada(Guid.NewGuid(), "Zé", 60m, Em(16, 18)));
        return caixa;
    }

    [Fact]
    public async Task CaixaAbertoDeHoje_TraEntradasSaidasTotaisGavetaESemFechamento()
    {
        var caixa = CenarioDaSpec(Hoje);
        var abriu = new PessoaCaixa(Guid.NewGuid(), "Caio");
        caixas.Auditorias[caixa.Id] = new AuditoriaCaixa(abriu, Em(16, 8), null);

        var d = await Servico().ObterDetalheAsync(caixa.Id, CancellationToken.None);

        Assert.Equal(
            [("Ana", OrigemEntrada.VENDA, FormaPagamento.DINHEIRO, 30m), ("Ana", OrigemEntrada.VENDA, FormaPagamento.PIX, 20m),
             ("Bia", OrigemEntrada.RECEBIMENTO_FIADO, FormaPagamento.DINHEIRO, 40m)],
            d.Entradas.Select(e => (e.ClienteNome, e.Origem, e.Forma, e.Valor)));
        var saida = Assert.Single(d.Saidas);
        Assert.Equal(("Teste - gelo", FormaPagamento.DINHEIRO, 15m), (saida.Descricao, saida.Forma, saida.Valor));
        Assert.Equal(
            [(FormaPagamento.PIX, 20m), (FormaPagamento.DINHEIRO, 70m)],
            d.TotaisPorForma.Select(t => (t.Forma, t.Valor)).OrderBy(t => t.Forma == FormaPagamento.DINHEIRO));
        Assert.Equal((90m, 15m, 125m, 105m),
            (d.Totais.Entradas, d.Totais.Saidas, d.Totais.SaldoFinal, d.Totais.DinheiroNaGaveta));
        Assert.Equal(60m, Assert.Single(d.Diarias).Valor);
        Assert.Equal(abriu, d.Auditoria.AbertoPor);
        Assert.Equal(StatusCaixa.ABERTO, d.Caixa.Status);
    }

    [Fact]
    public async Task CaixaFechadoDeDiaAnterior_MostraGravadosEFechamentoComQuem()
    {
        var caixa = CenarioDaSpec(Ontem, StatusCaixa.FECHADO);
        var fechou = new PessoaCaixa(Guid.NewGuid(), "Dani");
        caixas.Auditorias[caixa.Id] = new AuditoriaCaixa(null, Em(15, 8), fechou);
        var fechado = caixa with { TotalEntradas = 90m, TotalSaidas = 15m, SaldoFinal = 125m, FechadoEm = Em(15, 20) };
        caixas.Substituir(fechado);

        var d = await Servico().ObterDetalheAsync(caixa.Id, CancellationToken.None);

        Assert.Equal((90m, 15m, 125m, 105m),
            (d.Totais.Entradas, d.Totais.Saidas, d.Totais.SaldoFinal, d.Totais.DinheiroNaGaveta));
        Assert.Equal(StatusCaixa.FECHADO, d.Caixa.Status);
        Assert.Equal(Em(15, 20), d.Caixa.FechadoEm);
        Assert.False(d.Caixa.FechadoPeloSistema);
        Assert.Equal(fechou, d.Auditoria.FechadoPor);
    }

    [Fact]
    public async Task VendaPagaEmDuasFormas_ViraDuasEntradas()
    {
        var caixa = caixas.AddCaixa(Hoje, 0m);
        caixas.AddEntrada(FormaPagamento.DINHEIRO, 30m);
        caixas.AddEntrada(FormaPagamento.CARTAO_DEBITO, 20m);

        var d = await Servico().ObterDetalheAsync(caixa.Id, CancellationToken.None);

        Assert.Equal(2, d.Entradas.Count);
    }

    [Fact]
    public async Task VendaAFiadoNaoEEntrada_ERecebimentoDoFiadoE_ComASuaForma()
    {
        var caixa = caixas.AddCaixa(Hoje, 0m);
        // A venda a fiado não gera linha de pagamento: só o recebimento aparece.
        caixas.AddEntrada(FormaPagamento.PIX, 40m, OrigemEntrada.RECEBIMENTO_FIADO, "Bia");

        var d = await Servico().ObterDetalheAsync(caixa.Id, CancellationToken.None);

        var e = Assert.Single(d.Entradas);
        Assert.Equal((OrigemEntrada.RECEBIMENTO_FIADO, FormaPagamento.PIX, 40m), (e.Origem, e.Forma, e.Valor));
    }

    [Fact]
    public void Gaveta_ContaSoDinheiro_DespesaReduz_DiariaNaoReduz()
    {
        EntradaCaixa E(FormaPagamento f, decimal v) => new(default, OrigemEntrada.VENDA, Guid.Empty, "c", f, v);
        var entradas = new[]
        {
            E(FormaPagamento.DINHEIRO, 70m), E(FormaPagamento.PIX, 10m), E(FormaPagamento.CARTAO_CREDITO, 10m),
            E(FormaPagamento.CARTAO_DEBITO, 10m), E(FormaPagamento.OUTRO, 10m), E(FormaPagamento.CREDITO_CLIENTE, 10m)
        };

        Assert.Equal(105m, GavetaCaixa.DinheiroEsperado(50m, entradas, 15m)); // diária (60) nem é parâmetro
        Assert.Equal(50m, GavetaCaixa.DinheiroEsperado(50m, entradas.Skip(1), 0m));
    }

    [Fact]
    public async Task FechamentoManualEDoSistema_DevolvemAMesmaGavetaDoDetalhe()
    {
        var manual = CenarioDaSpec(Ontem);
        var servico = Servico();
        var r = await servico.FecharAsync(manual.Id, [], CancellationToken.None);
        var detalhe = await servico.ObterDetalheAsync(manual.Id, CancellationToken.None);
        Assert.Equal(105m, r.DinheiroNaGaveta);
        Assert.Equal(detalhe.Totais.DinheiroNaGaveta, r.DinheiroNaGaveta);

        var outro = new FakeCaixaRepository();
        var vencido = outro.AddCaixa(Ontem, 50m);
        outro.AddEntrada(FormaPagamento.DINHEIRO, 70m);
        outro.AddEntrada(FormaPagamento.PIX, 20m);
        outro.AddDespesa(vencido.Id, 15m);
        var doSistema = await outro.FecharPeloSistemaAsync(vencido.Id, Em(16, 0), CancellationToken.None);
        var detalheSistema = await new CaixaService(outro, tipos, new FakePermissaoLookup(), new RelogioFixo(Em(16, 1)))
            .ObterDetalheAsync(vencido.Id, CancellationToken.None);
        Assert.Equal(detalheSistema.Totais.DinheiroNaGaveta, doSistema!.DinheiroNaGaveta);
    }

    [Fact]
    public async Task CaixaVencido_LidoPeloDetalheOuPelaLista_AparecaFechadoPeloSistemaComDiariasPendentes()
    {
        var caixa = caixas.AddCaixa(Ontem, 10m);
        var servico = Servico(Em(16, 0));

        var d = await servico.ObterDetalheAsync(caixa.Id, CancellationToken.None);

        Assert.Equal(StatusCaixa.FECHADO, d.Caixa.Status);
        Assert.True(d.Caixa.FechadoPeloSistema);
        Assert.True(d.Caixa.DiariasPendentes);
        Assert.Null(d.Auditoria.FechadoPor);

        var outro = new FakeCaixaRepository();
        outro.AddCaixa(Ontem, 10m);
        var lista = await new CaixaService(outro, tipos, new FakePermissaoLookup(), new RelogioFixo(Em(16, 0)))
            .ListarAsync(Ontem, Ontem, CancellationToken.None);
        var item = Assert.Single(lista);
        Assert.True(item.Caixa.FechadoPeloSistema);
        Assert.True(item.Caixa.DiariasPendentes);
    }

    [Fact]
    public async Task Lista_VemEmDataDecrescente_UmDiaComInicioIgualFim_EInicioMaiorQueFimDaErro()
    {
        caixas.AddCaixa(new DateOnly(2026, 11, 14), 1m, StatusCaixa.FECHADO);
        caixas.AddCaixa(Hoje, 2m);
        caixas.AddCaixa(Ontem, 3m, StatusCaixa.FECHADO);
        var servico = Servico();

        var lista = await servico.ListarAsync(new DateOnly(2026, 11, 14), Hoje, CancellationToken.None);
        Assert.Equal([Hoje, Ontem, new DateOnly(2026, 11, 14)], lista.Select(i => i.Caixa.Data));

        var umDia = await servico.ListarAsync(Ontem, Ontem, CancellationToken.None);
        Assert.Equal(Ontem, Assert.Single(umDia).Caixa.Data);

        var e = await Assert.ThrowsAsync<RequestValidationException>(
            () => servico.ListarAsync(Hoje, Ontem, CancellationToken.None));
        Assert.Equal("PERIODO_INVALIDO", e.Code);
    }

    [Fact]
    public async Task DetalheDeIdInexistente_DaCaixaNaoEncontrado()
    {
        var e = await Assert.ThrowsAsync<EntityNotFoundException>(
            () => Servico().ObterDetalheAsync(Guid.NewGuid(), CancellationToken.None));
        Assert.Equal("CAIXA_NAO_ENCONTRADO", e.Code);
    }
}
