namespace ControleEstoque.Estoque.Domain;

public interface IMarcaRepository
{
    Task<Marca> CreateAsync(string nome, CancellationToken cancellationToken);
    Task<IReadOnlyList<Marca>> ListAsync(CancellationToken cancellationToken);
    Task<bool> ExistsAsync(Guid id, CancellationToken cancellationToken);
}

public interface IProdutoRepository
{
    Task CreateAsync(Produto produto, CancellationToken cancellationToken);
    Task<bool> UpdateAsync(Produto produto, CancellationToken cancellationToken);
    Task<Produto?> GetAsync(Guid id, CancellationToken cancellationToken);
    Task<Produto?> GetFirstByTipoAsync(TipoProduto tipo, CancellationToken cancellationToken);
    Task<IReadOnlyList<Produto>> ListAsync(
        TipoProduto? tipo, Guid? marcaId, string? categoria, CancellationToken cancellationToken);
    Task<bool> SetFotoAsync(Guid id, string fotoUrl, CancellationToken cancellationToken);
}

public interface IEstoqueRepository
{
    Task<IReadOnlyList<EstoqueItem>> GetEstoqueAsync(CancellationToken cancellationToken);
    Task<long> GetSaldoAsync(Guid produtoId, CancellationToken cancellationToken);
    Task AddAjusteAsync(Guid produtoId, int quantidade, string? observacao, CancellationToken cancellationToken);
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
    /// <summary>Baixa + responsáveis + movimentos (−CASCO / +SUCATA) em uma transação.</summary>
    Task<Guid> CreateAsync(
        NovaBaixaCasco baixa, Guid cascoProdutoId, Guid sucataProdutoId, CancellationToken cancellationToken);
}

public interface IFotoStorage
{
    Task<string> SaveAsync(Guid produtoId, Stream content, string extension, CancellationToken cancellationToken);
    Task<(Stream Content, string ContentType)?> OpenAsync(string fotoUrl, CancellationToken cancellationToken);
}
