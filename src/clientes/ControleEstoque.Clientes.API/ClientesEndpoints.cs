using ControleEstoque.Clientes.Contracts;
using ControleEstoque.Clientes.Domain;

namespace ControleEstoque.Clientes.API;

public static class ClientesEndpoints
{
    public static WebApplication MapClientesEndpoints(this WebApplication app)
    {
        // ---- CRUD ----------------------------------------------------------
        app.MapPost("/v1/clientes", async (
            CreateClienteRequest request, IClienteService clientes, CancellationToken cancellationToken) =>
        {
            var criado = await clientes.CriarAsync(
                new Cliente(Guid.Empty, request.Nome, request.Telefone, request.Observacoes, []),
                cancellationToken);
            return Results.Created($"/v1/clientes/{criado.Id}", ClienteResponse.From(criado));
        });

        app.MapPut("/v1/clientes/{id:guid}", async (
            Guid id, CreateClienteRequest request, IClienteService clientes, CancellationToken cancellationToken) =>
        {
            var atualizado = await clientes.AtualizarAsync(
                new Cliente(id, request.Nome, request.Telefone, request.Observacoes, []),
                cancellationToken);
            return Results.Ok(ClienteResponse.From(atualizado));
        });

        app.MapGet("/v1/clientes/{id:guid}", async (
            Guid id, IClienteService clientes, CancellationToken cancellationToken) =>
            Results.Ok(ClienteResponse.From(await clientes.ObterAsync(id, cancellationToken))));

        app.MapGet("/v1/clientes", async (
            string? nome, int? page, int? pageSize, IClienteService clientes,
            CancellationToken cancellationToken) =>
        {
            var lista = await clientes.ListarAsync(nome, page ?? 1, pageSize ?? 50, cancellationToken);
            return Results.Ok(lista.Select(ClienteResponse.From));
        });

        app.MapPost("/v1/clientes/{id:guid}/enderecos", async (
            Guid id, CreateEnderecoRequest request, IClienteService clientes,
            CancellationToken cancellationToken) =>
        {
            var endereco = await clientes.AdicionarEnderecoAsync(
                new Endereco(
                    Guid.Empty, id, request.Logradouro, request.Numero, request.Bairro,
                    request.Complemento, request.Referencia, request.Principal),
                cancellationToken);
            return Results.Created(
                $"/v1/clientes/{id}/enderecos/{endereco.Id}", EnderecoResponse.From(endereco));
        });

        // ---- Saldos (casco + sucata + fiado) --------------------------------
        app.MapGet("/v1/clientes/{id:guid}/saldos", async (
            Guid id, IClienteService clientes, CancellationToken cancellationToken) =>
        {
            var saldos = await clientes.ObterSaldosAsync(id, cancellationToken);
            return Results.Ok(new SaldosResponse(saldos.SaldoCascos, saldos.SucataEntregue, saldos.SaldoFiado));
        });

        // ---- Pagar Casco -----------------------------------------------------
        app.MapPost("/v1/clientes/{id:guid}/cascos/devolucoes", async (
            Guid id, DevolucaoCascosRequest request, ICascoClienteService cascos,
            CancellationToken cancellationToken) =>
        {
            var resultado = await cascos.DevolverAsync(id, request.Quantidade, cancellationToken);
            return Results.Ok(new DevolucaoCascosResponse(resultado.NovoSaldoCascos));
        });

        app.MapPost("/v1/clientes/{id:guid}/cascos/conversoes", async (
            Guid id, ConversaoCascosRequest request, ICascoClienteService cascos,
            CancellationToken cancellationToken) =>
        {
            var resultado = await cascos.ConverterAsync(
                id, request.Quantidade, request.ValorUnitario, cancellationToken);
            return Results.Ok(new ConversaoCascosResponse(resultado.NovoSaldoCascos, resultado.NovoSaldoFiado));
        });

        // ---- Entrega de Sucata (não abate casco) -----------------------------
        app.MapPost("/v1/clientes/{id:guid}/sucatas", async (
            Guid id, EntregaSucataRequest request, ISucataClienteService sucatas,
            CancellationToken cancellationToken) =>
        {
            var resultado = await sucatas.EntregarAsync(
                id, request.Quantidade, request.ValorConversao, cancellationToken);
            return Results.Ok(new EntregaSucataResponse(
                resultado.TotalSucataEntregue, resultado.NovoSaldoFiado));
        });

        // ---- Relatórios ------------------------------------------------------
        app.MapGet("/v1/relatorios/cascos", async (
            ISaldosRepository saldos, CancellationToken cancellationToken) =>
            Results.Ok(await saldos.ListSaldosCascoAsync(cancellationToken)));

        app.MapGet("/v1/relatorios/sucata", async (
            ISaldosRepository saldos, CancellationToken cancellationToken) =>
            Results.Ok(await saldos.ListSucataEntregueAsync(cancellationToken)));

        return app;
    }
}
