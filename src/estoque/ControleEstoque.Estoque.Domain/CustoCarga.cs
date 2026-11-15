namespace ControleEstoque.Estoque.Domain;

/// <summary>Custos calculados de uma carga; os nulos só existem enquanto a carga está pendente.</summary>
public sealed record CustoCargaCalculado(
    bool Pendente,
    bool FreteFaltando,
    int LinhasSemCusto,
    int TotalUnidades,
    decimal? CustoTotal,
    IReadOnlyDictionary<Guid, decimal> CustoDaUnidade);

public static class CustoCarga
{
    /// <summary>
    /// Custo da unidade = custo unitário + frete ÷ total de unidades (itens e cascos, todas as linhas).
    /// Soma sem arredondar no meio; unidade com 4 casas e total com 2, AwayFromZero.
    /// A unidade só sai para a linha com custo e com frete lançado.
    /// </summary>
    public static CustoCargaCalculado Calcular(IReadOnlyList<LinhaCarga> linhas, decimal? frete)
    {
        var totalUnidades = linhas.Sum(l => l.Quantidade);
        var semCusto = linhas.Count(l => l.CustoUnitario is null);
        var pendente = frete is null || semCusto > 0;

        var custoDaUnidade = new Dictionary<Guid, decimal>();
        if (frete is { } f && totalUnidades > 0)
        {
            var fretePorUnidade = f / totalUnidades;
            foreach (var l in linhas.Where(l => l.CustoUnitario is not null))
            {
                custoDaUnidade[l.Id] = Math.Round(
                    l.CustoUnitario!.Value + fretePorUnidade, 4, MidpointRounding.AwayFromZero);
            }
        }

        decimal? total = pendente
            ? null
            : Math.Round(
                linhas.Sum(l => l.Quantidade * l.CustoUnitario!.Value) + frete!.Value,
                2, MidpointRounding.AwayFromZero);

        return new CustoCargaCalculado(pendente, frete is null, semCusto, totalUnidades, total, custoDaUnidade);
    }
}
