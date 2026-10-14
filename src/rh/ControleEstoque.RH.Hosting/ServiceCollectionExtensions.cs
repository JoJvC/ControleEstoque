using ControleEstoque.RH.Domain;
using ControleEstoque.RH.Repository;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Npgsql;

namespace ControleEstoque.RH.Hosting;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddRHServices(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.AddOptions<RHOptions>()
            .Bind(configuration.GetSection(RHOptions.SectionName))
            .Validate(o => !string.IsNullOrWhiteSpace(o.ConnectionString), "ConnectionString is required.")
            .ValidateOnStart();

        services.AddSingleton(sp =>
            NpgsqlDataSource.Create(sp.GetRequiredService<IOptions<RHOptions>>().Value.ConnectionString));

        services.AddSingleton<ICargoRepository, PostgresCargoRepository>();
        services.AddSingleton<IFuncionarioRepository, PostgresFuncionarioRepository>();
        services.AddSingleton<IContaFuncionarioRepository, PostgresContaFuncionarioRepository>();

        services.AddSingleton<ICargoService, CargoService>();
        services.AddSingleton<IFuncionarioService, FuncionarioService>();
        services.AddSingleton<IContaFuncionarioService, ContaFuncionarioService>();
        return services;
    }
}
