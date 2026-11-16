namespace ControleEstoque.Vendas.Domain;

public static class TransicoesPedido
{
    public static bool PodeIniciar(StatusPedido status) => status == StatusPedido.PENDENTE;

    public static bool PodeConcluir(StatusPedido status) => status == StatusPedido.EM_ANDAMENTO;

    public static bool PodeCancelar(StatusPedido status) =>
        status is StatusPedido.PENDENTE or StatusPedido.EM_ANDAMENTO;
}
