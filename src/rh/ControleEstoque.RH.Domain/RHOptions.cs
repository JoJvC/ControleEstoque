namespace ControleEstoque.RH.Domain;

public sealed class RHOptions
{
    public const string SectionName = "ControleEstoque:RH";

    public string ConnectionString { get; set; } = string.Empty;
}
