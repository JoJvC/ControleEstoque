namespace ControleEstoque.Estoque.Domain;

public sealed record Marca(Guid Id, string Nome);

public sealed record Produto(
    Guid Id,
    TipoProduto Tipo,
    string Nome,
    Guid? MarcaId,
    string? MarcaNome,
    string? Categoria,
    string? Tamanho,
    string? FotoUrl,
    decimal PrecoReferencia,
    int EstoqueMinimo);

public sealed record EstoqueItem(
    Guid ProdutoId,
    TipoProduto Tipo,
    string Nome,
    string? Marca,
    string? Categoria,
    string? Tamanho,
    long Quantidade,
    int EstoqueMinimo,
    bool AbaixoMinimo);

public sealed record AbastecimentoItem(Guid ProdutoId, int Quantidade, decimal CustoUnitario);

public sealed record NovoAbastecimento(
    TipoFrete TipoFrete,
    decimal CustoTotal,
    Guid? FuncionarioId,
    string? Observacao,
    IReadOnlyList<AbastecimentoItem> Itens);

public sealed record NovaBaixaCasco(int Quantidade, string? Motivo, IReadOnlyList<Guid> ResponsaveisIds);
