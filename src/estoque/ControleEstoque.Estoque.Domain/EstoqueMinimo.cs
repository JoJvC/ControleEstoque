namespace ControleEstoque.Estoque.Domain;

/// <summary>Espelho da regra de vw_estoque_atual.abaixo_minimo (infra/postgres/init.sql).</summary>
public static class EstoqueMinimo
{
    public static bool Abaixo(long quantidade, int minimo) => minimo > 0 && quantidade < minimo;
}
