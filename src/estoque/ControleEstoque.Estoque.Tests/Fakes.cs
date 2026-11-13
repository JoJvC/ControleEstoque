using ControleEstoque.Estoque.Domain;
using ControleEstoque.Shared.Results;

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

/// <summary>
/// Razão em memória que cumpre o contrato C0: a checagem de saldo e a gravação são atômicas,
/// sob trava. O atraso entre ler e gravar faz a corrida aparecer se a trava for retirada.
/// </summary>
internal sealed class FakeEstoqueRepository : IEstoqueRepository
{
    private readonly Dictionary<Guid, long> saldos = new();
    private readonly SemaphoreSlim trava = new(1, 1);

    /// <summary>Simula gravação atômica que recusa, mesmo com a leitura avulsa mostrando saldo alto.</summary>
    public bool RecusarSempre { get; set; }

    public void SetSaldo(Guid produtoId, long saldo) => saldos[produtoId] = saldo;

    public long GetSaldo(Guid produtoId) => saldos.GetValueOrDefault(produtoId);

    public Task<IReadOnlyList<EstoqueItem>> GetEstoqueAsync(CancellationToken cancellationToken) =>
        Task.FromResult<IReadOnlyList<EstoqueItem>>([]);

    public async Task<SaldoInsuficiente?> AddAjusteAsync(
        Guid produtoId, int quantidade, string? observacao, CancellationToken cancellationToken) =>
        await AplicarAsync([(produtoId, quantidade)]);

    /// <summary>Aplica os deltas de uma vez; se algum produto ficar negativo, não grava nada.</summary>
    public async Task<SaldoInsuficiente?> AplicarAsync(IReadOnlyList<(Guid ProdutoId, long Delta)> deltas)
    {
        await trava.WaitAsync();
        try
        {
            var lidos = deltas.ToDictionary(d => d.ProdutoId, d => saldos.GetValueOrDefault(d.ProdutoId));
            await Task.Delay(5); // janela entre ler e gravar: expõe a corrida sem a trava
            foreach (var (produtoId, delta) in deltas)
            {
                if (RecusarSempre || (delta < 0 && lidos[produtoId] + delta < 0))
                {
                    return new SaldoInsuficiente(produtoId, lidos[produtoId], -delta);
                }
            }

            foreach (var (produtoId, delta) in deltas)
            {
                saldos[produtoId] = lidos[produtoId] + delta;
            }

            return null;
        }
        finally
        {
            trava.Release();
        }
    }
}

internal sealed class FakeBaixaCascoRepository : IBaixaCascoRepository
{
    private readonly FakeEstoqueRepository estoque;

    public FakeBaixaCascoRepository(FakeEstoqueRepository estoque) => this.estoque = estoque;

    public NovaBaixaCasco? UltimaBaixa { get; private set; }

    public async Task<(Guid Id, SaldoInsuficiente? Falta)> CreateAsync(
        NovaBaixaCasco baixa, Guid cascoProdutoId, Guid sucataProdutoId, CancellationToken cancellationToken)
    {
        var falta = await estoque.AplicarAsync([(cascoProdutoId, -baixa.Quantidade), (sucataProdutoId, baixa.Quantidade)]);
        if (falta is not null)
        {
            return (Guid.Empty, falta);
        }

        UltimaBaixa = baixa;
        return (Guid.NewGuid(), null);
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
