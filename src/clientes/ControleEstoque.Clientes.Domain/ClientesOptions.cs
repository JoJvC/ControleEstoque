namespace ControleEstoque.Clientes.Domain;

public sealed class ClientesOptions
{
    public const string SectionName = "ControleEstoque:Clientes";

    public string ConnectionString { get; set; } = string.Empty;
}
