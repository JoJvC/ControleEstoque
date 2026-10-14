namespace ControleEstoque.Vendas.Domain;

public sealed class VendasOptions
{
    public const string SectionName = "ControleEstoque:Vendas";

    public string ConnectionString { get; set; } = string.Empty;
}
