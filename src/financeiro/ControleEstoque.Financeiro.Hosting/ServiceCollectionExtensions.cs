using ControleEstoque.Financeiro.Domain;
using ControleEstoque.Financeiro.Repository;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Npgsql;

namespace ControleEstoque.Financeiro.Hosting;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddFinanceiroServices(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.AddOptions<FinanceiroOptions>()
            .Bind(configuration.GetSection(FinanceiroOptions.SectionName))
            .Validate(o => !string.IsNullOrWhiteSpace(o.ConnectionString), "ConnectionString is required.")
            .ValidateOnStart();

        services.AddSingleton(sp =>
            NpgsqlDataSource.Create(sp.GetRequiredService<IOptions<FinanceiroOptions>>().Value.ConnectionString));

        services.AddSingleton<ICaixaRepository, PostgresCaixaRepository>();
        services.AddSingleton<ITipoDespesaRepository, PostgresTipoDespesaRepository>();
        services.AddSingleton<IFiadoRepository, PostgresFiadoRepository>();
        services.AddSingleton<IRelatorioCaixaRepository, PostgresRelatorioCaixaRepository>();

        services.AddSingleton<ICaixaService, CaixaService>();
        services.AddSingleton<IFiadoService, FiadoService>();
        return services;
    }
}
