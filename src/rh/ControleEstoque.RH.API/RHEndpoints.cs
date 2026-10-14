using ControleEstoque.RH.Contracts;
using ControleEstoque.RH.Domain;

namespace ControleEstoque.RH.API;

public static class RHEndpoints
{
    public static WebApplication MapRHEndpoints(this WebApplication app)
    {
        // ---- Cargos ----------------------------------------------------------
        app.MapPost("/v1/cargos", async (
            CreateCargoRequest request, ICargoService cargos, CancellationToken cancellationToken) =>
        {
            var cargo = await cargos.CriarAsync(request.Nome, request.Permissoes ?? [], cancellationToken);
            return Results.Created($"/v1/cargos/{cargo.Id}", CargoResponse.From(cargo));
        });

        app.MapPut("/v1/cargos/{id:guid}", async (
            Guid id, CreateCargoRequest request, ICargoService cargos, CancellationToken cancellationToken) =>
        {
            var cargo = await cargos.AtualizarAsync(
                id, request.Nome, request.Permissoes ?? [], cancellationToken);
            return Results.Ok(CargoResponse.From(cargo));
        });

        app.MapGet("/v1/cargos", async (ICargoService cargos, CancellationToken cancellationToken) =>
        {
            var lista = await cargos.ListarAsync(cancellationToken);
            return Results.Ok(lista.Select(CargoResponse.From));
        });

        // ---- Funcionários ------------------------------------------------------
        app.MapPost("/v1/funcionarios", async (
            CreateFuncionarioRequest request, IFuncionarioService funcionarios,
            CancellationToken cancellationToken) =>
        {
            var criado = await funcionarios.CriarAsync(ToFuncionario(Guid.Empty, request), cancellationToken);
            return Results.Created($"/v1/funcionarios/{criado.Id}", FuncionarioResponse.From(criado));
        });

        app.MapPut("/v1/funcionarios/{id:guid}", async (
            Guid id, CreateFuncionarioRequest request, IFuncionarioService funcionarios,
            CancellationToken cancellationToken) =>
        {
            var atualizado = await funcionarios.AtualizarAsync(ToFuncionario(id, request), cancellationToken);
            return Results.Ok(FuncionarioResponse.From(atualizado));
        });

        app.MapGet("/v1/funcionarios/{id:guid}", async (
            Guid id, IFuncionarioService funcionarios, CancellationToken cancellationToken) =>
            Results.Ok(FuncionarioResponse.From(await funcionarios.ObterAsync(id, cancellationToken))));

        app.MapGet("/v1/funcionarios", async (
            IFuncionarioService funcionarios, CancellationToken cancellationToken) =>
        {
            var lista = await funcionarios.ListarAsync(cancellationToken);
            return Results.Ok(lista.Select(FuncionarioResponse.From));
        });

        // ---- Conta corrente do funcionário ---------------------------------------
        app.MapGet("/v1/funcionarios/{id:guid}/conta-corrente", async (
            Guid id, IContaFuncionarioService conta, CancellationToken cancellationToken) =>
            Results.Ok(ExtratoResponse.From(await conta.ObterExtratoAsync(id, cancellationToken))));

        app.MapPost("/v1/funcionarios/{id:guid}/vales", async (
            Guid id, LancamentoContaRequest request, IContaFuncionarioService conta,
            CancellationToken cancellationToken) =>
        {
            var saldo = await conta.RegistrarValeAsync(
                id, request.Valor, request.Observacao, cancellationToken);
            return Results.Created(
                $"/v1/funcionarios/{id}/conta-corrente", new SaldoContaResponse(saldo));
        });

        app.MapPost("/v1/funcionarios/{id:guid}/pagamentos", async (
            Guid id, LancamentoContaRequest request, IContaFuncionarioService conta,
            CancellationToken cancellationToken) =>
        {
            var saldo = await conta.RegistrarPagamentoAsync(
                id, request.Valor, request.Observacao, cancellationToken);
            return Results.Created(
                $"/v1/funcionarios/{id}/conta-corrente", new SaldoContaResponse(saldo));
        });

        // ---- Relatório --------------------------------------------------------------
        app.MapGet("/v1/relatorios/conta-funcionarios", async (
            IContaFuncionarioRepository conta, CancellationToken cancellationToken) =>
            Results.Ok(await conta.ListSaldosAsync(cancellationToken)));

        return app;
    }

    private static Funcionario ToFuncionario(Guid id, CreateFuncionarioRequest request) => new(
        id, request.Nome, request.Telefone, request.CargoId, null, request.ValorDiaria, request.Ativo);
}
