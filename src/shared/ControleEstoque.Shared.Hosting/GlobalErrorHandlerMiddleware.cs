using System.Diagnostics;
using ControleEstoque.Shared.Contracts;
using ControleEstoque.Shared.Results;
using ControleEstoque.Shared.Telemetry;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;

namespace ControleEstoque.Shared.Hosting;

/// <summary>
/// Middleware mais externo: converte ControlledFailureException no envelope
/// ApiErrorEnvelope com o status da exceção, e qualquer outra exceção em 500.
/// </summary>
public sealed class GlobalErrorHandlerMiddleware
{
    private readonly RequestDelegate next;
    private readonly ILogger<GlobalErrorHandlerMiddleware> logger;

    public GlobalErrorHandlerMiddleware(RequestDelegate next, ILogger<GlobalErrorHandlerMiddleware> logger)
    {
        this.next = next;
        this.logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (BadHttpRequestException e)
        {
            logger.LogWarning("Request inválido em {Path}: {Message}", context.Request.Path, e.Message);
            await WriteEnvelopeAsync(context, "REQUEST_INVALIDO", "Corpo ou parâmetros da requisição inválidos.", 400);
        }
        catch (ControlledFailureException e)
        {
            PlatformTelemetry.ErrosControladosTotal.Add(1,
                new KeyValuePair<string, object?>("code", e.Code));

            logger.LogWarning("Falha controlada {Code}: {Message}", e.Code, e.Message);
            await WriteEnvelopeAsync(context, e.Code, e.Message, e.StatusCode);
        }
        catch (Exception e)
        {
            logger.LogError(e, "Erro inesperado ao processar {Path}.", context.Request.Path);
            await WriteEnvelopeAsync(context, "INTERNAL_ERROR", "Erro interno inesperado.", 500);
        }
    }

    private static Task WriteEnvelopeAsync(HttpContext context, string code, string message, int statusCode)
    {
        var traceId = Activity.Current?.TraceId.ToString() ?? context.TraceIdentifier;
        context.Response.StatusCode = statusCode;
        return context.Response.WriteAsJsonAsync(new ApiErrorEnvelope(code, message, traceId));
    }
}
