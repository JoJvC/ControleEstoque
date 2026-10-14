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
            var funcionarios = (request.Diarias ?? []).Select(d => d.FuncionarioId).ToList();
            var resultado = await caixas.FecharAsync(id, funcionarios, cancellationToken);
            return Results.Ok(new FechamentoResponse(
                resultado.CaixaId, resultado.Data, resultado.TotalEntradas,
                resultado.TotalSaidas, resultado.SaldoFinal, resultado.DiariasLancadas));
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
            var novoSaldo = await fiado.PagarAsync(id, request.Valor, request.Forma, cancellationToken);
            return Results.Ok(new PagamentoFiadoResponse(novoSaldo));
        });

        // ---- Relatórios ---------------------------------------------------------
        app.MapGet("/v1/relatorios/caixa", async (
            DateOnly? inicio, DateOnly? fim, IRelatorioCaixaRepository relatorios,
            CancellationToken cancellationToken) =>
            Results.Ok(await relatorios.CaixaPorPeriodoAsync(inicio, fim, cancellationToken)));

        app.MapGet("/v1/relatorios/fiado", async (
            IFiadoRepository fiado, CancellationToken cancellationToken) =>
            Results.Ok(await fiado.ListSaldosDevedoresAsync(cancellationToken)));

        return app;
    }
}
