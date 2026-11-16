using System.Net;
using System.Text.Json;
using ControleEstoque.Vendas.Domain;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace ControleEstoque.Vendas.Tests;

public sealed class VendasApiTests : IClassFixture<VendasApiTests.Fabrica>
{
    private static readonly DateOnly Dia = new(2026, 11, 15);

    private readonly Fabrica fabrica;

    public VendasApiTests(Fabrica fabrica) => this.fabrica = fabrica;

    [Fact]
    public async Task FaturamentoDevolveRecebidoEFiadoGerado()
    {
        var resposta = await fabrica.CreateClient().GetAsync("/v1/relatorios/faturamento?inicio=2026-11-15&fim=2026-11-15");

        Assert.Equal(HttpStatusCode.OK, resposta.StatusCode);
        using var json = JsonDocument.Parse(await resposta.Content.ReadAsStringAsync());
        Assert.Equal(90m, json.RootElement.GetProperty("recebido").GetDecimal());
        Assert.Equal(40m, json.RootElement.GetProperty("fiadoGerado").GetDecimal());
        var dia = json.RootElement.GetProperty("porDia")[0];
        Assert.Equal(90m, dia.GetProperty("recebido").GetDecimal());
        Assert.Equal(40m, dia.GetProperty("fiadoGerado").GetDecimal());
    }

    [Fact]
    public async Task VendasPorFuncionarioDevolveOFormatoComTotaisEDetalhamento()
    {
        var resposta = await fabrica.CreateClient()
            .GetAsync("/v1/relatorios/vendas-por-funcionario?inicio=2026-11-01&fim=2026-11-15");

        Assert.Equal(HttpStatusCode.OK, resposta.StatusCode);
        using var json = JsonDocument.Parse(await resposta.Content.ReadAsStringAsync());
        var raiz = json.RootElement;
        Assert.Equal("2026-11-01", raiz.GetProperty("inicio").GetString());
        var totais = raiz.GetProperty("totais");
        Assert.Equal(1, totais.GetProperty("quantidadeVendas").GetInt32());
        Assert.Equal(0, totais.GetProperty("quantidadeEntregas").GetInt32());
        Assert.Equal(55m, totais.GetProperty("totalLiquido").GetDecimal());
        var ana = raiz.GetProperty("funcionarios")[0];
        Assert.Equal("Ana", ana.GetProperty("nome").GetString());
        Assert.Equal(0m, ana.GetProperty("descontoSucata").GetDecimal());
        var itens = ana.GetProperty("itens");
        Assert.Equal("PRODUTO", itens[0].GetProperty("tipo").GetString());
        Assert.Equal("Indaiá", itens[0].GetProperty("marcaNome").GetString());
        Assert.Equal("VASILHAME", itens[1].GetProperty("tipo").GetString());
        Assert.Equal("20L", itens[1].GetProperty("tipoCascoNome").GetString());
    }

    [Fact]
    public async Task FaturamentoComInicioDepoisDeFimRecusaPeriodo()
    {
        var resposta = await fabrica.CreateClient().GetAsync("/v1/relatorios/faturamento?inicio=2026-11-16&fim=2026-11-15");

        Assert.Equal(HttpStatusCode.BadRequest, resposta.StatusCode);
    }

    [Fact]
    public async Task ListagemPorClienteComPageSize1RepassaFiltro()
    {
        var clienteId = Guid.NewGuid();

        var resposta = await fabrica.CreateClient().GetAsync($"/v1/vendas?clienteId={clienteId}&pageSize=1");

        Assert.Equal(HttpStatusCode.OK, resposta.StatusCode);
        Assert.Equal((clienteId, 1), fabrica.Vendas.UltimaListagem);
    }

    [Fact]
    public async Task UltimoPrecoDevolve200ComOCorpoDaCompraMaisRecente()
    {
        var (clienteId, produtoId, marcaId) = (Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid());
        var compra = new UltimoPrecoVenda(Guid.NewGuid(), new DateTimeOffset(2026, 11, 15, 10, 0, 0, TimeSpan.Zero), 12.5m);
        fabrica.Vendas.Compras.Add((clienteId, produtoId, marcaId, compra, false));

        var resposta = await fabrica.CreateClient().GetAsync(
            $"/v1/vendas/ultimo-preco?clienteId={clienteId}&produtoId={produtoId}&marcaId={marcaId}");

        Assert.Equal(HttpStatusCode.OK, resposta.StatusCode);
        using var json = JsonDocument.Parse(await resposta.Content.ReadAsStringAsync());
        Assert.Equal(compra.VendaId, json.RootElement.GetProperty("vendaId").GetGuid());
        Assert.Equal(12.5m, json.RootElement.GetProperty("precoUnitario").GetDecimal());
        Assert.Equal(compra.Data, json.RootElement.GetProperty("data").GetDateTimeOffset());
    }

    [Fact]
    public async Task UltimoPrecoDevolve204QuandoNuncaComprou()
    {
        var resposta = await fabrica.CreateClient().GetAsync(
            $"/v1/vendas/ultimo-preco?clienteId={Guid.NewGuid()}&produtoId={Guid.NewGuid()}&marcaId={Guid.NewGuid()}");

        Assert.Equal(HttpStatusCode.NoContent, resposta.StatusCode);
    }

    [Fact]
    public async Task UltimoPrecoSemMarcaIdDevolve400()
    {
        var resposta = await fabrica.CreateClient().GetAsync(
            $"/v1/vendas/ultimo-preco?clienteId={Guid.NewGuid()}&produtoId={Guid.NewGuid()}");

        Assert.Equal(HttpStatusCode.BadRequest, resposta.StatusCode);
        using var json = JsonDocument.Parse(await resposta.Content.ReadAsStringAsync());
        Assert.Equal("PARAMETRO_OBRIGATORIO", json.RootElement.GetProperty("code").GetString());
    }

    [Fact]
    public async Task VendaComSucataSemValorUnitarioDevolve400SucataInvalida()
    {
        var corpo = $$"""
            {"clienteId":"{{Guid.NewGuid()}}","funcionarioId":"{{Guid.NewGuid()}}",
             "sucataEntregue":[{"tipoCascoId":"{{Guid.NewGuid()}}","quantidade":1}]}
            """;

        var resposta = await fabrica.CreateClient().PostAsync(
            "/v1/vendas", new StringContent(corpo, System.Text.Encoding.UTF8, "application/json"));

        Assert.Equal(HttpStatusCode.BadRequest, resposta.StatusCode);
        using var json = JsonDocument.Parse(await resposta.Content.ReadAsStringAsync());
        Assert.Equal("SUCATA_INVALIDA", json.RootElement.GetProperty("code").GetString());
    }

    [Fact]
    public async Task VendaComVasilhameSemModoCreditoAbateOCredito()
    {
        var clienteId = Guid.NewGuid();
        var tipo = fabrica.Lookup.AddTipoCasco(15m, aceitaSucata: false);
        fabrica.Lookup.Clientes.Add(clienteId);
        var funcionarioId = Guid.NewGuid();
        fabrica.Lookup.Funcionarios.Add(funcionarioId);
        fabrica.Lookup.CreditosCasco[(clienteId, tipo.Id)] = 1;
        var corpo = $$"""
            {"clienteId":"{{clienteId}}","funcionarioId":"{{funcionarioId}}",
             "vasilhames":[{"tipoCascoId":"{{tipo.Id}}","quantidade":1,"precoUnitario":15}]}
            """;

        var resposta = await fabrica.CreateClient().PostAsync(
            "/v1/vendas", new StringContent(corpo, System.Text.Encoding.UTF8, "application/json"));

        Assert.Equal(HttpStatusCode.Created, resposta.StatusCode);
        var vasilhame = Assert.Single(fabrica.Vendas.UltimaGravacao!.Vasilhames);
        Assert.Equal(ModoCreditoVasilhame.ABATER_CREDITO, vasilhame.Modo);
        Assert.Equal(1, vasilhame.QuantidadeAbatida);
    }

    private sealed record CenarioPedido(Guid ClienteId, Guid FuncionarioId, Guid EntregadorId, ProdutoVenda Produto);

    /// <summary>Cliente, funcionários e produto novos (a Fabrica é compartilhada entre os testes).</summary>
    private CenarioPedido NovoCenario(long saldo)
    {
        var cenario = new CenarioPedido(
            Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(),
            fabrica.Lookup.AddProduto(TipoProduto.DESCARTAVEL, "Carvão 5kg", saldo));
        fabrica.Lookup.Clientes.Add(cenario.ClienteId);
        fabrica.Lookup.Funcionarios.Add(cenario.FuncionarioId);
        fabrica.Lookup.Funcionarios.Add(cenario.EntregadorId);
        return cenario;
    }

    private static StringContent Json(string corpo) =>
        new(corpo, System.Text.Encoding.UTF8, "application/json");

    private async Task<Guid> CriarPedidoAsync(CenarioPedido c, int quantidade)
    {
        var resposta = await fabrica.CreateClient().PostAsync("/v1/pedidos", Json($$"""
            {"funcionarioId":"{{c.FuncionarioId}}","clienteId":"{{c.ClienteId}}",
             "itens":[{"produtoId":"{{c.Produto.ProdutoId}}","marcaId":"{{c.Produto.MarcaId}}",
                       "quantidade":{{quantidade}},"precoUnitario":8}]}
            """));
        Assert.Equal(HttpStatusCode.Created, resposta.StatusCode);
        using var json = JsonDocument.Parse(await resposta.Content.ReadAsStringAsync());
        return json.RootElement.GetProperty("id").GetGuid();
    }

    private static async Task<string?> CodigoAsync(HttpResponseMessage resposta)
    {
        using var json = JsonDocument.Parse(await resposta.Content.ReadAsStringAsync());
        return json.RootElement.GetProperty("code").GetString();
    }

    private Task<HttpResponseMessage> IniciarPedidoAsync(Guid id, CenarioPedido c, string funcionarios) =>
        fabrica.CreateClient().PostAsync($"/v1/pedidos/{id}/inicio", Json($$"""
            {"funcionarioId":"{{c.FuncionarioId}}","funcionariosIds":{{funcionarios}}}
            """));

    private Task<HttpResponseMessage> CancelarPedidoAsync(Guid id, CenarioPedido c) =>
        fabrica.CreateClient().PostAsync($"/v1/pedidos/{id}/cancelamento", Json($$"""
            {"funcionarioId":"{{c.FuncionarioId}}"}
            """));

    [Fact]
    public async Task PostPedidoCriaPendenteComItensEDevolve201()
    {
        var c = NovoCenario(10);

        var resposta = await fabrica.CreateClient().PostAsync("/v1/pedidos", Json($$"""
            {"funcionarioId":"{{c.FuncionarioId}}","clienteId":"{{c.ClienteId}}","observacao":"portão azul",
             "itens":[{"produtoId":"{{c.Produto.ProdutoId}}","marcaId":"{{c.Produto.MarcaId}}",
                       "quantidade":3,"precoUnitario":8}]}
            """));

        Assert.Equal(HttpStatusCode.Created, resposta.StatusCode);
        using var json = JsonDocument.Parse(await resposta.Content.ReadAsStringAsync());
        Assert.Equal("PENDENTE", json.RootElement.GetProperty("status").GetString());
        Assert.Equal(c.FuncionarioId, json.RootElement.GetProperty("createdBy").GetGuid());
        Assert.Equal(3, json.RootElement.GetProperty("itens")[0].GetProperty("quantidade").GetInt32());
        Assert.Equal(0, json.RootElement.GetProperty("funcionarios").GetArrayLength());
        Assert.Equal($"/v1/pedidos/{json.RootElement.GetProperty("id").GetGuid()}", resposta.Headers.Location!.ToString());
    }

    [Fact]
    public async Task PostPedidoSemItensDevolve400ItensObrigatorios()
    {
        var c = NovoCenario(10);

        var resposta = await fabrica.CreateClient().PostAsync("/v1/pedidos", Json($$"""
            {"funcionarioId":"{{c.FuncionarioId}}","clienteId":"{{c.ClienteId}}"}
            """));

        Assert.Equal(HttpStatusCode.BadRequest, resposta.StatusCode);
        Assert.Equal("ITENS_OBRIGATORIOS", await CodigoAsync(resposta));
    }

    [Fact]
    public async Task GetPedidosFiltraPorStatusEOrdenaDoMaisRecente()
    {
        var c = NovoCenario(10);
        var primeiro = await CriarPedidoAsync(c, 1);
        await Task.Delay(20); // created_at vem do relógio real: garante a ordem
        var segundo = await CriarPedidoAsync(c, 1);
        Assert.Equal(HttpStatusCode.OK, (await CancelarPedidoAsync(primeiro, c)).StatusCode);

        var todos = await Ids(await fabrica.CreateClient().GetAsync("/v1/pedidos?pageSize=200"));
        var cancelados = await Ids(await fabrica.CreateClient().GetAsync("/v1/pedidos?status=CANCELADO&pageSize=200"));

        Assert.True(todos.IndexOf(segundo) < todos.IndexOf(primeiro));
        Assert.Contains(primeiro, cancelados);
        Assert.DoesNotContain(segundo, cancelados);

        static async Task<List<Guid>> Ids(HttpResponseMessage r)
        {
            Assert.Equal(HttpStatusCode.OK, r.StatusCode);
            using var json = JsonDocument.Parse(await r.Content.ReadAsStringAsync());
            return json.RootElement.EnumerateArray().Select(p => p.GetProperty("id").GetGuid()).ToList();
        }
    }

    [Fact]
    public async Task GetPedidosComStatusDesconhecidoDevolve400()
    {
        var resposta = await fabrica.CreateClient().GetAsync("/v1/pedidos?status=VOANDO");

        Assert.Equal(HttpStatusCode.BadRequest, resposta.StatusCode);
        Assert.Equal("VALOR_ENUM_INVALIDO", await CodigoAsync(resposta));
    }

    [Fact]
    public async Task GetPedidoInexistenteDevolve404PedidoNaoEncontrado()
    {
        var resposta = await fabrica.CreateClient().GetAsync($"/v1/pedidos/{Guid.NewGuid()}");

        Assert.Equal(HttpStatusCode.NotFound, resposta.StatusCode);
        Assert.Equal("PEDIDO_NAO_ENCONTRADO", await CodigoAsync(resposta));
    }

    [Fact]
    public async Task GetPedidoDevolveItensEFuncionariosComNome()
    {
        var c = NovoCenario(10);
        var id = await CriarPedidoAsync(c, 2);
        await IniciarPedidoAsync(id, c, $"[\"{c.EntregadorId}\"]");

        var resposta = await fabrica.CreateClient().GetAsync($"/v1/pedidos/{id}");

        Assert.Equal(HttpStatusCode.OK, resposta.StatusCode);
        using var json = JsonDocument.Parse(await resposta.Content.ReadAsStringAsync());
        Assert.Equal("EM_ANDAMENTO", json.RootElement.GetProperty("status").GetString());
        Assert.Equal(c.EntregadorId, json.RootElement.GetProperty("funcionarios")[0].GetProperty("id").GetGuid());
        Assert.False(string.IsNullOrEmpty(json.RootElement.GetProperty("funcionarios")[0].GetProperty("nome").GetString()));
    }

    [Fact]
    public async Task InicioDevolve200ReservaEFalha409AoRepetir()
    {
        var c = NovoCenario(10);
        var id = await CriarPedidoAsync(c, 6);

        var iniciado = await IniciarPedidoAsync(id, c, $"[\"{c.EntregadorId}\"]");
        var repetido = await IniciarPedidoAsync(id, c, $"[\"{c.EntregadorId}\"]");

        Assert.Equal(HttpStatusCode.OK, iniciado.StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, repetido.StatusCode);
        Assert.Equal("PEDIDO_STATUS_INVALIDO", await CodigoAsync(repetido));
        Assert.Equal(6, fabrica.Vendas.Reservas[c.Produto.ProdutoMarcaId]);
    }

    [Fact]
    public async Task InicioSemFuncionariosDevolve422FuncionariosObrigatorios()
    {
        var c = NovoCenario(10);
        var id = await CriarPedidoAsync(c, 1);

        var resposta = await IniciarPedidoAsync(id, c, "[]");

        Assert.Equal(HttpStatusCode.UnprocessableEntity, resposta.StatusCode);
        Assert.Equal("FUNCIONARIOS_OBRIGATORIOS", await CodigoAsync(resposta));
    }

    [Fact]
    public async Task InicioComReservaDeOutroPedidoDevolve422EstoqueInsuficiente()
    {
        var c = NovoCenario(10);
        var a = await CriarPedidoAsync(c, 6);
        var b = await CriarPedidoAsync(c, 5);
        Assert.Equal(HttpStatusCode.OK, (await IniciarPedidoAsync(a, c, $"[\"{c.EntregadorId}\"]")).StatusCode);

        var resposta = await IniciarPedidoAsync(b, c, $"[\"{c.EntregadorId}\"]");

        Assert.Equal(HttpStatusCode.UnprocessableEntity, resposta.StatusCode);
        Assert.Equal("ESTOQUE_INSUFICIENTE", await CodigoAsync(resposta));
    }

    [Fact]
    public async Task CancelamentoDevolve200LiberaAReservaEFalha409AoRepetir()
    {
        var c = NovoCenario(10);
        var id = await CriarPedidoAsync(c, 6);
        await IniciarPedidoAsync(id, c, $"[\"{c.EntregadorId}\"]");

        var cancelado = await CancelarPedidoAsync(id, c);
        var repetido = await CancelarPedidoAsync(id, c);

        Assert.Equal(HttpStatusCode.OK, cancelado.StatusCode);
        using var json = JsonDocument.Parse(await cancelado.Content.ReadAsStringAsync());
        Assert.Equal("CANCELADO", json.RootElement.GetProperty("status").GetString());
        Assert.Equal(c.FuncionarioId, json.RootElement.GetProperty("canceladoPor").GetGuid());
        Assert.Equal(0, fabrica.Vendas.Reservas[c.Produto.ProdutoMarcaId]);
        Assert.Equal(HttpStatusCode.Conflict, repetido.StatusCode);
        Assert.Equal("PEDIDO_STATUS_INVALIDO", await CodigoAsync(repetido));
    }

    private Task<HttpResponseMessage> ConcluirPedidoAsync(Guid id, CenarioPedido c, int quantidade, decimal pago) =>
        fabrica.CreateClient().PostAsync($"/v1/pedidos/{id}/conclusao", Json($$"""
            {"funcionarioId":"{{c.FuncionarioId}}",
             "itens":[{"produtoId":"{{c.Produto.ProdutoId}}","marcaId":"{{c.Produto.MarcaId}}",
                       "quantidade":{{quantidade}},"precoUnitario":8}],
             "pagamentos":[{"forma":"PIX","valor":{{pago}}}]}
            """));

    private async Task<JsonElement> LerPedidoAsync(Guid id)
    {
        var resposta = await fabrica.CreateClient().GetAsync($"/v1/pedidos/{id}");
        return JsonDocument.Parse(await resposta.Content.ReadAsStringAsync()).RootElement;
    }

    [Fact]
    public async Task PostConclusaoViraVendaDevolve201EOPedidoTrazVendaId()
    {
        var c = NovoCenario(10);
        var id = await CriarPedidoAsync(c, 3);
        Assert.Equal(JsonValueKind.Null, (await LerPedidoAsync(id)).GetProperty("vendaId").ValueKind);
        await IniciarPedidoAsync(id, c, $"[\"{c.EntregadorId}\"]");
        Assert.Equal(JsonValueKind.Null, (await LerPedidoAsync(id)).GetProperty("vendaId").ValueKind);

        var resposta = await ConcluirPedidoAsync(id, c, 2, 16);

        Assert.Equal(HttpStatusCode.Created, resposta.StatusCode);
        using var venda = JsonDocument.Parse(await resposta.Content.ReadAsStringAsync());
        var vendaId = venda.RootElement.GetProperty("id").GetGuid();
        Assert.Equal($"/v1/vendas/{vendaId}", resposta.Headers.Location!.ToString());
        Assert.Equal(16m, venda.RootElement.GetProperty("totalPago").GetDecimal());
        var pedido = await LerPedidoAsync(id);
        Assert.Equal("CONCLUIDO", pedido.GetProperty("status").GetString());
        Assert.Equal(vendaId, pedido.GetProperty("vendaId").GetGuid());
        Assert.Equal(c.EntregadorId, pedido.GetProperty("funcionarios")[0].GetProperty("id").GetGuid());
        Assert.Equal(8, fabrica.Lookup.SaldosEstoque[c.Produto.ProdutoMarcaId]);
        Assert.Equal(0, fabrica.Vendas.Reservas[c.Produto.ProdutoMarcaId]);
    }

    [Fact]
    public async Task PostConclusaoDePendenteOuJaConcluidoDevolve409PedidoStatusInvalido()
    {
        var c = NovoCenario(10);
        var pendente = await CriarPedidoAsync(c, 1);
        var concluido = await CriarPedidoAsync(c, 1);
        await IniciarPedidoAsync(concluido, c, $"[\"{c.EntregadorId}\"]");
        await ConcluirPedidoAsync(concluido, c, 1, 8);

        var daPendente = await ConcluirPedidoAsync(pendente, c, 1, 8);
        var repetida = await ConcluirPedidoAsync(concluido, c, 1, 8);

        Assert.Equal(HttpStatusCode.Conflict, daPendente.StatusCode);
        Assert.Equal("PEDIDO_STATUS_INVALIDO", await CodigoAsync(daPendente));
        Assert.Equal(HttpStatusCode.Conflict, repetida.StatusCode);
        Assert.Equal("PEDIDO_STATUS_INVALIDO", await CodigoAsync(repetida));
    }

    [Fact]
    public async Task PostConclusaoDePedidoInexistenteDevolve404PedidoNaoEncontrado()
    {
        var c = NovoCenario(10);

        var resposta = await ConcluirPedidoAsync(Guid.NewGuid(), c, 1, 8);

        Assert.Equal(HttpStatusCode.NotFound, resposta.StatusCode);
        Assert.Equal("PEDIDO_NAO_ENCONTRADO", await CodigoAsync(resposta));
    }

    [Fact]
    public async Task PostConclusaoSemItensDevolve400ItensObrigatorios()
    {
        var c = NovoCenario(10);
        var id = await CriarPedidoAsync(c, 1);
        await IniciarPedidoAsync(id, c, $"[\"{c.EntregadorId}\"]");

        var resposta = await fabrica.CreateClient().PostAsync($"/v1/pedidos/{id}/conclusao", Json($$"""
            {"funcionarioId":"{{c.FuncionarioId}}"}
            """));

        Assert.Equal(HttpStatusCode.BadRequest, resposta.StatusCode);
        Assert.Equal("ITENS_OBRIGATORIOS", await CodigoAsync(resposta));
    }

    private async Task<HttpResponseMessage> PerdasAsync(Guid pedidoId, CenarioPedido c, string ocorrencias) =>
        await fabrica.CreateClient().PostAsync(
            $"/v1/pedidos/{pedidoId}/perdas",
            Json($$"""{"funcionarioId":"{{c.FuncionarioId}}","ocorrencias":{{ocorrencias}}}"""));

    [Fact]
    public async Task PerdasDevolve200ComAsPerdasNoCorpo()
    {
        var c = NovoCenario(10);
        var id = await CriarPedidoAsync(c, 2);
        await IniciarPedidoAsync(id, c, $"[\"{c.EntregadorId}\"]");
        fabrica.Pedidos.ForcarStatus(id, StatusPedido.CONCLUIDO);
        var tipo = fabrica.Lookup.AddTipoCasco(10m, aceitaSucata: true);
        var retornavel = fabrica.Lookup.AddProduto(TipoProduto.RETORNAVEL, "Água 20L", 5, tipoCascoProduto: tipo.Id);

        var resposta = await PerdasAsync(id, c, $$"""
            [{"galao":"CHEIO","produtoId":"{{retornavel.ProdutoId}}","marcaId":"{{retornavel.MarcaId}}",
              "quantidade":1,"motivo":"QUEBRADO"}]
            """);

        Assert.Equal(HttpStatusCode.OK, resposta.StatusCode);
        using var json = JsonDocument.Parse(await resposta.Content.ReadAsStringAsync());
        var perda = json.RootElement.GetProperty("perdas")[0];
        Assert.Equal("CHEIO", perda.GetProperty("galao").GetString());
        Assert.Equal("QUEBRADO", perda.GetProperty("motivo").GetString());
        Assert.Equal(1, perda.GetProperty("quantidade").GetInt32());
        Assert.Equal(tipo.Id, perda.GetProperty("tipoCascoId").GetGuid());
        Assert.Equal(4, fabrica.Lookup.SaldosEstoque[retornavel.ProdutoMarcaId]);
    }

    [Fact]
    public async Task PerdasPedidoInexistenteDevolve404()
    {
        var resposta = await PerdasAsync(
            Guid.NewGuid(), NovoCenario(1),
            $$"""[{"galao":"VAZIO","tipoCascoId":"{{Guid.NewGuid()}}","quantidade":1,"motivo":"PERDIDO"}]""");

        Assert.Equal(HttpStatusCode.NotFound, resposta.StatusCode);
        Assert.Equal("PEDIDO_NAO_ENCONTRADO", await CodigoAsync(resposta));
    }

    [Fact]
    public async Task PerdasPedidoNaoConcluidoDevolve409()
    {
        var c = NovoCenario(10);
        var id = await CriarPedidoAsync(c, 1);

        var resposta = await PerdasAsync(
            id, c, $$"""[{"galao":"VAZIO","tipoCascoId":"{{Guid.NewGuid()}}","quantidade":1,"motivo":"PERDIDO"}]""");

        Assert.Equal(HttpStatusCode.Conflict, resposta.StatusCode);
        Assert.Equal("PEDIDO_STATUS_INVALIDO", await CodigoAsync(resposta));
    }

    public sealed class Fabrica : WebApplicationFactory<Program>
    {
        internal FakeVendaLookup Lookup { get; } = new();
        public FakeVendaRepository Vendas { get; }
        internal FakePedidoRepository Pedidos { get; }

        public Fabrica()
        {
            Vendas = new FakeVendaRepository(Lookup.SaldosEstoque);
            Pedidos = new FakePedidoRepository(Lookup.SaldosEstoque, Vendas.Reservas);
            Vendas.Pedidos = Pedidos;
        }

        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseSetting("Vendas:ConnectionString", "Host=invalido;Database=x");
            builder.ConfigureServices(services =>
            {
                services.RemoveAll<IRelatorioVendasRepository>();
                services.RemoveAll<IVendaRepository>();
                services.RemoveAll<IPedidoRepository>();
                services.RemoveAll<IVendaLookup>();
                services.AddSingleton<IVendaLookup>(Lookup);
                services.AddSingleton<IRelatorioVendasRepository>(new RelatorioFalso());
                services.AddSingleton<IVendaRepository>(Vendas);
                services.AddSingleton<IPedidoRepository>(Pedidos);
            });
        }

        private sealed class RelatorioFalso : IRelatorioVendasRepository
        {
            private static readonly VendaParaRelatorio VendaBalcao = new(
                Guid.NewGuid(), new FuncionarioRelatorio(Guid.NewGuid(), "Ana"), false, [], 55m, 0m,
                [new ItemVendaRelatorio(Guid.NewGuid(), "Água 20L", Guid.NewGuid(), "Indaiá", 2, 30m)],
                [new VasilhameVendaRelatorio(Guid.NewGuid(), "20L", 1, 25m)]);

            public Task<RelatorioFaturamento> FaturamentoAsync(
                DateOnly? inicio, DateOnly? fim, Guid? produtoId, CancellationToken cancellationToken) =>
                Task.FromResult(new RelatorioFaturamento(
                    100m, 0m, 100m, [], [new FaturamentoPorDia(Dia, 100m, 90m, 40m)], [], 90m, 40m));

            public Task<RelatorioVendasPorFuncionario> VendasPorFuncionarioAsync(
                DateOnly? inicio, DateOnly? fim, CancellationToken cancellationToken) =>
                Task.FromResult(VendasPorFuncionarioAgrupado.Montar(inicio, fim, [VendaBalcao]));
        }
    }
}
