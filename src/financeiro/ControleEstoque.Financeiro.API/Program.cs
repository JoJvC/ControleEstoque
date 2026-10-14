using ControleEstoque.Financeiro.API;
using ControleEstoque.Financeiro.Hosting;
using ControleEstoque.Shared.Hosting;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddControleEstoqueApiDefaults(builder.Configuration);
builder.Services.AddFinanceiroServices(builder.Configuration);

var app = builder.Build();
app.UseControleEstoqueApiDefaults();
app.MapControleEstoqueDefaultEndpoints();
app.MapFinanceiroEndpoints();
app.Run();

public partial class Program;
