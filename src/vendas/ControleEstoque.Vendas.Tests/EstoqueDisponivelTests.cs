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
