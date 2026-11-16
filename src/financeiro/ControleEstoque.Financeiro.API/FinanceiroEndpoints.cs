using ControleEstoque.Financeiro.Contracts;
using ControleEstoque.Financeiro.Domain;
using ControleEstoque.Shared.Results;

namespace ControleEstoque.Financeiro.API;

public static class FinanceiroEndpoints
{
    public static WebApplication MapFinanceiroEndpoints(this WebApplication app)
    {
        // ---- Caixa ----------------------------------------------------------
        app.MapPost("/v1/caixas", async (
            AbrirCaixaRequest request, ICaixaService caixas, CancellationToken cancellationToken) =>
        {
            var caixa = await caixas.AbrirAsync(request.Data, request.SaldoInicial, cancellationToken);
            return Results.Created($"/v1/caixas/{caixa.Data:yyyy-MM-dd}", CaixaResponse.From(caixa));
        });

        app.MapGet("/v1/caixas/{data}", async (
            DateOnly data, ICaixaService caixas, CancellationToken cancellationToken) =>
            Results.Ok(ResumoCaixaResponse.From(await caixas.ObterResumoAsync(data, cancellationToken))));

        // Leitura, sem checagem de permissão como o resto do caixa (ver REGRAS_DE_NEGOCIO.md 3.5).
        app.MapGet("/v1/caixas", async (
            DateOnly? inicio, DateOnly? fim, ICaixaService caixas, CancellationToken cancellationToken) =>
        {
            if (inicio is null || fim is null)
            {
                throw new RequestValidationException("PERIODO_OBRIGATORIO", "Informe inicio e fim (AAAA-MM-DD).");
            }

            var itens = await caixas.ListarAsync(inicio.Value, fim.Value, cancellationToken);
            return Results.Ok(itens.Select(ItemListaCaixaResponse.From).ToList());
        });

        app.MapGet("/v1/caixas/{id:guid}/detalhe", async (
            Guid id, ICaixaService caixas, CancellationToken cancellationToken) =>
            Results.Ok(DetalheCaixaResponse.From(await caixas.ObterDetalheAsync(id, cancellationToken))));

        app.MapPost("/v1/caixas/{id:guid}/despesas", async (
            Guid id, CreateDespesaRequest request, ICaixaService caixas, CancellationToken cancellationToken) =>
        {
            await caixas.AdicionarDespesaAsync(
                id, request.TipoDespesaId, request.Valor, request.Descricao, cancellationToken);
            return Results.Created($"/v1/caixas/{id}/despesas", null);
        });

        app.MapPost("/v1/caixas/{id:guid}/fechamento", async (
            Guid id, FecharCaixaRequest request, ICaixaService caixas, CancellationToken cancellationToken) =>
        {
            var funcionarios = Validacao.SemNulos(request.Diarias, "Diarias")
                .Select(d => new DiariaFechamento(d.FuncionarioId, d.Valor)).ToList();
            var resultado = await caixas.FecharAsync(id, funcionarios, cancellationToken);
            return Results.Ok(new FechamentoResponse(
                resultado.CaixaId, resultado.Data, resultado.TotalEntradas,
                resultado.TotalSaidas, resultado.SaldoFinal, resultado.DiariasLancadas, resultado.DinheiroNaGaveta));
        });

        // Lança depois as diárias de um caixa fechado pelo sistema, com a data do caixa; não o reabre.
        // Como o fechamento manual, não checa permissão (ver REGRAS_DE_NEGOCIO.md 3.5).
        app.MapPost("/v1/caixas/{id:guid}/diarias", async (
            Guid id, LancarDiariasRequest request, ICaixaService caixas, CancellationToken cancellationToken) =>
        {
            var funcionarios = Validacao.SemNulos(request.Diarias, "Diarias")
                .Select(d => new DiariaFechamento(d.FuncionarioId, d.Valor)).ToList();
            var resultado = await caixas.LancarDiariasPendentesAsync(id, funcionarios, cancellationToken);
            return Results.Ok(new LancamentoDiariasResponse(
                resultado.CaixaId, resultado.Data, resultado.DiariasLancadas));
        });

        // ---- Tipos de despesa -------------------------------------------------
        app.MapPost("/v1/tipos-despesa", async (
            CreateTipoDespesaRequest request, ITipoDespesaRepository tipos,
            CancellationToken cancellationToken) =>
        {
            if (string.IsNullOrWhiteSpace(request.Nome))
            {
                throw new RequestValidationException("NOME_OBRIGATORIO", "Nome do tipo de despesa é obrigatório.");
            }

            var tipo = await tipos.CreateAsync(request.Nome.Trim(), cancellationToken);
            return Results.Created($"/v1/tipos-despesa/{tipo.Id}", new TipoDespesaResponse(tipo.Id, tipo.Nome));
        });

        app.MapGet("/v1/tipos-despesa", async (
            ITipoDespesaRepository tipos, CancellationToken cancellationToken) =>
        {
            var lista = await tipos.ListAsync(cancellationToken);
            return Results.Ok(lista.Select(t => new TipoDespesaResponse(t.Id, t.Nome)));
        });

        // ---- Fiado ------------------------------------------------------------
        app.MapPost("/v1/clientes/{id:guid}/fiado/pagamentos", async (
            Guid id, PagamentoFiadoRequest request, IFiadoService fiado,
            CancellationToken cancellationToken) =>
        {
            var resultado = await fiado.PagarAsync(id, request.Valor, request.Forma, cancellationToken);
            return Results.Ok(new PagamentoFiadoResponse(
                resultado.NovoSaldoDevedor,
                0m - resultado.NovoSaldoDevedor,
                resultado.Abatimentos
                    .Select(a => new VendaAbatidaResponse(
                        a.VendaId, a.Data, a.ValorAbatido, a.NovoStatus.ToString(), a.Restante))
                    .ToList(),
                resultado.ValorEmCredito));
        });

        // ---- Relatórios ---------------------------------------------------------
        app.MapGet("/v1/relatorios/caixa", async (
            DateOnly? inicio, DateOnly? fim, IRelatorioCaixaRepository relatorios,
            CancellationToken cancellationToken) =>
        {
            Validacao.Periodo(inicio, fim);
            return Results.Ok(await relatorios.CaixaPorPeriodoAsync(inicio, fim, cancellationToken));
        });

        app.MapGet("/v1/relatorios/fiado", async (
            IFiadoRepository fiado, CancellationToken cancellationToken) =>
            Results.Ok(await fiado.ListSaldosDevedoresAsync(cancellationToken)));

        app.MapGet("/v1/relatorios/fiado/total", async (
            IFiadoRepository fiado, CancellationToken cancellationToken) =>
        {
            var saldos = await fiado.ListSaldosDevedoresAsync(cancellationToken);
            return Results.Ok(new TotalFiadoResponse(SaldoCliente.FiadoAReceber(saldos.Select(s => s.Saldo))));
        });

        return app;
    }
}
