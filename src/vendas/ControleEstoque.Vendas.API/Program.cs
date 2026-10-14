using ControleEstoque.Shared.Hosting;
using ControleEstoque.Vendas.API;
using ControleEstoque.Vendas.Hosting;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddControleEstoqueApiDefaults(builder.Configuration);
builder.Services.AddVendasServices(builder.Configuration);

var app = builder.Build();
app.UseControleEstoqueApiDefaults();
app.MapControleEstoqueDefaultEndpoints();
app.MapVendasEndpoints();
app.Run();

public partial class Program;
