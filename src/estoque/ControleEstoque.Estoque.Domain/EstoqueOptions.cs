namespace ControleEstoque.Estoque.Domain;

public sealed class EstoqueOptions
{
    public const string SectionName = "ControleEstoque:Estoque";

    public string ConnectionString { get; set; } = string.Empty;
    public string MediaPath { get; set; } = "/media";
}
