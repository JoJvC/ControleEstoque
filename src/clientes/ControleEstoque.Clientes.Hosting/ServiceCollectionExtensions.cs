using ControleEstoque.Clientes.Domain;
using ControleEstoque.Clientes.Repository;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Npgsql;

namespace ControleEstoque.Clientes.Hosting;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddClientesServices(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.AddOptions<ClientesOptions>()
            .Bind(configuration.GetSection(ClientesOptions.SectionName))
            .Validate(o => !string.IsNullOrWhiteSpace(o.ConnectionString), "ConnectionString is required.")
            .ValidateOnStart();

        services.AddSingleton(sp =>
            NpgsqlDataSource.Create(sp.GetRequiredService<IOptions<ClientesOptions>>().Value.ConnectionString));

        services.AddSingleton<IClienteRepository, PostgresClienteRepository>();
        services.AddSingleton<ISaldosRepository, PostgresSaldosRepository>();
        services.AddSingleton<ICascoClienteRepository, PostgresCascoClienteRepository>();
        services.AddSingleton<ISucataClienteRepository, PostgresSucataClienteRepository>();

        services.AddSingleton<IClienteService, ClienteService>();
        services.AddSingleton<ICascoClienteService, CascoClienteService>();
        services.AddSingleton<ISucataClienteService, SucataClienteService>();
        return services;
    }
}
