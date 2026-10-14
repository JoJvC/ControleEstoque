using ControleEstoque.Estoque.Domain;
using ControleEstoque.Estoque.Repository;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Npgsql;

namespace ControleEstoque.Estoque.Hosting;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddEstoqueServices(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.AddOptions<EstoqueOptions>()
            .Bind(configuration.GetSection(EstoqueOptions.SectionName))
            .Validate(o => !string.IsNullOrWhiteSpace(o.ConnectionString), "ConnectionString is required.")
            .Validate(o => !string.IsNullOrWhiteSpace(o.MediaPath), "MediaPath is required.")
            .ValidateOnStart();

        services.AddSingleton(sp =>
            NpgsqlDataSource.Create(sp.GetRequiredService<IOptions<EstoqueOptions>>().Value.ConnectionString));

        services.AddSingleton<IMarcaRepository, PostgresMarcaRepository>();
        services.AddSingleton<IProdutoRepository, PostgresProdutoRepository>();
        services.AddSingleton<IEstoqueRepository, PostgresEstoqueRepository>();
        services.AddSingleton<IAbastecimentoRepository, PostgresAbastecimentoRepository>();
        services.AddSingleton<IBaixaCascoRepository, PostgresBaixaCascoRepository>();
        services.AddSingleton<IFotoStorage>(sp =>
            new LocalDiskFotoStorage(sp.GetRequiredService<IOptions<EstoqueOptions>>().Value.MediaPath));

        services.AddSingleton<IProdutoService, ProdutoService>();
        services.AddSingleton<IEstoqueService, EstoqueService>();
        services.AddSingleton<IAbastecimentoService, AbastecimentoService>();
        return services;
    }
}
