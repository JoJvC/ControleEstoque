using ControleEstoque.Clientes.API;
using ControleEstoque.Clientes.Hosting;
using ControleEstoque.Shared.Hosting;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddControleEstoqueApiDefaults(builder.Configuration);
builder.Services.AddClientesServices(builder.Configuration);

var app = builder.Build();
app.UseControleEstoqueApiDefaults();
app.MapControleEstoqueDefaultEndpoints();
app.MapClientesEndpoints();
app.Run();

public partial class Program;
