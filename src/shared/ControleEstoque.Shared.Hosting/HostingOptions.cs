namespace ControleEstoque.Shared.Hosting;

public sealed class HostingOptions
{
    public const string SectionName = "ControleEstoque:Hosting";

    public string ServiceName { get; set; } = "ControleEstoque.API";
}
