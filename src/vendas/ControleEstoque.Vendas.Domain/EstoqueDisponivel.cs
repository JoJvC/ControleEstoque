namespace ControleEstoque.Vendas.Domain;

/// <summary>Disponível para vender = saldo físico menos o reservado pelos pedidos EM_ANDAMENTO.</summary>
public static class EstoqueDisponivel
{
    public static long Disponivel(long saldo, long reservado) => saldo - reservado;

    public static bool Falta(long saldo, long reservado, long saida) => saldo - reservado - saida < 0;
}
