using ControleEstoque.Vendas.Domain;

namespace ControleEstoque.Vendas.Tests;

public sealed class EstoqueDisponivelTests
{
    [Theory]
    [InlineData(10, 0, 10, false)]
    [InlineData(10, 3, 7, false)]
    [InlineData(10, 3, 8, true)]
    [InlineData(2, 5, 1, true)]
    public void Falta_ConfereSaldoMenosReservadoMenosSaida(long saldo, long reservado, long saida, bool falta) =>
        Assert.Equal(falta, EstoqueDisponivel.Falta(saldo, reservado, saida));

    [Theory]
    [InlineData(5, 7, 3, 3, true)]   // outro pedido 4 + próprio 3: disponível 5 − 4 = 1 < 3
    [InlineData(5, 7, 3, 1, false)]  // com saída 1: OK
    [InlineData(3, 3, 3, 3, false)]  // só a reserva própria: não conta contra ela
    [InlineData(10, 3, 0, 8, true)]  // sem reserva própria equivale a Falta
    [InlineData(10, 3, 0, 7, false)]
    public void FaltaNaConclusao_IgnoraAReservaPropriaMasContaADosOutros(
        long saldo, long reservadoTotal, long reservaPropria, long saida, bool falta) =>
        Assert.Equal(falta, EstoqueDisponivel.FaltaNaConclusao(saldo, reservadoTotal, reservaPropria, saida));

    [Theory]
    [InlineData(10, 3, 8)]
    [InlineData(2, 5, 1)]
    [InlineData(10, 0, 10)]
    public void FaltaNaConclusao_SemReservaPropria_EquivaleAFalta(long saldo, long reservado, long saida) =>
        Assert.Equal(
            EstoqueDisponivel.Falta(saldo, reservado, saida),
            EstoqueDisponivel.FaltaNaConclusao(saldo, reservado, 0, saida));

    [Theory]
    [InlineData(StatusPedido.PENDENTE, false)]
    [InlineData(StatusPedido.EM_ANDAMENTO, true)]
    [InlineData(StatusPedido.CONCLUIDO, false)]
    [InlineData(StatusPedido.CANCELADO, false)]
    public void PodeConcluir_SoDeEmAndamento(StatusPedido status, bool esperado) =>
        Assert.Equal(esperado, TransicoesPedido.PodeConcluir(status));

    [Theory]
    [InlineData(10, 0, 10)]
    [InlineData(10, 3, 7)]
    [InlineData(2, 5, -3)]
    public void Disponivel_ESaldoMenosReservado(long saldo, long reservado, long esperado) =>
        Assert.Equal(esperado, EstoqueDisponivel.Disponivel(saldo, reservado));

    [Theory]
    [InlineData(StatusPedido.PENDENTE, true)]
    [InlineData(StatusPedido.EM_ANDAMENTO, false)]
    [InlineData(StatusPedido.CONCLUIDO, false)]
    [InlineData(StatusPedido.CANCELADO, false)]
    public void PodeIniciar_SoAPartirDePendente(StatusPedido status, bool esperado) =>
        Assert.Equal(esperado, TransicoesPedido.PodeIniciar(status));

    [Theory]
    [InlineData(StatusPedido.PENDENTE, true)]
    [InlineData(StatusPedido.EM_ANDAMENTO, true)]
    [InlineData(StatusPedido.CONCLUIDO, false)]
    [InlineData(StatusPedido.CANCELADO, false)]
    public void PodeCancelar_SoDePendenteOuEmAndamento(StatusPedido status, bool esperado) =>
        Assert.Equal(esperado, TransicoesPedido.PodeCancelar(status));
}
