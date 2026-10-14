using System.Diagnostics;
using System.Diagnostics.Metrics;

namespace ControleEstoque.Shared.Telemetry;

/// <summary>
/// Um único ActivitySource e um único Meter para toda a plataforma.
/// Não criar ActivitySource por serviço.
/// </summary>
public static class PlatformTelemetry
{
    public static readonly ActivitySource ActivitySource = new("ControleEstoque.Platform", "1.0.0");
    public static readonly Meter Meter = new("ControleEstoque.Platform", "1.0.0");

    public static readonly Counter<long> VendasRegistradasTotal =
        Meter.CreateCounter<long>("vendas.registradas.total");

    public static readonly Counter<long> ErrosControladosTotal =
        Meter.CreateCounter<long>("erros.controlados.total");
}

public static class TelemetryHeaderNames
{
    public const string CorrelationId = "X-Correlation-Id";
}

public static class TelemetryTagNames
{
    public const string CorrelationId = "controleestoque.correlation_id";
}
