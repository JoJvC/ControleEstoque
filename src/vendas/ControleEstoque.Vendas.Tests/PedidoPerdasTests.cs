using ControleEstoque.Shared.Results;
using ControleEstoque.Vendas.Domain;

namespace ControleEstoque.Vendas.Tests;

public sealed class PedidoPerdasTests
{
    private readonly FakeVendaLookup lookup = new();
    private readonly FakeVendaRepository vendas;
    private readonly FakePedidoRepository pedidos;
    private readonly PedidoService sut;

    private readonly Guid clienteId = Guid.NewGuid();
    private readonly Guid funcionarioId = Guid.NewGuid();
    private readonly Guid entregador = Guid.NewGuid();
    private readonly Guid outroEntregador = Guid.NewGuid();
    private readonly TipoCascoVenda tipo;
    private readonly ProdutoVenda agua;

    public PedidoPerdasTests()
    {
        vendas = new FakeVendaRepository(lookup.SaldosEstoque);
        pedidos = new FakePedidoRepository(lookup.SaldosEstoque, vendas.Reservas);
        vendas.Pedidos = pedidos;
        sut = new PedidoService(pedidos, lookup);
        lookup.Clientes.Add(clienteId);
        foreach (var id in new[] { funcionarioId, entregador, outroEntregador })
        {
            lookup.Funcionarios.Add(id);
        }

        tipo = lookup.AddTipoCasco(10m, aceitaSucata: true);
        agua = lookup.AddProduto(TipoProduto.RETORNAVEL, "Água 20L", 10, tipoCascoProduto: tipo.Id);
        pedidos.SaldosCasco[(tipo.Id, SituacaoCasco.VAZIO)] = 3;
    }

    private async Task<Pedido> PedidoConcluidoAsync(
        StatusPedido status = StatusPedido.CONCLUIDO, params Guid[] funcionarios)
    {
        var pedido = await sut.CriarAsync(
            new NovoPedido(
                clienteId, funcionarioId, null, [new ItemVenda(agua.ProdutoId, agua.MarcaId, 1, 8m, null)],
                funcionarios.Length == 0 ? [entregador, outroEntregador] : funcionarios, null),
            CancellationToken.None);
        pedidos.ForcarStatus(pedido.Id, status);
        return pedido;
    }

    private OcorrenciaPerda Cheio(int quantidade, MotivoPerda motivo) =>
        new(GalaoPerda.CHEIO, agua.ProdutoId, agua.MarcaId, null, quantidade, motivo);

    private OcorrenciaPerda Vazio(int quantidade, MotivoPerda motivo, Guid? tipoId = null) =>
        new(GalaoPerda.VAZIO, null, null, tipoId ?? tipo.Id, quantidade, motivo);

    private Task<Pedido> Registrar(Pedido pedido, params OcorrenciaPerda[] ocorrencias) =>
        sut.RegistrarPerdasAsync(pedido.Id, funcionarioId, ocorrencias, CancellationToken.None);

    private long Sucata => pedidos.SaldosCasco.GetValueOrDefault((tipo.Id, SituacaoCasco.SUCATA));

    private long Vazios => pedidos.SaldosCasco.GetValueOrDefault((tipo.Id, SituacaoCasco.VAZIO));

    [Fact]
    public async Task CheioQuebrado_BaixaProdutoESobeSucata()
    {
        var pedido = await PedidoConcluidoAsync();

        await Registrar(pedido, Cheio(1, MotivoPerda.QUEBRADO));

        Assert.Equal(9, lookup.SaldosEstoque[agua.ProdutoMarcaId]);
        Assert.Equal(1, Sucata);
        var perda = Assert.Single(pedidos.Perdas);
        Assert.Equal(MotivoPerda.QUEBRADO, perda.Motivo);
        Assert.Equal(agua.ProdutoMarcaId, perda.ProdutoMarcaId);
        Assert.Equal(tipo.Id, perda.TipoCascoId);
        Assert.Contains(perda.Movimentos, m => m.Tipo == TipoMovimentoPerda.BAIXA_QUEBRA && m.Quantidade == -1);
    }

    [Fact]
    public async Task CheioPerdido_BaixaPerdaSemSucata()
    {
        var pedido = await PedidoConcluidoAsync();

        await Registrar(pedido, Cheio(1, MotivoPerda.PERDIDO));

        Assert.Equal(9, lookup.SaldosEstoque[agua.ProdutoMarcaId]);
        Assert.Equal(0, Sucata);
        var perda = Assert.Single(pedidos.Perdas);
        Assert.Equal(MotivoPerda.PERDIDO, perda.Motivo);
        Assert.Equal(TipoMovimentoPerda.BAIXA_PERDA, Assert.Single(perda.Movimentos).Tipo);
    }

    [Fact]
    public async Task VazioQuebrado_BaixaVazioESobeSucata()
    {
        var pedido = await PedidoConcluidoAsync();

        await Registrar(pedido, Vazio(1, MotivoPerda.QUEBRADO));

        Assert.Equal(2, Vazios);
        Assert.Equal(1, Sucata);
        Assert.Equal(10, lookup.SaldosEstoque[agua.ProdutoMarcaId]);
        Assert.Null(Assert.Single(pedidos.Perdas).ProdutoMarcaId);
    }

    [Fact]
    public async Task VazioPerdido_BaixaVazioSemSucata()
    {
        var pedido = await PedidoConcluidoAsync();

        await Registrar(pedido, Vazio(1, MotivoPerda.PERDIDO));

        Assert.Equal(2, Vazios);
        Assert.Equal(0, Sucata);
    }

    [Fact]
    public async Task TipoQueNaoAceitaSucata_QuebraNaoGeraSucata()
    {
        var semSucata = lookup.AddTipoCasco(10m, aceitaSucata: false);
        pedidos.SaldosCasco[(semSucata.Id, SituacaoCasco.VAZIO)] = 5;
        var pedido = await PedidoConcluidoAsync();

        await Registrar(pedido, Vazio(2, MotivoPerda.QUEBRADO, semSucata.Id));

        Assert.Equal(3, pedidos.SaldosCasco[(semSucata.Id, SituacaoCasco.VAZIO)]);
        Assert.False(pedidos.SaldosCasco.ContainsKey((semSucata.Id, SituacaoCasco.SUCATA)));
    }

    [Fact]
    public async Task Responsaveis_SaoOsFuncionariosDoPedido_ENenhumLancamentoDeFuncionario()
    {
        var pedido = await PedidoConcluidoAsync();

        await Registrar(pedido, Cheio(1, MotivoPerda.QUEBRADO));

        var baixaId = Assert.Single(pedidos.Perdas).Id;
        Assert.Equal(
            new[] { entregador, outroEntregador }.Order(),
            pedidos.Responsaveis.Where(r => r.BaixaId == baixaId).Select(r => r.FuncionarioId).Order());
        // O IPedidoRepository não tem porta para lancamentos_funcionario: nada a gravar na conta do funcionário.
    }

    [Theory]
    [InlineData(StatusPedido.PENDENTE)]
    [InlineData(StatusPedido.EM_ANDAMENTO)]
    [InlineData(StatusPedido.CANCELADO)]
    public async Task PedidoNaoConcluido_Lanca409_ENadaGravado(StatusPedido status)
    {
        var pedido = await PedidoConcluidoAsync(status);

        var ex = await Assert.ThrowsAsync<ConflictException>(() => Registrar(pedido, Cheio(1, MotivoPerda.PERDIDO)));

        Assert.Equal("PEDIDO_STATUS_INVALIDO", ex.Code);
        Assert.Empty(pedidos.Perdas);
    }

    [Fact]
    public async Task PedidoInexistente_Lanca404()
    {
        var ex = await Assert.ThrowsAsync<EntityNotFoundException>(() =>
            sut.RegistrarPerdasAsync(Guid.NewGuid(), funcionarioId, [Cheio(1, MotivoPerda.PERDIDO)], CancellationToken.None));

        Assert.Equal("PEDIDO_NAO_ENCONTRADO", ex.Code);
    }

    [Fact]
    public async Task VazioSemSaldo_Lanca422_ENadaGravado()
    {
        var pedido = await PedidoConcluidoAsync();

        await Assert.ThrowsAsync<InsufficientStockException>(() => Registrar(pedido, Vazio(5, MotivoPerda.PERDIDO)));

        Assert.Empty(pedidos.Perdas);
        Assert.Empty(pedidos.Responsaveis);
        Assert.Equal(3, Vazios);
    }

    [Fact]
    public async Task CheioSemSaldo_Lanca422_ENadaGravado()
    {
        var pedido = await PedidoConcluidoAsync();

        await Assert.ThrowsAsync<InsufficientStockException>(() => Registrar(
            pedido, Vazio(1, MotivoPerda.PERDIDO), Cheio(11, MotivoPerda.PERDIDO)));

        Assert.Empty(pedidos.Perdas);
        Assert.Equal(10, lookup.SaldosEstoque[agua.ProdutoMarcaId]);
        Assert.Equal(3, Vazios);
    }

    [Fact]
    public async Task CheioComReservaDeOutroPedido_ConferePeloSaldoFisico()
    {
        lookup.SaldosEstoque[agua.ProdutoMarcaId] = 1;
        vendas.Reservas[agua.ProdutoMarcaId] = 1; // outro pedido EM_ANDAMENTO reserva o único galão
        var pedido = await PedidoConcluidoAsync();

        await Registrar(pedido, Cheio(1, MotivoPerda.PERDIDO));

        Assert.Equal(0, lookup.SaldosEstoque[agua.ProdutoMarcaId]);
    }

    [Fact]
    public async Task ProdutoSemTipoDeCasco_Lanca422()
    {
        var descartavel = lookup.AddProduto(TipoProduto.DESCARTAVEL, "Carvão", 10);
        var pedido = await PedidoConcluidoAsync();

        var ex = await Assert.ThrowsAsync<BusinessRuleException>(() => Registrar(
            pedido, new OcorrenciaPerda(
                GalaoPerda.CHEIO, descartavel.ProdutoId, descartavel.MarcaId, null, 1, MotivoPerda.PERDIDO)));

        Assert.Equal("PRODUTO_SEM_TIPO_CASCO", ex.Code);
        Assert.Empty(pedidos.Perdas);
    }

    [Fact]
    public async Task PedidoSemFuncionarios_Lanca422ResponsavelObrigatorio()
    {
        var pedido = await sut.CriarAsync(
            new NovoPedido(
                clienteId, funcionarioId, null, [new ItemVenda(agua.ProdutoId, agua.MarcaId, 1, 8m, null)], [], null),
            CancellationToken.None);
        pedidos.ForcarStatus(pedido.Id, StatusPedido.CONCLUIDO);

        var ex = await Assert.ThrowsAsync<BusinessRuleException>(() => Registrar(pedido, Cheio(1, MotivoPerda.PERDIDO)));

        Assert.Equal("RESPONSAVEL_OBRIGATORIO", ex.Code);
    }

    [Fact]
    public async Task CorpoInvalido_Lanca400()
    {
        var pedido = await PedidoConcluidoAsync();

        await Assert.ThrowsAsync<RequestValidationException>(() => Registrar(pedido));
        await Assert.ThrowsAsync<RequestValidationException>(() => Registrar(pedido, Cheio(0, MotivoPerda.PERDIDO)));
        await Assert.ThrowsAsync<RequestValidationException>(() => Registrar(
            pedido, new OcorrenciaPerda(GalaoPerda.VAZIO, null, null, null, 1, MotivoPerda.PERDIDO)));
        await Assert.ThrowsAsync<RequestValidationException>(() => Registrar(
            pedido, new OcorrenciaPerda(GalaoPerda.CHEIO, agua.ProdutoId, null, null, 1, MotivoPerda.PERDIDO)));
        await Assert.ThrowsAsync<RequestValidationException>(() => Registrar(
            pedido, Cheio(1, (MotivoPerda)9)));
        Assert.Empty(pedidos.Perdas);
    }

    [Fact]
    public async Task ObterPedido_TrazAsPerdasRegistradas()
    {
        var pedido = await PedidoConcluidoAsync();

        var resultado = await Registrar(pedido, Cheio(2, MotivoPerda.QUEBRADO), Vazio(1, MotivoPerda.PERDIDO));
        var lido = await sut.ObterAsync(pedido.Id, CancellationToken.None);

        Assert.Equal(2, resultado.Perdas!.Count);
        var cheio = lido.Perdas!.Single(p => p.Galao == GalaoPerda.CHEIO);
        Assert.Equal((agua.ProdutoId, agua.MarcaId, 2, MotivoPerda.QUEBRADO), (cheio.ProdutoId, cheio.MarcaId, cheio.Quantidade, cheio.Motivo));
        Assert.Equal(tipo.Id, lido.Perdas!.Single(p => p.Galao == GalaoPerda.VAZIO).TipoCascoId);
    }
}
