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

internal sealed class FakeTipoCascoRepository : ITipoCascoRepository
{
    private readonly Dictionary<Guid, TipoCasco> tipos = new();

    public TipoCasco Add(string nome, Guid? marcaId = null, bool aceitaSucata = false, decimal precoVasilhame = 0m)
    {
        var tipo = new TipoCasco(Guid.NewGuid(), nome, marcaId, null, precoVasilhame, aceitaSucata);
        tipos[tipo.Id] = tipo;
        return tipo;
    }

    public Task CreateAsync(TipoCasco tipoCasco, CancellationToken cancellationToken)
    {
        tipos[tipoCasco.Id] = tipoCasco;
        return Task.CompletedTask;
    }

    public Task<bool> UpdateAsync(TipoCasco tipoCasco, CancellationToken cancellationToken)
    {
        if (!tipos.ContainsKey(tipoCasco.Id))
        {
            return Task.FromResult(false);
        }

        tipos[tipoCasco.Id] = tipoCasco;
        return Task.FromResult(true);
    }

    public Task<TipoCasco?> GetAsync(Guid id, CancellationToken cancellationToken) =>
        Task.FromResult(tipos.GetValueOrDefault(id));

    public Task<IReadOnlyList<TipoCasco>> ListAsync(CancellationToken cancellationToken) =>
        Task.FromResult<IReadOnlyList<TipoCasco>>(tipos.Values.ToList());

    /// <summary>Tipos que o teste declara usados por produto ou associação.</summary>
    public HashSet<Guid> EmUso { get; } = [];

    /// <summary>Saldo de sucata por tipo; ausente = 0.</summary>
    public Dictionary<Guid, long> SaldosSucata { get; } = [];

    public Task<bool> EmUsoAsync(Guid id, CancellationToken cancellationToken) =>
        Task.FromResult(EmUso.Contains(id));

    public Task<long> GetSaldoSucataAsync(Guid id, CancellationToken cancellationToken) =>
        Task.FromResult(SaldosSucata.GetValueOrDefault(id));
}

internal sealed class FakeProdutoRepository : IProdutoRepository
{
    private readonly Dictionary<Guid, Produto> produtos = new();

    public void Add(Produto produto) => produtos[produto.Id] = produto;

    public Task CreateAsync(Produto produto, CancellationToken cancellationToken)
    {
        produtos[produto.Id] = produto with { Marcas = [] };
        return Task.CompletedTask;
    }

    public Task<bool> UpdateAsync(Produto produto, CancellationToken cancellationToken)
    {
        if (!produtos.TryGetValue(produto.Id, out var atual))
        {
            return Task.FromResult(false);
        }

        produtos[produto.Id] = produto with { Marcas = atual.Marcas };
        return Task.FromResult(true);
    }

    public Task<Produto?> GetAsync(Guid id, CancellationToken cancellationToken) =>
        Task.FromResult(produtos.GetValueOrDefault(id));

    public Task<Produto?> GetByProdutoMarcaAsync(Guid produtoMarcaId, CancellationToken cancellationToken) =>
        Task.FromResult(produtos.Values.FirstOrDefault(p => p.Marcas.Any(m => m.Id == produtoMarcaId)));

    public Task<IReadOnlyList<Produto>> ListAsync(
        TipoProduto? tipo, Guid? marcaId, string? categoria, CancellationToken cancellationToken) =>
        Task.FromResult<IReadOnlyList<Produto>>(produtos.Values
            .Where(p => tipo is null || p.Tipo == tipo)
            .Where(p => marcaId is null || p.Marcas.Any(m => m.MarcaId == marcaId))
            .Where(p => categoria is null || p.Categoria == categoria)
            .ToList());

    public Task AddMarcaAsync(Guid produtoId, ProdutoMarca marca, CancellationToken cancellationToken)
    {
        var produto = produtos[produtoId];
        produtos[produtoId] = produto with { Marcas = [.. produto.Marcas, marca] };
        return Task.CompletedTask;
    }

    public Task<bool> UpdateMarcaAsync(Guid produtoId, ProdutoMarca marca, CancellationToken cancellationToken)
    {
        var produto = produtos[produtoId];
        if (produto.Marcas.All(m => m.Id != marca.Id))
        {
            return Task.FromResult(false);
        }

        produtos[produtoId] = produto with
        {
            Marcas = produto.Marcas.Select(m => m.Id == marca.Id ? marca with { Quantidade = m.Quantidade } : m).ToList()
        };
        return Task.FromResult(true);
    }

    public Task<bool> SetFotoAsync(Guid produtoMarcaId, string fotoUrl, CancellationToken cancellationToken)
    {
        var produto = produtos.Values.FirstOrDefault(p => p.Marcas.Any(m => m.Id == produtoMarcaId));
        if (produto is null)
        {
            return Task.FromResult(false);
        }

        produtos[produto.Id] = produto with
        {
            Marcas = produto.Marcas.Select(m => m.Id == produtoMarcaId ? m with { FotoUrl = fotoUrl } : m).ToList()
        };
        return Task.FromResult(true);
    }
}

/// <summary>
/// Razão em memória que cumpre o contrato C0: a checagem de saldo e a gravação são atômicas,
/// sob trava. O atraso entre ler e gravar faz a corrida aparecer se a trava for retirada.
/// Linhas de estoque: produto+marca (Situacao nula) e tipo de casco + situação.
/// </summary>
internal sealed class FakeEstoqueRepository : IEstoqueRepository
{
    private readonly Dictionary<(Guid Id, SituacaoCasco? Situacao), long> saldos = new();
    private readonly SemaphoreSlim trava = new(1, 1);

    /// <summary>Simula gravação atômica que recusa, mesmo com a leitura avulsa mostrando saldo alto.</summary>
    public bool RecusarSempre { get; set; }

    public void SetSaldo(Guid produtoMarcaId, long saldo) => saldos[(produtoMarcaId, null)] = saldo;

    public long GetSaldo(Guid produtoMarcaId) => saldos.GetValueOrDefault((produtoMarcaId, null));

    public void SetSaldoCasco(Guid tipoCascoId, SituacaoCasco situacao, long saldo) =>
        saldos[(tipoCascoId, situacao)] = saldo;

    public long GetSaldoCasco(Guid tipoCascoId, SituacaoCasco situacao) =>
        saldos.GetValueOrDefault((tipoCascoId, situacao));

    /// <summary>Lista devolvida por GetEstoqueAsync; vazia por padrão.</summary>
    public IReadOnlyList<EstoqueItem> Itens { get; set; } = [];

    /// <summary>Lista devolvida por GetEstoqueCascosAsync; vazia por padrão.</summary>
    public IReadOnlyList<EstoqueCasco> Cascos { get; set; } = [];

    public Task<IReadOnlyList<EstoqueItem>> GetEstoqueAsync(CancellationToken cancellationToken) =>
        Task.FromResult(Itens);

    public Task<IReadOnlyList<EstoqueCasco>> GetEstoqueCascosAsync(CancellationToken cancellationToken) =>
        Task.FromResult(Cascos);

    public async Task<SaldoInsuficiente?> AddAjusteAsync(
        Guid produtoMarcaId, int quantidade, string? observacao, CancellationToken cancellationToken) =>
        await AplicarAsync([((produtoMarcaId, (SituacaoCasco?)null), quantidade)]);

    public async Task<SaldoInsuficiente?> AddAjusteCascoAsync(
        Guid tipoCascoId, SituacaoCasco situacao, int quantidade, string? observacao,
        CancellationToken cancellationToken) =>
        await AplicarAsync([((tipoCascoId, (SituacaoCasco?)situacao), quantidade)]);

    /// <summary>Aplica os deltas de uma vez; se alguma linha ficar negativa, não grava nada.</summary>
    public async Task<SaldoInsuficiente?> AplicarAsync(
        IReadOnlyList<((Guid Id, SituacaoCasco? Situacao) Chave, long Delta)> deltas)
    {
        await trava.WaitAsync();
        try
        {
            var lidos = deltas.ToDictionary(d => d.Chave, d => saldos.GetValueOrDefault(d.Chave));
            await Task.Delay(5); // janela entre ler e gravar: expõe a corrida sem a trava
            foreach (var (chave, delta) in deltas)
            {
                if (RecusarSempre || (delta < 0 && lidos[chave] + delta < 0))
                {
                    return new SaldoInsuficiente(chave.Id, lidos[chave], -delta);
                }
            }

            foreach (var (chave, delta) in deltas)
            {
                saldos[chave] = lidos[chave] + delta;
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

    public IReadOnlyList<MovimentoCasco> UltimosMovimentos { get; private set; } = [];

    public async Task<(Guid Id, SaldoInsuficiente? Falta)> CreateAsync(
        NovaBaixaCasco baixa, IReadOnlyList<MovimentoCasco> movimentos, CancellationToken cancellationToken)
    {
        var falta = await estoque.AplicarAsync(
            movimentos.Select(m => ((baixa.TipoCascoId, (SituacaoCasco?)m.Situacao), (long)m.Quantidade)).ToList());
        if (falta is not null)
        {
            return (Guid.Empty, falta);
        }

        UltimaBaixa = baixa;
        UltimosMovimentos = movimentos;
        return (Guid.NewGuid(), null);
    }
}

internal sealed class FakeFotoStorage : IFotoStorage
{
    public Task<string> SaveAsync(
        Guid produtoMarcaId, Stream content, string extension, CancellationToken cancellationToken) =>
        Task.FromResult($"produtos/{produtoMarcaId}{extension}");

    public Task<(Stream Content, string ContentType)?> OpenAsync(
        string fotoUrl, CancellationToken cancellationToken) =>
        Task.FromResult<(Stream, string)?>(null);
}
