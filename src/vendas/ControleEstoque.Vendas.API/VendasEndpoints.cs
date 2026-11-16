using ControleEstoque.Shared.Results;
using ControleEstoque.Shared.Telemetry;
using ControleEstoque.Vendas.Contracts;
using ControleEstoque.Vendas.Domain;

namespace ControleEstoque.Vendas.API;

public static class VendasEndpoints
{
    public static WebApplication MapVendasEndpoints(this WebApplication app)
    {
        app.MapPost("/v1/vendas", async (
            CreateVendaRequest request, IVendaService vendas, CancellationToken cancellationToken) =>
        {
            var resultado = await vendas.CriarAsync(ToNovaVenda(request), cancellationToken);
            PlatformTelemetry.VendasRegistradasTotal.Add(1);
            return Results.Created($"/v1/vendas/{resultado.Id}", VendaResponse.From(resultado));
        });

        app.MapPut("/v1/vendas/{id:guid}", async (
            Guid id, CreateVendaRequest request, IVendaService vendas, CancellationToken cancellationToken) =>
        {
            var resultado = await vendas.EditarAsync(id, ToNovaVenda(request), cancellationToken);
            return Results.Ok(VendaResponse.From(resultado));
        });

        // Exige vendas.cancelar (ou *) do funcionário informado; só com o caixa do dia da venda aberto.
        app.MapPost("/v1/vendas/{id:guid}/cancelamento", async (
            Guid id, CancelarVendaRequest request, IVendaService vendas, CancellationToken cancellationToken) =>
        {
            await vendas.CancelarAsync(id, request.FuncionarioId, cancellationToken);
            return Results.NoContent();
        });

        app.MapGet("/v1/vendas/ultimo-preco", async (
            Guid? clienteId, Guid? produtoId, Guid? marcaId, IVendaService vendas,
            CancellationToken cancellationToken) =>
        {
            if (clienteId is null || produtoId is null || marcaId is null)
            {
                throw new RequestValidationException(
                    "PARAMETRO_OBRIGATORIO", "clienteId, produtoId e marcaId são obrigatórios.");
            }

            var ultimo = await vendas.ObterUltimoPrecoAsync(
                clienteId.Value, produtoId.Value, marcaId.Value, cancellationToken);
            return ultimo is null
                ? Results.NoContent()
                : Results.Ok(new UltimoPrecoResponse(ultimo.VendaId, ultimo.Data, ultimo.PrecoUnitario));
        });

        app.MapGet("/v1/vendas/{id:guid}", async (
            Guid id, IVendaService vendas, CancellationToken cancellationToken) =>
            Results.Ok(VendaDetalheResponse.From(await vendas.ObterAsync(id, cancellationToken))));

        app.MapGet("/v1/vendas", async (
            Guid? clienteId, DateOnly? inicio, DateOnly? fim, int? page, int? pageSize,
            IVendaService vendas, CancellationToken cancellationToken) =>
        {
            var lista = await vendas.ListarAsync(
                clienteId, inicio, fim, page ?? 1, pageSize ?? 50, cancellationToken);
            return Results.Ok(lista.Select(VendaDetalheResponse.From));
        });

        app.MapPost("/v1/vendas/{id:guid}/pagamentos", async (
            Guid id, AddPagamentoRequest request, IVendaService vendas, CancellationToken cancellationToken) =>
        {
            var resultado = await vendas.AdicionarPagamentoAsync(
                id, request.Forma, request.Valor, cancellationToken);
            return Results.Ok(VendaResponse.From(resultado));
        });

        app.MapPost("/v1/vendas/{id:guid}/cupom-fiscal", async (
            Guid id, IVendaService vendas, CancellationToken cancellationToken) =>
        {
            var cupom = await vendas.EmitirCupomAsync(id, cancellationToken);
            return Results.Created(
                $"/v1/vendas/{id}/cupom-fiscal",
                new CupomFiscalResponse(cupom.Id, cupom.Numero, cupom.EmitidoEm));
        });

        // ---- Relatórios -----------------------------------------------------
        app.MapGet("/v1/relatorios/faturamento", async (
            DateOnly? inicio, DateOnly? fim, Guid? produtoId,
            IRelatorioVendasRepository relatorios, CancellationToken cancellationToken) =>
        {
            Validacao.Periodo(inicio, fim);
            return Results.Ok(await relatorios.FaturamentoAsync(inicio, fim, produtoId, cancellationToken));
        });

        app.MapGet("/v1/relatorios/vendas-por-funcionario", async (
            DateOnly? inicio, DateOnly? fim,
            IRelatorioVendasRepository relatorios, CancellationToken cancellationToken) =>
        {
            Validacao.Periodo(inicio, fim);
            return Results.Ok(await relatorios.VendasPorFuncionarioAsync(inicio, fim, cancellationToken));
        });

        return app;
    }

    private static NovaVenda ToNovaVenda(CreateVendaRequest request) => new(
        request.ClienteId,
        request.FuncionarioId,
        request.EnderecoEntregaId,
        Validacao.SemNulos(request.Itens, "Itens").Select(i => new ItemVenda(
            i.ProdutoId, i.MarcaId, i.Quantidade, i.PrecoUnitario,
            i.Desconto is null ? null : new Desconto(
                i.Desconto.Tipo, i.Desconto.Valor, i.Desconto.Motivo ?? string.Empty))).ToList(),
        Validacao.SemNulos(request.Vasilhames, "Vasilhames").Select(v => new VasilhameVenda(
            v.TipoCascoId, v.Quantidade, v.PrecoUnitario, v.ModoCredito ?? ModoCreditoVasilhame.ABATER_CREDITO)).ToList(),
        Validacao.SemNulos(request.Pagamentos, "Pagamentos").Select(p => new PagamentoVenda(p.Forma, p.Valor)).ToList(),
        ToCascos(request.CascosDevolvidos, "CascosDevolvidos"),
        Validacao.SemNulos(request.SucataEntregue, "SucataEntregue")
            .Select(s => new SucataVenda(
                s.TipoCascoId, s.Quantidade,
                s.ValorUnitario ?? throw new RequestValidationException(
                    "SUCATA_INVALIDA", $"Sucata do tipo {s.TipoCascoId} exige valor unitário."))).ToList(),
        request.Observacao,
        request.CaixaId);

    private static List<CascoQuantidade> ToCascos(List<CascoQuantidadeRequest>? cascos, string campo) =>
        Validacao.SemNulos(cascos, campo).Select(c => new CascoQuantidade(c.TipoCascoId, c.Quantidade)).ToList();
}
