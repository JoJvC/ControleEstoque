using ControleEstoque.Shared.Telemetry;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;

namespace ControleEstoque.Shared.Hosting;

/// <summary>
/// Extrai (ou gera) o X-Correlation-Id, ecoa no response e abre um scope de log
/// para que todo log da requisição carregue o CorrelationId.
/// </summary>
public sealed class CorrelationMiddleware
{
    public const string ItemKey = "CorrelationId";

    private readonly RequestDelegate next;
    private readonly ILogger<CorrelationMiddleware> logger;

    public CorrelationMiddleware(RequestDelegate next, ILogger<CorrelationMiddleware> logger)
    {
        this.next = next;
        this.logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var correlationId = context.Request.Headers[TelemetryHeaderNames.CorrelationId].FirstOrDefault();
        if (string.IsNullOrWhiteSpace(correlationId))
        {
            correlationId = Guid.NewGuid().ToString("N");
        }

        context.Items[ItemKey] = correlationId;
        context.Response.Headers[TelemetryHeaderNames.CorrelationId] = correlationId;

        using var scope = logger.BeginScope(new Dictionary<string, object>
        {
            ["CorrelationId"] = correlationId
        });

        await next(context);
    }
}
