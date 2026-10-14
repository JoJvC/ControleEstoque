namespace ControleEstoque.Financeiro.Domain;

public sealed class FinanceiroOptions
{
    public const string SectionName = "ControleEstoque:Financeiro";

    public string ConnectionString { get; set; } = string.Empty;
}
