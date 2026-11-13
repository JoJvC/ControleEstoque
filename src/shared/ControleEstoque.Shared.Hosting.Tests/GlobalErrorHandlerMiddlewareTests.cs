using System.Text.Json;
using ControleEstoque.Shared.Hosting;
using ControleEstoque.Shared.Results;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging.Abstractions;

namespace ControleEstoque.Shared.Hosting.Tests;

public class GlobalErrorHandlerMiddlewareTests
{
    private static async Task<(int Status, string Body)> InvocarAsync(Exception e)
    {
        var context = new DefaultHttpContext();
        context.Response.Body = new MemoryStream();
        var middleware = new GlobalErrorHandlerMiddleware(_ => throw e, NullLogger<GlobalErrorHandlerMiddleware>.Instance);
        await middleware.InvokeAsync(context);
        context.Response.Body.Position = 0;
        var body = await new StreamReader(context.Response.Body).ReadToEndAsync();
        return (context.Response.StatusCode, body);
    }

    [Fact]
    public async Task Excecao_inesperada_devolve_500_sem_detalhe_interno()
    {
        var (status, body) = await InvocarAsync(new Exception("segredo-interno-xyz", new InvalidOperationException("inner-xyz")));

        Assert.Equal(500, status);
        using var json = JsonDocument.Parse(body);
        Assert.Equal("INTERNAL_ERROR", json.RootElement.GetProperty("code").GetString());
        Assert.False(string.IsNullOrEmpty(json.RootElement.GetProperty("traceId").GetString()));
        Assert.DoesNotContain("segredo-interno-xyz", body);
        Assert.DoesNotContain("inner-xyz", body);
        Assert.DoesNotContain("InvalidOperationException", body);
        Assert.DoesNotContain("System.Exception", body);
        Assert.DoesNotContain("   at ", body);
    }

    [Fact]
    public async Task BadHttpRequest_devolve_400_com_mensagem_fixa()
    {
        var (status, body) = await InvocarAsync(new BadHttpRequestException("detalhe-parser"));

        Assert.Equal(400, status);
        using var json = JsonDocument.Parse(body);
        Assert.Equal("Corpo ou parâmetros da requisição inválidos.", json.RootElement.GetProperty("message").GetString());
        Assert.DoesNotContain("detalhe-parser", body);
    }

    [Fact]
    public async Task ControlledFailure_devolve_status_code_e_mensagem_de_negocio()
    {
        var (status, body) = await InvocarAsync(new ControlledFailureException("ESTOQUE_INSUFICIENTE", 409, "mensagem-de-negocio"));

        Assert.Equal(409, status);
        using var json = JsonDocument.Parse(body);
        Assert.Equal("ESTOQUE_INSUFICIENTE", json.RootElement.GetProperty("code").GetString());
        Assert.Equal("mensagem-de-negocio", json.RootElement.GetProperty("message").GetString());
    }
}
