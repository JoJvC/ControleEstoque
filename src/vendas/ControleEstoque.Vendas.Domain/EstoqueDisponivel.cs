namespace ControleEstoque.Vendas.Domain;

/// <summary>Disponível para vender = saldo físico menos o reservado pelos pedidos EM_ANDAMENTO.</summary>
public static class EstoqueDisponivel
{
    public static long Disponivel(long saldo, long reservado) => saldo - reservado;

    public static bool Falta(long saldo, long reservado, long saida) => saldo - reservado - saida < 0;

    /// <summary>Na conclusão do pedido a reserva dele não conta contra ele: só a dos outros pedidos em andamento.</summary>
    public static bool FaltaNaConclusao(long saldo, long reservadoTotal, long reservaPropria, long saida) =>
        Falta(saldo, reservadoTotal - reservaPropria, saida);
}
