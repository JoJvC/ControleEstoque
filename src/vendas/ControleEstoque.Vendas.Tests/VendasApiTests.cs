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

    public sealed class Fabrica : WebApplicationFactory<Program>
    {
        public FakeVendaRepository Vendas { get; } = new(new Dictionary<Guid, long>());

        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseSetting("Vendas:ConnectionString", "Host=invalido;Database=x");
            builder.ConfigureServices(services =>
            {
                services.RemoveAll<IRelatorioVendasRepository>();
                services.RemoveAll<IVendaRepository>();
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
