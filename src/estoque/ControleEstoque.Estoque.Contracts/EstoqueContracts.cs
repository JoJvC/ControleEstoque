using ControleEstoque.Estoque.Domain;

namespace ControleEstoque.Estoque.Contracts;

public sealed record CreateMarcaRequest(string Nome);

public sealed record MarcaResponse(Guid Id, string Nome);

public sealed record CreateProdutoRequest(
    TipoProduto Tipo,
    string Nome,
    Guid? MarcaId,
    string? Categoria,
    string? Tamanho,
    decimal PrecoReferencia,
    int EstoqueMinimo);

public sealed record ProdutoResponse(
    Guid Id,
    TipoProduto Tipo,
    string Nome,
    Guid? MarcaId,
    string? Marca,
    string? Categoria,
    string? Tamanho,
    string? FotoUrl,
    decimal PrecoReferencia,
    int EstoqueMinimo)
{
    public static ProdutoResponse From(Produto p) => new(
        p.Id, p.Tipo, p.Nome, p.MarcaId, p.MarcaNome, p.Categoria,
        p.Tamanho, p.FotoUrl, p.PrecoReferencia, p.EstoqueMinimo);
}

public sealed record EstoqueItemResponse(
    Guid ProdutoId,
    TipoProduto Tipo,
    string Nome,
    string? Marca,
    string? Categoria,
    string? Tamanho,
    long Quantidade,
    int EstoqueMinimo,
    bool AbaixoMinimo)
{
    public static EstoqueItemResponse From(EstoqueItem i) => new(
        i.ProdutoId, i.Tipo, i.Nome, i.Marca, i.Categoria, i.Tamanho,
        i.Quantidade, i.EstoqueMinimo, i.AbaixoMinimo);
}

public sealed record CreateMovimentoRequest(Guid ProdutoId, int Quantidade, string? Observacao);

public sealed record AbastecimentoItemRequest(Guid ProdutoId, int Quantidade, decimal CustoUnitario);

public sealed record CreateAbastecimentoRequest(
    TipoFrete TipoFrete,
    decimal CustoTotal,
    Guid? FuncionarioId,
    string? Observacao,
    List<AbastecimentoItemRequest>? Itens);

public sealed record CreateBaixaCascoRequest(int Quantidade, string? Motivo, List<Guid>? ResponsaveisIds);

public sealed record CreatedResponse(Guid Id);

public sealed record FotoResponse(string FotoUrl);
