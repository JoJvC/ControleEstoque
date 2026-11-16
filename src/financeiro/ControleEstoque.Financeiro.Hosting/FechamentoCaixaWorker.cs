using ControleEstoque.Financeiro.Domain;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace ControleEstoque.Financeiro.Hosting;

/// <summary>Fecha pelo sistema os caixas vencidos ao subir e a cada minuto; falha vai para o log, a API não cai.</summary>
public sealed class FechamentoCaixaWorker : BackgroundService
{
    private readonly ICaixaService caixas;
    private readonly TimeProvider relogio;
    private readonly ILogger<FechamentoCaixaWorker> logger;

    public FechamentoCaixaWorker(
        ICaixaService caixas, TimeProvider relogio, ILogger<FechamentoCaixaWorker> logger)
    {
        this.caixas = caixas;
        this.relogio = relogio;
        this.logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(1), relogio);
        try
        {
            do
            {
                try
                {
                    var fechados = await caixas.FecharVencidosAsync(stoppingToken);
                    if (fechados > 0)
                    {
                        logger.LogInformation("Caixas fechados pelo sistema: {Fechados}.", fechados);
                    }
                }
                catch (Exception e) when (e is not OperationCanceledException)
                {
                    logger.LogError(e, "Falha ao fechar os caixas vencidos; nova tentativa em 1 minuto.");
                }
            }
            while (await timer.WaitForNextTickAsync(stoppingToken));
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            // desligamento
        }
    }
}
