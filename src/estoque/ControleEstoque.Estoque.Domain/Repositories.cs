using ControleEstoque.Shared.Results;

namespace ControleEstoque.Estoque.Domain;

public interface IMarcaRepository
{
    Task<Marca> CreateAsync(string nome, CancellationToken cancellationToken);
    Task<IReadOnlyList<Marca>> ListAsync(CancellationToken cancellationToken);
    Task<bool> ExistsAsync(Guid id, CancellationToken cancellationToken);
}

public interface ITipoCascoRepository
{
    Task CreateAsync(TipoCasco tipoCasco, CancellationToken cancellationToken);
    Task<bool> UpdateAsync(TipoCasco tipoCasco, CancellationToken cancellationToken);
    Task<TipoCasco?> GetAsync(Guid id, CancellationToken cancellationToken);
    Task<IReadOnlyList<TipoCasco>> ListAsync(CancellationToken cancellationToken);

    /// <summary>O tipo é o casco de algum produto ou de alguma associação produto+marca.</summary>
    Task<bool> EmUsoAsync(Guid id, CancellationToken cancellationToken);

    /// <summary>Saldo atual da sucata do tipo (soma do razão de cascos).</summary>
    Task<long> GetSaldoSucataAsync(Guid id, CancellationToken cancellationToken);
}

public interface IProdutoRepository
{
    /// <summary>Grava só os campos do produto; as associações (<see cref="Produto.Marcas"/>) são ignoradas.</summary>
    Task CreateAsync(Produto produto, CancellationToken cancellationToken);
    Task<bool> UpdateAsync(Produto produto, CancellationToken cancellationToken);

    /// <summary>Produto com as associações produto+marca e a quantidade de cada uma.</summary>
    Task<Produto?> GetAsync(Guid id, CancellationToken cancellationToken);

    /// <summary>Produto que contém a associação, ou nulo se ela não existe.</summary>
    Task<Produto?> GetByProdutoMarcaAsync(Guid produtoMarcaId, CancellationToken cancellationToken);

    /// <summary><paramref name="marcaId"/> filtra por produtos que têm associação com a marca.</summary>
    Task<IReadOnlyList<Produto>> ListAsync(
        TipoProduto? tipo, Guid? marcaId, string? categoria, CancellationToken cancellationToken);

    Task AddMarcaAsync(Guid produtoId, ProdutoMarca marca, CancellationToken cancellationToken);
    Task<bool> UpdateMarcaAsync(Guid produtoId, ProdutoMarca marca, CancellationToken cancellationToken);
    Task<bool> SetFotoAsync(Guid produtoMarcaId, string fotoUrl, CancellationToken cancellationToken);
}

public interface IEstoqueRepository
{
    Task<IReadOnlyList<EstoqueItem>> GetEstoqueAsync(CancellationToken cancellationToken);

    Task<IReadOnlyList<EstoqueCasco>> GetEstoqueCascosAsync(CancellationToken cancellationToken);

    /// <summary>
    /// Grava o ajuste em uma transação. Com quantidade negativa, trava a linha de estoque
    /// (produto+marca) e checa o saldo dentro da transação; sem saldo, faz rollback e devolve a falta.
    /// </summary>
    Task<SaldoInsuficiente?> AddAjusteAsync(
        Guid produtoMarcaId, int quantidade, string? observacao, CancellationToken cancellationToken);

    /// <summary>Igual a <see cref="AddAjusteAsync"/>, no razão de cascos do tipo (vazio ou sucata).</summary>
    Task<SaldoInsuficiente?> AddAjusteCascoAsync(
        Guid tipoCascoId, SituacaoCasco situacao, int quantidade, string? observacao,
        CancellationToken cancellationToken);
}

public interface IAbastecimentoRepository
{
    /// <summary>
    /// Insere abastecimento + itens + movimentos de entrada em uma transação.
    /// Se houver caixa ABERTO na data e custo &gt; 0, lança a despesa tipada.
    /// </summary>
    Task<Guid> CreateAsync(NovoAbastecimento abastecimento, CancellationToken cancellationToken);
}

public interface IBaixaCascoRepository
{
    /// <summary>
    /// Baixa + responsáveis + movimentos de casco do tipo (ver <see cref="RegrasCasco.MovimentosDaQuebra"/>)
    /// em uma transação, com o saldo checado sob trava dentro dela. Sem saldo, faz rollback e devolve a
    /// falta (Id fica vazio).
    /// </summary>
    Task<(Guid Id, SaldoInsuficiente? Falta)> CreateAsync(
        NovaBaixaCasco baixa, IReadOnlyList<MovimentoCasco> movimentos, CancellationToken cancellationToken);
}

public interface IFotoStorage
{
    Task<string> SaveAsync(Guid produtoMarcaId, Stream content, string extension, CancellationToken cancellationToken);
    Task<(Stream Content, string ContentType)?> OpenAsync(string fotoUrl, CancellationToken cancellationToken);
}
