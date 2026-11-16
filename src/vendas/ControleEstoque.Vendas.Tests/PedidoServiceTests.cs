using ControleEstoque.Shared.Results;
using ControleEstoque.Vendas.Domain;

namespace ControleEstoque.Vendas.Tests;

public sealed class PedidoServiceTests
{
    private static readonly DateTimeOffset Agora = new(2026, 11, 16, 12, 0, 0, TimeSpan.Zero);

    private readonly FakeVendaLookup lookup = new();
    private readonly FakeVendaRepository vendas;
    private readonly FakePedidoRepository pedidos;
    private readonly PedidoService sut;
    private readonly VendaService vendaService;

    private readonly Guid clienteId = Guid.NewGuid();
    private readonly Guid funcionarioId = Guid.NewGuid();
    private readonly Guid entregador = Guid.NewGuid();
    private readonly Guid outroEntregador = Guid.NewGuid();
    private readonly ProdutoVenda carvao;

    public PedidoServiceTests()
    {
        vendas = new FakeVendaRepository(lookup.SaldosEstoque);
        pedidos = new FakePedidoRepository(lookup.SaldosEstoque, vendas.Reservas);
        sut = new PedidoService(pedidos, lookup, new RelogioFixo(Agora));
        vendaService = new VendaService(vendas, lookup, new FakeCupomFiscalRepository(), new FakePermissaoLookup());
        lookup.Clientes.Add(clienteId);
        foreach (var id in new[] { funcionarioId, entregador, outroEntregador })
        {
            lookup.Funcionarios.Add(id);
        }

        carvao = lookup.AddProduto(TipoProduto.DESCARTAVEL, "Carvão 5kg", 10);
    }

    private NovoPedido NovoPedidoDe(
        int quantidade, IReadOnlyList<Guid>? funcionarios = null, Guid? enderecoId = null) => new(
        clienteId, funcionarioId, enderecoId,
        [new ItemVenda(carvao.ProdutoId, carvao.MarcaId, quantidade, 8m, null)],
        funcionarios ?? [], "obs");

    [Fact]
    public async Task Criar_SemFuncionarios_NasceNoPendenteSemReservaNemSaldoChecado()
    {
        lookup.SaldosEstoque[carvao.ProdutoMarcaId] = 0; // sem estoque: o cadastro não confere saldo

        var pedido = await sut.CriarAsync(NovoPedidoDe(50), CancellationToken.None);

        Assert.Equal(StatusPedido.PENDENTE, pedido.Status);
        Assert.Empty(pedido.Funcionarios);
        Assert.Equal(funcionarioId, pedido.CreatedBy);
        Assert.Equal(Agora, pedido.CreatedAt);
        Assert.Equal(50, Assert.Single(pedido.Itens).Quantidade);
        Assert.Empty(vendas.Reservas);
    }

    [Fact]
    public async Task Criar_FuncionarioRepetidoContaUmaVez()
    {
        var pedido = await sut.CriarAsync(NovoPedidoDe(1, [entregador, entregador]), CancellationToken.None);

        Assert.Equal([entregador], pedido.Funcionarios.Select(f => f.Id));
    }

    [Fact]
    public async Task Criar_SemItens_LancaItensObrigatorios()
    {
        var ex = await Assert.ThrowsAsync<RequestValidationException>(() =>
            sut.CriarAsync(NovoPedidoDe(1) with { Itens = [] }, CancellationToken.None));

        Assert.Equal("ITENS_OBRIGATORIOS", ex.Code);
    }

    [Fact]
    public async Task Criar_EnderecoDeOutroCliente_Lanca422()
    {
        var enderecoDeOutro = Guid.NewGuid();
        lookup.EnderecosPorCliente[enderecoDeOutro] = Guid.NewGuid();

        var ex = await Assert.ThrowsAsync<BusinessRuleException>(() =>
            sut.CriarAsync(NovoPedidoDe(1, enderecoId: enderecoDeOutro), CancellationToken.None));

        Assert.Equal("ENDERECO_NAO_PERTENCE_AO_CLIENTE", ex.Code);
    }

    [Fact]
    public async Task Criar_FuncionarioInexistente_Lanca404()
    {
        var ex = await Assert.ThrowsAsync<EntityNotFoundException>(() =>
            sut.CriarAsync(NovoPedidoDe(1) with { FuncionarioId = Guid.NewGuid() }, CancellationToken.None));
        Assert.Equal("FUNCIONARIO_NAO_ENCONTRADO", ex.Code);

        ex = await Assert.ThrowsAsync<EntityNotFoundException>(() =>
            sut.CriarAsync(NovoPedidoDe(1, [Guid.NewGuid()]), CancellationToken.None));
        Assert.Equal("FUNCIONARIO_NAO_ENCONTRADO", ex.Code);
    }

    [Fact]
    public async Task Iniciar_SemFuncionarios_Lanca422FuncionariosObrigatorios()
    {
        var pedido = await sut.CriarAsync(NovoPedidoDe(1), CancellationToken.None);

        var ex = await Assert.ThrowsAsync<BusinessRuleException>(() =>
            sut.IniciarAsync(pedido.Id, funcionarioId, [], CancellationToken.None));

        Assert.Equal("FUNCIONARIOS_OBRIGATORIOS", ex.Code);
        Assert.Equal(StatusPedido.PENDENTE, (await sut.ObterAsync(pedido.Id, CancellationToken.None)).Status);
    }

    [Fact]
    public async Task Iniciar_TrocaOsFuncionariosEReservaOsItens()
    {
        var pedido = await sut.CriarAsync(NovoPedidoDe(4, [entregador]), CancellationToken.None);

        var iniciado = await sut.IniciarAsync(pedido.Id, funcionarioId, [outroEntregador], CancellationToken.None);

        Assert.Equal(StatusPedido.EM_ANDAMENTO, iniciado.Status);
        Assert.Equal(Agora, iniciado.IniciadoEm);
        Assert.Equal([outroEntregador], iniciado.Funcionarios.Select(f => f.Id));
        Assert.Equal(4, vendas.Reservas[carvao.ProdutoMarcaId]);
    }

    [Fact]
    public async Task Pendente_NaoReserva_VendaDoSaldoTodoPassa()
    {
        await sut.CriarAsync(NovoPedidoDe(10), CancellationToken.None);

        await vendaService.CriarAsync(NovaVendaDe(10), CancellationToken.None);

        Assert.NotNull(vendas.UltimaGravacao);
    }

    [Fact]
    public async Task Iniciar_ReservaDeOutroPedidoTiraODisponivel_Lanca422EstoqueInsuficiente()
    {
        var a = await sut.CriarAsync(NovoPedidoDe(6), CancellationToken.None);
        await sut.IniciarAsync(a.Id, funcionarioId, [entregador], CancellationToken.None);
        var b = await sut.CriarAsync(NovoPedidoDe(5), CancellationToken.None);

        await Assert.ThrowsAsync<InsufficientStockException>(() =>
            sut.IniciarAsync(b.Id, funcionarioId, [entregador], CancellationToken.None));

        Assert.Equal(StatusPedido.PENDENTE, (await sut.ObterAsync(b.Id, CancellationToken.None)).Status);
        Assert.Equal(6, vendas.Reservas[carvao.ProdutoMarcaId]);
    }

    [Fact]
    public async Task Cancelar_EmAndamento_LiberaAReserva()
    {
        var a = await sut.CriarAsync(NovoPedidoDe(6), CancellationToken.None);
        await sut.IniciarAsync(a.Id, funcionarioId, [entregador], CancellationToken.None);
        var b = await sut.CriarAsync(NovoPedidoDe(5), CancellationToken.None);

        var cancelado = await sut.CancelarAsync(a.Id, outroEntregador, CancellationToken.None);
        var iniciadoB = await sut.IniciarAsync(b.Id, funcionarioId, [entregador], CancellationToken.None);

        Assert.Equal(StatusPedido.CANCELADO, cancelado.Status);
        Assert.Equal(Agora, cancelado.CanceladoEm);
        Assert.Equal(outroEntregador, cancelado.CanceladoPor);
        Assert.Equal(StatusPedido.EM_ANDAMENTO, iniciadoB.Status);
        Assert.Equal(5, vendas.Reservas[carvao.ProdutoMarcaId]);
    }

    [Fact]
    public async Task Cancelar_Pendente_FuncionaSemReservaParaLiberar()
    {
        var pedido = await sut.CriarAsync(NovoPedidoDe(3), CancellationToken.None);

        var cancelado = await sut.CancelarAsync(pedido.Id, funcionarioId, CancellationToken.None);

        Assert.Equal(StatusPedido.CANCELADO, cancelado.Status);
        Assert.Empty(vendas.Reservas);
    }

    [Theory]
    [InlineData(StatusPedido.CONCLUIDO)]
    [InlineData(StatusPedido.CANCELADO)]
    public async Task Cancelar_ConcluidoOuCancelado_Lanca409(StatusPedido status)
    {
        var pedido = await sut.CriarAsync(NovoPedidoDe(1), CancellationToken.None);
        pedidos.ForcarStatus(pedido.Id, status);

        var ex = await Assert.ThrowsAsync<ConflictException>(() =>
            sut.CancelarAsync(pedido.Id, funcionarioId, CancellationToken.None));

        Assert.Equal("PEDIDO_STATUS_INVALIDO", ex.Code);
    }

    [Theory]
    [InlineData(StatusPedido.EM_ANDAMENTO)]
    [InlineData(StatusPedido.CONCLUIDO)]
    [InlineData(StatusPedido.CANCELADO)]
    public async Task Iniciar_ForaDePendente_Lanca409(StatusPedido status)
    {
        var pedido = await sut.CriarAsync(NovoPedidoDe(1), CancellationToken.None);
        pedidos.ForcarStatus(pedido.Id, status);

        var ex = await Assert.ThrowsAsync<ConflictException>(() =>
            sut.IniciarAsync(pedido.Id, funcionarioId, [entregador], CancellationToken.None));

        Assert.Equal("PEDIDO_STATUS_INVALIDO", ex.Code);
    }

    [Fact]
    public async Task PedidoInexistente_Lanca404EmObterIniciarECancelar()
    {
        var id = Guid.NewGuid();

        var ex = await Assert.ThrowsAsync<EntityNotFoundException>(() => sut.ObterAsync(id, CancellationToken.None));
        Assert.Equal("PEDIDO_NAO_ENCONTRADO", ex.Code);
        ex = await Assert.ThrowsAsync<EntityNotFoundException>(() =>
            sut.IniciarAsync(id, funcionarioId, [entregador], CancellationToken.None));
        Assert.Equal("PEDIDO_NAO_ENCONTRADO", ex.Code);
        ex = await Assert.ThrowsAsync<EntityNotFoundException>(() =>
            sut.CancelarAsync(id, funcionarioId, CancellationToken.None));
        Assert.Equal("PEDIDO_NAO_ENCONTRADO", ex.Code);
    }

    [Fact]
    public async Task FuncionarioInexistente_Lanca404NoInicioENoCancelamento()
    {
        var pedido = await sut.CriarAsync(NovoPedidoDe(1), CancellationToken.None);

        var ex = await Assert.ThrowsAsync<EntityNotFoundException>(() =>
            sut.IniciarAsync(pedido.Id, Guid.NewGuid(), [entregador], CancellationToken.None));
        Assert.Equal("FUNCIONARIO_NAO_ENCONTRADO", ex.Code);
        ex = await Assert.ThrowsAsync<EntityNotFoundException>(() =>
            sut.IniciarAsync(pedido.Id, funcionarioId, [Guid.NewGuid()], CancellationToken.None));
        Assert.Equal("FUNCIONARIO_NAO_ENCONTRADO", ex.Code);
        ex = await Assert.ThrowsAsync<EntityNotFoundException>(() =>
            sut.CancelarAsync(pedido.Id, Guid.NewGuid(), CancellationToken.None));
        Assert.Equal("FUNCIONARIO_NAO_ENCONTRADO", ex.Code);
    }

    [Fact]
    public async Task Listar_FiltraPorStatusEOrdenaDoMaisRecente()
    {
        var antigo = await sut.CriarAsync(NovoPedidoDe(1), CancellationToken.None);
        var recente = await new PedidoService(pedidos, lookup, new RelogioFixo(Agora.AddHours(1)))
            .CriarAsync(NovoPedidoDe(1), CancellationToken.None);
        await sut.CancelarAsync(antigo.Id, funcionarioId, CancellationToken.None);

        var todos = await sut.ListarAsync(null, 1, 50, CancellationToken.None);
        var cancelados = await sut.ListarAsync("CANCELADO", 1, 50, CancellationToken.None);

        Assert.Equal([recente.Id, antigo.Id], todos.Select(p => p.Id));
        Assert.Equal([antigo.Id], cancelados.Select(p => p.Id));
    }

    [Fact]
    public async Task Listar_StatusDesconhecido_Lanca400()
    {
        var ex = await Assert.ThrowsAsync<RequestValidationException>(() =>
            sut.ListarAsync("VOANDO", 1, 50, CancellationToken.None));

        Assert.Equal("VALOR_ENUM_INVALIDO", ex.Code);
    }

    private NovaVenda NovaVendaDe(int quantidade) => new(
        clienteId, funcionarioId, null,
        [new ItemVenda(carvao.ProdutoId, carvao.MarcaId, quantidade, 8m, null)],
        [], [], [], [], null);
}
