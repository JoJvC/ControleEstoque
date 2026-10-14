using ControleEstoque.Estoque.API;
using ControleEstoque.Estoque.Hosting;
using ControleEstoque.Shared.Hosting;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddControleEstoqueApiDefaults(builder.Configuration);
builder.Services.AddEstoqueServices(builder.Configuration);

var app = builder.Build();
app.UseControleEstoqueApiDefaults();
app.MapControleEstoqueDefaultEndpoints();
app.MapEstoqueEndpoints();
app.Run();

public partial class Program;
