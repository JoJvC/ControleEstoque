using ControleEstoque.Vendas.Domain;
using ControleEstoque.Vendas.Repository;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Options;
using Npgsql;

namespace ControleEstoque.Vendas.Hosting;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddVendasServices(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.AddOptions<VendasOptions>()
            .Bind(configuration.GetSection(VendasOptions.SectionName))
            .Validate(o => !string.IsNullOrWhiteSpace(o.ConnectionString), "ConnectionString is required.")
            .ValidateOnStart();

        services.AddSingleton(sp =>
            NpgsqlDataSource.Create(sp.GetRequiredService<IOptions<VendasOptions>>().Value.ConnectionString));

        services.AddSingleton<IVendaRepository, PostgresVendaRepository>();
        services.AddSingleton<IVendaLookup, PostgresVendaLookup>();
        services.AddSingleton<IPermissaoFuncionarioLookup, PostgresPermissaoFuncionarioLookup>();
        services.AddSingleton<ICupomFiscalRepository, PostgresCupomFiscalRepository>();
        services.AddSingleton<IRelatorioVendasRepository, PostgresRelatorioVendasRepository>();

        services.TryAddSingleton(TimeProvider.System);
        services.AddSingleton<IVendaService, VendaService>();
        return services;
    }
}
