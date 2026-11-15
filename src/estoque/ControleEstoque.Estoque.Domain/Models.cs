namespace ControleEstoque.Estoque.Domain;

public sealed record Marca(Guid Id, string Nome);

/// <summary>Marca nula = casco genérico; preenchida = casco específico da marca.</summary>
public sealed record TipoCasco(
    Guid Id,
    string Nome,
    Guid? MarcaId,
    string? MarcaNome,
    decimal PrecoVasilhame,
    bool AceitaSucata);

/// <summary>Associação produto+marca: guarda preço de referência, estoque, mínimo, foto e casco específico.</summary>
public sealed record ProdutoMarca(
    Guid Id,
    Guid MarcaId,
    string? MarcaNome,
    decimal PrecoReferencia,
    int EstoqueMinimo,
    long Quantidade,
    string? FotoUrl,
    Guid? TipoCascoId)
{
    // Nome qualificado: o membro EstoqueMinimo (int) esconde a classe de mesmo nome.
    public bool AbaixoMinimo => Domain.EstoqueMinimo.Abaixo(Quantidade, EstoqueMinimo);
}

public sealed record Produto(
    Guid Id,
    TipoProduto Tipo,
    string Nome,
    string? Categoria,
    string? Tamanho,
    Guid? TipoCascoId,
    IReadOnlyList<ProdutoMarca> Marcas)
{
    /// <summary>Estoque geral = soma das marcas; sem associação = 0.</summary>
    public long EstoqueGeral => Marcas.Sum(m => m.Quantidade);
}

public sealed record EstoqueItem(
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
    bool AbaixoMinimo);

/// <summary>Saldo de casco de um tipo: vazios e sucata.</summary>
public sealed record EstoqueCasco(
    Guid TipoCascoId,
    string Nome,
    Guid? MarcaId,
    string? Marca,
    bool AceitaSucata,
    long Vazios,
    long Sucata);

public sealed record AbastecimentoItem(Guid ProdutoMarcaId, int Quantidade);

public sealed record AbastecimentoCasco(Guid TipoCascoId, int Quantidade);

public sealed record NovoAbastecimento(
    TipoFrete TipoFrete,
    Guid? FuncionarioId,
    string? Observacao,
    IReadOnlyList<AbastecimentoItem> Itens,
    IReadOnlyList<AbastecimentoCasco> Cascos);

/// <summary>Linha da carga já gravada (item de produto+marca ou casco); custo nulo = pendente.</summary>
public sealed record LinhaCarga(Guid Id, Guid ReferenciaId, int Quantidade, decimal? CustoUnitario);

public sealed record Abastecimento(
    Guid Id,
    DateOnly Data,
    TipoFrete TipoFrete,
    Guid? FuncionarioId,
    string? Observacao,
    decimal? Frete,
    IReadOnlyList<LinhaCarga> Itens,
    IReadOnlyList<LinhaCarga> Cascos);

public sealed record AbastecimentoPendente(
    Guid Id, DateOnly Data, TipoFrete TipoFrete, int TotalUnidades, int LinhasSemCusto, bool FreteFaltando);

public sealed record CustoLinha(Guid Id, decimal CustoUnitario);

/// <summary>Momento 2: só o que veio é gravado; <see cref="Frete"/> nulo mantém o frete atual.</summary>
public sealed record LancamentoCustos(
    Guid FuncionarioId, decimal? Frete, IReadOnlyList<CustoLinha> Itens, IReadOnlyList<CustoLinha> Cascos);

public sealed record NovaBaixaCasco(
    Guid TipoCascoId, int Quantidade, string? Motivo, IReadOnlyList<Guid> ResponsaveisIds);

/// <summary>Lançamento assinado no razão de cascos de um tipo.</summary>
public sealed record MovimentoCasco(SituacaoCasco Situacao, TipoMovimentoEstoque Tipo, int Quantidade);
