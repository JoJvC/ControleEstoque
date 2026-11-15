using ControleEstoque.Shared.Results;

namespace ControleEstoque.Estoque.Domain;

/// <summary>Carga com os custos calculados por <see cref="CustoCarga"/>.</summary>
public sealed record AbastecimentoDetalhe(Abastecimento Carga, CustoCargaCalculado Custo);

public interface IAbastecimentoService
{
    /// <summary>Momento 1: quantidades por produto+marca e cascos vazios por tipo, sem valor.</summary>
    Task<Guid> RegistrarAsync(NovoAbastecimento abastecimento, CancellationToken cancellationToken);

    /// <summary>Momento 2: exige <c>estoque.custos</c> (ou <c>*</c>) do funcionário informado.</summary>
    Task<AbastecimentoDetalhe> LancarCustosAsync(
        Guid id, LancamentoCustos custos, CancellationToken cancellationToken);

    Task<AbastecimentoDetalhe> ObterAsync(Guid id, Guid funcionarioId, CancellationToken cancellationToken);

    Task<IReadOnlyList<AbastecimentoPendente>> ListarPendentesAsync(
        Guid funcionarioId, CancellationToken cancellationToken);
}

public sealed class AbastecimentoService : IAbastecimentoService
{
    private readonly IAbastecimentoRepository abastecimentos;
    private readonly IProdutoRepository produtos;
    private readonly ITipoCascoRepository tiposCasco;
    private readonly IPermissaoFuncionarioLookup permissoes;

    public AbastecimentoService(
        IAbastecimentoRepository abastecimentos,
        IProdutoRepository produtos,
        ITipoCascoRepository tiposCasco,
        IPermissaoFuncionarioLookup permissoes)
    {
        this.abastecimentos = abastecimentos;
        this.produtos = produtos;
        this.tiposCasco = tiposCasco;
        this.permissoes = permissoes;
    }

    public async Task<Guid> RegistrarAsync(NovoAbastecimento abastecimento, CancellationToken cancellationToken)
    {
        Validacao.EnumDefinido(abastecimento.TipoFrete, "TipoFrete");
        Validacao.IdPreenchido(abastecimento.FuncionarioId, "FuncionarioId");
        foreach (var item in abastecimento.Itens)
        {
            Validacao.IdPreenchido(item.ProdutoMarcaId, "ProdutoMarcaId");
        }

        foreach (var casco in abastecimento.Cascos)
        {
            Validacao.IdPreenchido(casco.TipoCascoId, "TipoCascoId");
        }

        if (abastecimento.Itens.Count + abastecimento.Cascos.Count == 0)
        {
            throw new RequestValidationException(
                "ITENS_OBRIGATORIOS", "Abastecimento deve ter ao menos um item ou casco.");
        }

        foreach (var item in abastecimento.Itens)
        {
            if (item.Quantidade <= 0)
            {
                throw new RequestValidationException(
                    "QUANTIDADE_INVALIDA", $"Quantidade inválida para a associação produto+marca {item.ProdutoMarcaId}.");
            }

            _ = await produtos.GetByProdutoMarcaAsync(item.ProdutoMarcaId, cancellationToken)
                ?? throw new EntityNotFoundException(
                    "PRODUTO_MARCA_NAO_ENCONTRADA",
                    $"Associação produto+marca {item.ProdutoMarcaId} não encontrada.");
        }

        foreach (var casco in abastecimento.Cascos)
        {
            if (casco.Quantidade <= 0)
            {
                throw new RequestValidationException(
                    "QUANTIDADE_INVALIDA", $"Quantidade inválida para o tipo de casco {casco.TipoCascoId}.");
            }

            _ = await tiposCasco.GetAsync(casco.TipoCascoId, cancellationToken)
                ?? throw new EntityNotFoundException(
                    "TIPO_CASCO_NAO_ENCONTRADO", $"Tipo de casco {casco.TipoCascoId} não encontrado.");
        }

        return await abastecimentos.CreateAsync(abastecimento, cancellationToken);
    }

    public async Task<AbastecimentoDetalhe> LancarCustosAsync(
        Guid id, LancamentoCustos custos, CancellationToken cancellationToken)
    {
        await PermissoesEstoque.ExigirCustosAsync(permissoes, custos.FuncionarioId, cancellationToken);
        var carga = await GetOuFalhaAsync(id, cancellationToken);

        if (custos.Frete < 0)
        {
            throw new RequestValidationException("FRETE_INVALIDO", "Frete não pode ser negativo.");
        }

        foreach (var linha in custos.Itens.Concat(custos.Cascos))
        {
            if (linha.CustoUnitario < 0)
            {
                throw new RequestValidationException("CUSTO_INVALIDO", "Custo unitário não pode ser negativo.");
            }
        }

        ExigirLinhasDaCarga(custos.Itens, carga.Itens);
        ExigirLinhasDaCarga(custos.Cascos, carga.Cascos);

        await abastecimentos.LancarCustosAsync(id, custos, cancellationToken);
        return Detalhe(await GetOuFalhaAsync(id, cancellationToken));
    }

    public async Task<AbastecimentoDetalhe> ObterAsync(
        Guid id, Guid funcionarioId, CancellationToken cancellationToken)
    {
        await PermissoesEstoque.ExigirCustosAsync(permissoes, funcionarioId, cancellationToken);
        return Detalhe(await GetOuFalhaAsync(id, cancellationToken));
    }

    public async Task<IReadOnlyList<AbastecimentoPendente>> ListarPendentesAsync(
        Guid funcionarioId, CancellationToken cancellationToken)
    {
        await PermissoesEstoque.ExigirCustosAsync(permissoes, funcionarioId, cancellationToken);
        return await abastecimentos.ListPendentesAsync(cancellationToken);
    }

    private static AbastecimentoDetalhe Detalhe(Abastecimento carga) =>
        new(carga, CustoCarga.Calcular([.. carga.Itens, .. carga.Cascos], carga.Frete));

    private static void ExigirLinhasDaCarga(IReadOnlyList<CustoLinha> enviadas, IReadOnlyList<LinhaCarga> daCarga)
    {
        var ids = daCarga.Select(l => l.Id).ToHashSet();
        var vistos = new HashSet<Guid>();
        foreach (var linha in enviadas)
        {
            if (!ids.Contains(linha.Id) || !vistos.Add(linha.Id))
            {
                throw new BusinessRuleException(
                    "LINHA_NAO_PERTENCE_A_CARGA", $"Linha {linha.Id} não pertence à carga ou veio repetida.");
            }
        }
    }

    private async Task<Abastecimento> GetOuFalhaAsync(Guid id, CancellationToken cancellationToken) =>
        await abastecimentos.GetAsync(id, cancellationToken)
            ?? throw new EntityNotFoundException("ABASTECIMENTO_NAO_ENCONTRADO", $"Abastecimento {id} não encontrado.");
}
