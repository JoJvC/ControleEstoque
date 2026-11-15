using ControleEstoque.Shared.Results;

namespace ControleEstoque.Estoque.Domain;

/// <summary>
/// Item de venda de um produto+marca (não excluído); receita = total_item, que inclui o vasilhame pago.
/// <paramref name="ReceitaVasilhame"/> é a parte dela que é de vasilhame pago (<see cref="LucroPorProduto.RatearVasilhame"/>).
/// </summary>
public sealed record VendaProdutoMarcaDia(
    Guid ProdutoMarcaId,
    Guid ProdutoId,
    string ProdutoNome,
    Guid MarcaId,
    string MarcaNome,
    DateOnly Dia,
    int Quantidade,
    decimal Receita,
    decimal ReceitaVasilhame = 0m);

/// <summary>Carga com as linhas de itens e cascos, para o rateio do frete.</summary>
public sealed record CargaCusto(
    DateOnly Data, decimal? Frete, IReadOnlyList<LinhaCarga> Itens, IReadOnlyList<LinhaCarga> Cascos);

public sealed record LinhaLucro(
    Guid ProdutoMarcaId,
    Guid ProdutoId,
    string ProdutoNome,
    Guid MarcaId,
    string MarcaNome,
    int QuantidadeVendida,
    decimal Receita,
    decimal ReceitaVasilhame,
    decimal? CustoProdutos,
    decimal? Frete,
    decimal? Lucro,
    bool CustoPendente);

public sealed record TotaisLucro(
    int QuantidadeVendida, decimal Receita, decimal ReceitaVasilhame, decimal CustoProdutos, decimal Frete,
    decimal Lucro, int LinhasPendentes);

public sealed record RelatorioLucro(
    DateOnly? Inicio, DateOnly? Fim, IReadOnlyList<LinhaLucro> Linhas, TotaisLucro Totais);

public static class LucroPorProduto
{
    /// <summary>
    /// Vasilhame pago de um item = total_item × (quantidade × preço do vasilhame) ÷ bruto do item
    /// (quantidade × (preço unitário + preço do vasilhame)), o que respeita o desconto. Arredondado por item
    /// (2 casas, AwayFromZero), para a receita do produto (total_item − vasilhame) fechar em centavos.
    /// </summary>
    public static decimal RatearVasilhame(
        decimal totalItem, int quantidade, decimal precoUnitario, bool pagouVasilhame, decimal? precoVasilhame)
    {
        if (!pagouVasilhame || precoVasilhame is not { } vasilhame)
        {
            return 0m;
        }

        var bruto = quantidade * (precoUnitario + vasilhame);
        return bruto <= 0 ? 0m : Arredondar(totalItem * (quantidade * vasilhame) / bruto);
    }

    /// <summary>
    /// Para cada dia de venda, custo unitário e frete por unidade médios (ponderados pela quantidade)
    /// das linhas do produto+marca nas cargas completas com data até o dia. Sem arredondar no meio;
    /// cada valor da linha é arredondado no fim (2 casas, AwayFromZero). Sem carga completa até algum
    /// dia de venda, a linha fica pendente (custo, frete e lucro nulos).
    /// </summary>
    public static RelatorioLucro Calcular(
        DateOnly? inicio, DateOnly? fim,
        IReadOnlyList<VendaProdutoMarcaDia> vendas, IReadOnlyList<CargaCusto> cargas)
    {
        var completas = new List<(DateOnly Data, IReadOnlyList<LinhaCarga> Itens, decimal FretePorUnidade)>();
        foreach (var carga in cargas)
        {
            var linhas = carga.Itens.Concat(carga.Cascos).ToList();
            var custo = CustoCarga.Calcular(linhas, carga.Frete);
            if (!custo.Pendente && custo.TotalUnidades > 0)
            {
                completas.Add((carga.Data, carga.Itens, carga.Frete!.Value / custo.TotalUnidades));
            }
        }

        var linhasLucro = new List<LinhaLucro>();
        foreach (var grupo in vendas.GroupBy(v => v.ProdutoMarcaId))
        {
            var primeira = grupo.First();
            decimal custoProdutos = 0, frete = 0;
            var pendente = false;
            foreach (var venda in grupo)
            {
                var qtd = 0;
                decimal somaCusto = 0, somaFrete = 0;
                foreach (var carga in completas.Where(c => c.Data <= venda.Dia))
                {
                    foreach (var l in carga.Itens.Where(l => l.ReferenciaId == venda.ProdutoMarcaId))
                    {
                        qtd += l.Quantidade;
                        somaCusto += l.Quantidade * l.CustoUnitario!.Value;
                        somaFrete += l.Quantidade * carga.FretePorUnidade;
                    }
                }

                if (qtd == 0)
                {
                    pendente = true;
                    break;
                }

                custoProdutos += venda.Quantidade * (somaCusto / qtd);
                frete += venda.Quantidade * (somaFrete / qtd);
            }

            var receitaVasilhame = grupo.Sum(v => v.ReceitaVasilhame);
            var receita = grupo.Sum(v => v.Receita) - receitaVasilhame;
            decimal? custoR = null, freteR = null, lucro = null;
            if (!pendente)
            {
                custoR = Arredondar(custoProdutos);
                freteR = Arredondar(frete);
                lucro = receita - custoR - freteR;
            }

            linhasLucro.Add(new LinhaLucro(
                primeira.ProdutoMarcaId, primeira.ProdutoId, primeira.ProdutoNome, primeira.MarcaId,
                primeira.MarcaNome, grupo.Sum(v => v.Quantidade), receita, receitaVasilhame, custoR, freteR, lucro, pendente));
        }

        var ordenadas = linhasLucro
            .OrderBy(l => l.ProdutoNome, StringComparer.OrdinalIgnoreCase)
            .ThenBy(l => l.MarcaNome, StringComparer.OrdinalIgnoreCase)
            .ToList();
        var ok = ordenadas.Where(l => !l.CustoPendente).ToList();
        var totais = new TotaisLucro(
            ordenadas.Sum(l => l.QuantidadeVendida),
            ordenadas.Sum(l => l.Receita),
            ordenadas.Sum(l => l.ReceitaVasilhame),
            ok.Sum(l => l.CustoProdutos!.Value),
            ok.Sum(l => l.Frete!.Value),
            ok.Sum(l => l.Lucro!.Value),
            ordenadas.Count - ok.Count);
        return new RelatorioLucro(inicio, fim, ordenadas, totais);
    }

    private static decimal Arredondar(decimal valor) => Math.Round(valor, 2, MidpointRounding.AwayFromZero);
}

public interface IRelatorioLucroRepository
{
    /// <summary>Itens vendidos no período, com produto+marca e dia (período inclusivo, nulo = sem limite).</summary>
    Task<IReadOnlyList<VendaProdutoMarcaDia>> ListVendasAsync(
        DateOnly? inicio, DateOnly? fim, CancellationToken cancellationToken);

    /// <summary>Cargas com data até <paramref name="fim"/> que têm algum dos produto+marcas, com todas as linhas.</summary>
    Task<IReadOnlyList<CargaCusto>> ListCargasAsync(
        DateOnly? fim, IReadOnlyList<Guid> produtoMarcaIds, CancellationToken cancellationToken);
}

public interface ILucroService
{
    /// <summary>Exige <c>estoque.custos</c> (ou <c>*</c>) do funcionário informado.</summary>
    Task<RelatorioLucro> ObterAsync(
        DateOnly? inicio, DateOnly? fim, Guid funcionarioId, CancellationToken cancellationToken);
}

public sealed class LucroService : ILucroService
{
    private readonly IRelatorioLucroRepository repositorio;
    private readonly IPermissaoFuncionarioLookup permissoes;

    public LucroService(IRelatorioLucroRepository repositorio, IPermissaoFuncionarioLookup permissoes)
    {
        this.repositorio = repositorio;
        this.permissoes = permissoes;
    }

    public async Task<RelatorioLucro> ObterAsync(
        DateOnly? inicio, DateOnly? fim, Guid funcionarioId, CancellationToken cancellationToken)
    {
        Validacao.Periodo(inicio, fim);
        await PermissoesEstoque.ExigirCustosAsync(permissoes, funcionarioId, cancellationToken);
        var vendas = await repositorio.ListVendasAsync(inicio, fim, cancellationToken);
        var cargas = vendas.Count == 0
            ? []
            : await repositorio.ListCargasAsync(
                fim, [.. vendas.Select(v => v.ProdutoMarcaId).Distinct()], cancellationToken);
        return LucroPorProduto.Calcular(inicio, fim, vendas, cargas);
    }
}
