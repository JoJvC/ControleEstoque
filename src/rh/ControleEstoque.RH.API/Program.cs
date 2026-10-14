using ControleEstoque.RH.API;
using ControleEstoque.RH.Hosting;
using ControleEstoque.Shared.Hosting;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddControleEstoqueApiDefaults(builder.Configuration);
builder.Services.AddRHServices(builder.Configuration);

var app = builder.Build();
app.UseControleEstoqueApiDefaults();
app.MapControleEstoqueDefaultEndpoints();
app.MapRHEndpoints();
app.Run();

public partial class Program;
