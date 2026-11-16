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

    public sealed class Fabrica : WebApplicationFactory<Program>
    {
        public FakeVendaRepository Vendas { get; } = new(new Dictionary<Guid, long>());
        internal FakeVendaLookup Lookup { get; } = new();

        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseSetting("Vendas:ConnectionString", "Host=invalido;Database=x");
            builder.ConfigureServices(services =>
            {
                services.RemoveAll<IRelatorioVendasRepository>();
                services.RemoveAll<IVendaRepository>();
                services.RemoveAll<IVendaLookup>();
                services.AddSingleton<IVendaLookup>(Lookup);
                services.AddSingleton<IRelatorioVendasRepository>(new RelatorioFalso());
                services.AddSingleton<IVendaRepository>(Vendas);
            });
        }

        private sealed class RelatorioFalso : IRelatorioVendasRepository
        {
            public Task<RelatorioFaturamento> FaturamentoAsync(
                DateOnly? inicio, DateOnly? fim, Guid? produtoId, CancellationToken cancellationToken) =>
                Task.FromResult(new RelatorioFaturamento(
                    100m, 0m, 100m, [], [new FaturamentoPorDia(Dia, 100m, 90m, 40m)], [], 90m, 40m));

            public Task<IReadOnlyList<VendasPorFuncionario>> VendasPorFuncionarioAsync(
                DateOnly? inicio, DateOnly? fim, CancellationToken cancellationToken) =>
                Task.FromResult<IReadOnlyList<VendasPorFuncionario>>([]);
        }
    }
}
