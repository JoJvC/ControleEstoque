using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace ControleEstoque.Shared.Hosting;

public static class ServiceCollectionExtensions
{
    /// <summary>
    /// Defaults de plataforma: options de hosting, health checks e JSON com
    /// enums serializados como string (contrato das APIs).
    /// </summary>
    public static IServiceCollection AddControleEstoqueApiDefaults(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.AddOptions<HostingOptions>()
            .Bind(configuration.GetSection(HostingOptions.SectionName))
            .Validate(o => !string.IsNullOrWhiteSpace(o.ServiceName), "ServiceName is required.")
            .ValidateOnStart();

        services.ConfigureHttpJsonOptions(o =>
            o.SerializerOptions.Converters.Add(new JsonStringEnumConverter()));

        services.AddHealthChecks();
        return services;
    }
}

public static class ApiApplicationBuilderExtensions
{
    /// <summary>Pipeline padrão: erro global (mais externo) + correlation.</summary>
    public static WebApplication UseControleEstoqueApiDefaults(this WebApplication app)
    {
        app.UseMiddleware<GlobalErrorHandlerMiddleware>();
        app.UseMiddleware<CorrelationMiddleware>();
        return app;
    }

    public static WebApplication MapControleEstoqueDefaultEndpoints(this WebApplication app)
    {
        app.MapHealthChecks("/health");
        return app;
    }
}
