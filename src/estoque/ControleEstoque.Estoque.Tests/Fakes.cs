using ControleEstoque.Estoque.Domain;

namespace ControleEstoque.Estoque.Tests;

internal sealed class FakeMarcaRepository : IMarcaRepository
{
    private readonly Dictionary<Guid, Marca> marcas = new();

    public Marca Add(string nome)
    {
        var marca = new Marca(Guid.NewGuid(), nome);
        marcas[marca.Id] = marca;
        return marca;
    }

    public Task<Marca> CreateAsync(string nome, CancellationToken cancellationToken) =>
        Task.FromResult(Add(nome));

    public Task<IReadOnlyList<Marca>> ListAsync(CancellationToken cancellationToken) =>
        Task.FromResult<IReadOnlyList<Marca>>(marcas.Values.ToList());

    public Task<bool> ExistsAsync(Guid id, CancellationToken cancellationToken) =>
        Task.FromResult(marcas.ContainsKey(id));
}

internal sealed class FakeProdutoRepository : IProdutoRepository
{
    private readonly Dictionary<Guid, Produto> produtos = new();

    public void Add(Produto produto) => produtos[produto.Id] = produto;

    public Task CreateAsync(Produto produto, CancellationToken cancellationToken)
    {
        produtos[produto.Id] = produto;
        return Task.CompletedTask;
    }

    public Task<bool> UpdateAsync(Produto produto, CancellationToken cancellationToken)
    {
        if (!produtos.ContainsKey(produto.Id))
        {
            return Task.FromResult(false);
        }

        produtos[produto.Id] = produto;
        return Task.FromResult(true);
    }

    public Task<Produto?> GetAsync(Guid id, CancellationToken cancellationToken) =>
        Task.FromResult(produtos.GetValueOrDefault(id));

    public Task<Produto?> GetFirstByTipoAsync(TipoProduto tipo, CancellationToken cancellationToken) =>
        Task.FromResult(produtos.Values.FirstOrDefault(p => p.Tipo == tipo));

    public Task<IReadOnlyList<Produto>> ListAsync(
        TipoProduto? tipo, Guid? marcaId, string? categoria, CancellationToken cancellationToken) =>
        Task.FromResult<IReadOnlyList<Produto>>(produtos.Values
            .Where(p => tipo is null || p.Tipo == tipo)
            .Where(p => marcaId is null || p.MarcaId == marcaId)
            .Where(p => categoria is null || p.Categoria == categoria)
            .ToList());

    public Task<bool> SetFotoAsync(Guid id, string fotoUrl, CancellationToken cancellationToken)
    {
        if (produtos.TryGetValue(id, out var produto))
        {
            produtos[id] = produto with { FotoUrl = fotoUrl };
            return Task.FromResult(true);
        }

        return Task.FromResult(false);
    }
}

internal sealed class FakeEstoqueRepository : IEstoqueRepository
{
    private readonly Dictionary<Guid, long> saldos = new();

    public void SetSaldo(Guid produtoId, long saldo) => saldos[produtoId] = saldo;

    public Task<IReadOnlyList<EstoqueItem>> GetEstoqueAsync(CancellationToken cancellationToken) =>
        Task.FromResult<IReadOnlyList<EstoqueItem>>([]);

    public Task<long> GetSaldoAsync(Guid produtoId, CancellationToken cancellationToken) =>
        Task.FromResult(saldos.GetValueOrDefault(produtoId));

    public Task AddAjusteAsync(
        Guid produtoId, int quantidade, string? observacao, CancellationToken cancellationToken)
    {
        saldos[produtoId] = saldos.GetValueOrDefault(produtoId) + quantidade;
        return Task.CompletedTask;
    }
}

internal sealed class FakeBaixaCascoRepository : IBaixaCascoRepository
{
    public NovaBaixaCasco? UltimaBaixa { get; private set; }

    public Task<Guid> CreateAsync(
        NovaBaixaCasco baixa, Guid cascoProdutoId, Guid sucataProdutoId, CancellationToken cancellationToken)
    {
        UltimaBaixa = baixa;
        return Task.FromResult(Guid.NewGuid());
    }
}

internal sealed class FakeFotoStorage : IFotoStorage
{
    public Task<string> SaveAsync(
        Guid produtoId, Stream content, string extension, CancellationToken cancellationToken) =>
        Task.FromResult($"produtos/{produtoId}{extension}");

    public Task<(Stream Content, string ContentType)?> OpenAsync(
        string fotoUrl, CancellationToken cancellationToken) =>
        Task.FromResult<(Stream, string)?>(null);
}
