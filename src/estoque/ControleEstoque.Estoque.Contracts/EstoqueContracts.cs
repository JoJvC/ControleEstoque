using ControleEstoque.Estoque.Domain;

namespace ControleEstoque.Estoque.Contracts;

public sealed record CreateMarcaRequest(string Nome);

public sealed record MarcaResponse(Guid Id, string Nome);

public sealed record CreateTipoCascoRequest(string Nome, Guid? MarcaId, decimal PrecoVasilhame, bool AceitaSucata);

public sealed record TipoCascoResponse(
    Guid Id, string Nome, Guid? MarcaId, string? Marca, decimal PrecoVasilhame, bool AceitaSucata)
{
    public static TipoCascoResponse From(TipoCasco t) => new(
        t.Id, t.Nome, t.MarcaId, t.MarcaNome, t.PrecoVasilhame, t.AceitaSucata);
}

public sealed record CreateProdutoRequest(
    TipoProduto Tipo,
    string Nome,
    string? Categoria,
    string? Tamanho,
    Guid? TipoCascoId);

public sealed record CreateProdutoMarcaRequest(
    Guid MarcaId,
    decimal PrecoReferencia,
    int EstoqueMinimo,
    Guid? TipoCascoId);

public sealed record ProdutoMarcaResponse(
    Guid Id,
    Guid MarcaId,
    string? MarcaNome,
    decimal PrecoReferencia,
    int EstoqueMinimo,
    long Quantidade,
    bool AbaixoMinimo,
    string? FotoUrl,
    Guid? TipoCascoId,
    Guid? TipoCascoResolvidoId)
{
    public static ProdutoMarcaResponse From(Produto p, ProdutoMarca m) => new(
        m.Id, m.MarcaId, m.MarcaNome, m.PrecoReferencia, m.EstoqueMinimo, m.Quantidade,
        m.AbaixoMinimo, m.FotoUrl, m.TipoCascoId, RegrasCasco.Resolver(p, m));
}

public sealed record ProdutoResponse(
    Guid Id,
    TipoProduto Tipo,
    string Nome,
    string? Categoria,
    string? Tamanho,
    Guid? TipoCascoId,
    long EstoqueGeral,
    IReadOnlyList<ProdutoMarcaResponse> Marcas)
{
    public static ProdutoResponse From(Produto p) => new(
        p.Id, p.Tipo, p.Nome, p.Categoria, p.Tamanho, p.TipoCascoId, p.EstoqueGeral,
        p.Marcas.Select(m => ProdutoMarcaResponse.From(p, m)).ToList());
}

public sealed record EstoqueItemResponse(
    Guid ProdutoMarcaId,
    Guid ProdutoId,
    TipoProduto Tipo,
    string Nome,
    Guid MarcaId,
    string? Marca,
    string? Categoria,
    string? Tamanho,
    long Quantidade,
    int EstoqueMinimo,
    bool AbaixoMinimo)
{
    public static EstoqueItemResponse From(EstoqueItem i) => new(
        i.ProdutoMarcaId, i.ProdutoId, i.Tipo, i.Nome, i.MarcaId, i.Marca, i.Categoria, i.Tamanho,
        i.Quantidade, i.EstoqueMinimo, i.AbaixoMinimo);
}

public sealed record EstoqueCascoResponse(
    Guid TipoCascoId, string Nome, Guid? MarcaId, string? Marca, bool AceitaSucata, long Vazios, long Sucata)
{
    public static EstoqueCascoResponse From(EstoqueCasco c) => new(
        c.TipoCascoId, c.Nome, c.MarcaId, c.Marca, c.AceitaSucata, c.Vazios, c.Sucata);
}

public sealed record CreateMovimentoRequest(Guid ProdutoMarcaId, int Quantidade, string? Observacao);

public sealed record CreateMovimentoCascoRequest(
    Guid TipoCascoId, SituacaoCasco Situacao, int Quantidade, string? Motivo);

public sealed record AbastecimentoItemRequest(Guid ProdutoMarcaId, int Quantidade, decimal CustoUnitario);

public sealed record CreateAbastecimentoRequest(
    TipoFrete TipoFrete,
    decimal CustoTotal,
    Guid? FuncionarioId,
    string? Observacao,
    List<AbastecimentoItemRequest>? Itens);

public sealed record CreateBaixaCascoRequest(
    Guid TipoCascoId, int Quantidade, string? Motivo, List<Guid>? ResponsaveisIds);

public sealed record CreatedResponse(Guid Id);

public sealed record FotoResponse(string FotoUrl);
