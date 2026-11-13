using ControleEstoque.Shared.Results;
using ControleEstoque.Vendas.Domain;

namespace ControleEstoque.Vendas.Tests;

public sealed class VendaServiceTests
{
    private readonly FakeVendaRepository vendas;
    private readonly FakeVendaLookup lookup = new();
    private readonly FakeCupomFiscalRepository cupons = new();
    private readonly VendaService sut;

    private readonly Guid clienteId = Guid.NewGuid();
    private readonly Guid funcionarioId = Guid.NewGuid();
    private readonly ProdutoVenda agua;
    private readonly ProdutoVenda galaoCompleto;
    private readonly ProdutoVenda descartavel;

    public VendaServiceTests()
    {
        vendas = new FakeVendaRepository(lookup.SaldosEstoque);
        sut = new VendaService(vendas, lookup, cupons);
        lookup.Clientes.Add(clienteId);
        lookup.Funcionarios.Add(funcionarioId);
        agua = lookup.AddProduto(TipoProduto.AGUA, "Água Marca A 20L", 20);
        galaoCompleto = lookup.AddProduto(TipoProduto.GALAO_COMPLETO, "Galão Completo A", 10);
        descartavel = lookup.AddProduto(TipoProduto.DESCARTAVEL, "Carvão 5kg", 30);
        lookup.AddProduto(TipoProduto.CASCO, "Casco vazio", 10);
        lookup.AddProduto(TipoProduto.SUCATA, "Galão sucata", 2);
    }

    [Fact]
    public async Task CriarAsync_QuandoVendaDeAgua_EmprestaCascoNaQuantidadeVendida()
    {
        await sut.CriarAsync(NovaVendaDe(agua.Id, 5, 50m, cascosDevolvidos: 3), CancellationToken.None);

        Assert.NotNull(vendas.UltimaGravacao);
        Assert.Equal(5, vendas.UltimaGravacao.CascosEmprestados);
        Assert.Equal(3, vendas.UltimaGravacao.CascosDevolvidos);
    }

    [Fact]
    public async Task CriarAsync_QuandoGalaoCompleto_NaoEmprestaCasco()
    {
        // Regra crítica 1: galão completo é propriedade do cliente — sem débito.
        await sut.CriarAsync(NovaVendaDe(galaoCompleto.Id, 4, 80m), CancellationToken.None);

        Assert.Equal(0, vendas.UltimaGravacao!.CascosEmprestados);
    }

    [Fact]
    public async Task CriarAsync_QuandoCascosDevolvidosNaHora_IgualaDevolvidosAoVendido()
    {
        await sut.CriarAsync(
            NovaVendaDe(agua.Id, 7, 50m, cascosDevolvidos: 0, devolvidosNaHora: true),
            CancellationToken.None);

        Assert.Equal(7, vendas.UltimaGravacao!.CascosDevolvidos);
    }

    [Fact]
    public async Task CriarAsync_QuandoSucataEntregue_NaoAlteraCascos()
    {
        await sut.CriarAsync(NovaVendaDe(agua.Id, 2, 50m, sucataEntregue: 3), CancellationToken.None);

        Assert.Equal(3, vendas.UltimaGravacao!.SucataEntregue);
        Assert.Equal(2, vendas.UltimaGravacao.CascosEmprestados);
        Assert.Equal(0, vendas.UltimaGravacao.CascosDevolvidos); // sucata não conta como devolução
    }

    [Fact]
    public async Task CriarAsync_QuandoPagamentoParcial_GeraDebitoFiado()
    {
        await sut.CriarAsync(
            NovaVendaDe(agua.Id, 5, 50m, pagamentos: [new PagamentoVenda(FormaPagamento.PIX, 200m)]),
            CancellationToken.None);

        Assert.Equal(50m, vendas.UltimaGravacao!.DebitoFiado);
        Assert.Equal(StatusPagamento.PARCIAL, vendas.UltimaGravacao.Status);
    }

    [Fact]
    public async Task CriarAsync_QuandoEstoqueInsuficiente_LancaInsufficientStock()
    {
        lookup.SaldosEstoque[agua.Id] = 3;

        await Assert.ThrowsAsync<InsufficientStockException>(
            () => sut.CriarAsync(NovaVendaDe(agua.Id, 5, 50m), CancellationToken.None));
    }

    [Fact]
    public async Task CriarAsync_QuandoClienteNaoExiste_LancaNotFound()
    {
        var venda = NovaVendaDe(agua.Id, 1, 50m) with { ClienteId = Guid.NewGuid() };

        var e = await Assert.ThrowsAsync<EntityNotFoundException>(
            () => sut.CriarAsync(venda, CancellationToken.None));

        Assert.Equal("CLIENTE_NAO_ENCONTRADO", e.Code);
    }

    [Fact]
    public async Task CriarAsync_QuandoEnderecoDeOutroCliente_LancaBusinessRule()
    {
        var enderecoId = Guid.NewGuid();
        lookup.EnderecosPorCliente[enderecoId] = Guid.NewGuid(); // pertence a outro cliente
        var venda = NovaVendaDe(agua.Id, 1, 50m) with { EnderecoEntregaId = enderecoId };

        var e = await Assert.ThrowsAsync<BusinessRuleException>(
            () => sut.CriarAsync(venda, CancellationToken.None));

        Assert.Equal("ENDERECO_NAO_PERTENCE_AO_CLIENTE", e.Code);
    }

    [Fact]
    public async Task CriarAsync_QuandoDescartavel_NaoMovimentaCasco()
    {
        await sut.CriarAsync(NovaVendaDe(descartavel.Id, 10, 8m), CancellationToken.None);

        Assert.Equal(0, vendas.UltimaGravacao!.CascosEmprestados);
        Assert.Equal(0, vendas.UltimaGravacao.SucataEntregue);
    }

    [Fact]
    public async Task EditarAsync_QuandoCupomJaEmitido_LancaVendaJaFaturada()
    {
        var criada = await sut.CriarAsync(NovaVendaDe(agua.Id, 1, 50m), CancellationToken.None);
        cupons.Emitidos.Add(criada.Id);

        var e = await Assert.ThrowsAsync<BusinessRuleException>(
            () => sut.EditarAsync(criada.Id, NovaVendaDe(agua.Id, 2, 50m), CancellationToken.None));

        Assert.Equal("VENDA_JA_FATURADA", e.Code);
    }

    [Fact]
    public async Task EditarAsync_QuandoVendaNaoExiste_LancaNotFound()
    {
        await Assert.ThrowsAsync<EntityNotFoundException>(
            () => sut.EditarAsync(Guid.NewGuid(), NovaVendaDe(agua.Id, 1, 50m), CancellationToken.None));
    }

    [Fact]
    public async Task AdicionarPagamentoAsync_QuandoExcedeSaldo_LancaPagamentoExcedeSaldo()
    {
        var criada = await sut.CriarAsync(
            NovaVendaDe(agua.Id, 5, 50m, pagamentos: [new PagamentoVenda(FormaPagamento.PIX, 200m)]),
            CancellationToken.None);
        vendas.InfoPagamento = new InfoPagamentoVenda(250m, 200m, 50m, StatusPagamento.PARCIAL);

        var e = await Assert.ThrowsAsync<BusinessRuleException>(
            () => sut.AdicionarPagamentoAsync(
                criada.Id, FormaPagamento.DINHEIRO, 100m, CancellationToken.None));

        Assert.Equal("PAGAMENTO_EXCEDE_SALDO", e.Code);
    }

    [Fact]
    public async Task AdicionarPagamentoAsync_QuandoQuitaVenda_AbateFiadoEMarcaPaga()
    {
        var criada = await sut.CriarAsync(
            NovaVendaDe(agua.Id, 5, 50m, pagamentos: [new PagamentoVenda(FormaPagamento.PIX, 200m)]),
            CancellationToken.None);
        vendas.InfoPagamento = new InfoPagamentoVenda(250m, 200m, 50m, StatusPagamento.PARCIAL);

        var resultado = await sut.AdicionarPagamentoAsync(
            criada.Id, FormaPagamento.DINHEIRO, 50m, CancellationToken.None);

        Assert.Equal(StatusPagamento.PAGA, resultado.StatusPagamento);
        Assert.Equal((FormaPagamento.DINHEIRO, 50m), vendas.UltimoPagamento);
    }

    [Fact]
    public async Task AdicionarPagamentoAsync_QuandoRepositorioRecusaPorExcesso_LancaPagamentoExcedeSaldo()
    {
        // A pré-checagem passa (restam 50), mas outro pagamento esgota o saldo antes da trava da venda.
        var criada = await sut.CriarAsync(
            NovaVendaDe(agua.Id, 5, 50m, pagamentos: [new PagamentoVenda(FormaPagamento.PIX, 200m)]),
            CancellationToken.None);
        vendas.InfoPagamento = new InfoPagamentoVenda(250m, 200m, 50m, StatusPagamento.PARCIAL);
        vendas.RecusarPagamentoPorExcesso = true;

        var e = await Assert.ThrowsAsync<BusinessRuleException>(
            () => sut.AdicionarPagamentoAsync(
                criada.Id, FormaPagamento.DINHEIRO, 50m, CancellationToken.None));

        Assert.Equal("PAGAMENTO_EXCEDE_SALDO", e.Code);
        Assert.Null(vendas.UltimoPagamento);
    }

    [Fact]
    public async Task AdicionarPagamentoAsync_QuandoCaixaFechado_LancaCaixaFechadoENaoGrava()
    {
        var criada = await sut.CriarAsync(
            NovaVendaDe(agua.Id, 5, 50m, pagamentos: [new PagamentoVenda(FormaPagamento.PIX, 200m)]),
            CancellationToken.None);
        vendas.InfoPagamento = new InfoPagamentoVenda(250m, 200m, 50m, StatusPagamento.PARCIAL);
        vendas.CaixaHojeFechado = true;

        var e = await Assert.ThrowsAsync<ConflictException>(
            () => sut.AdicionarPagamentoAsync(
                criada.Id, FormaPagamento.DINHEIRO, 50m, CancellationToken.None));

        Assert.Equal("CAIXA_FECHADO", e.Code);
        Assert.Null(vendas.UltimoPagamento);
    }

    [Fact]
    public async Task CriarAsync_ComPagamentoEmCaixaFechado_LancaCaixaFechadoENaoGrava()
    {
        vendas.CaixaHojeFechado = true;

        var e = await Assert.ThrowsAsync<ConflictException>(
            () => sut.CriarAsync(
                NovaVendaDe(agua.Id, 5, 50m, pagamentos: [new PagamentoVenda(FormaPagamento.PIX, 250m)]),
                CancellationToken.None));

        Assert.Equal("CAIXA_FECHADO", e.Code);
        Assert.Null(vendas.UltimaGravacao);
    }

    [Fact]
    public async Task CriarAsync_SemPagamentoEmCaixaFechado_Grava()
    {
        vendas.CaixaHojeFechado = true;

        var resultado = await sut.CriarAsync(NovaVendaDe(agua.Id, 5, 50m), CancellationToken.None);

        Assert.NotNull(vendas.UltimaGravacao);
        Assert.Equal(StatusPagamento.PENDENTE, resultado.StatusPagamento);
    }

    [Fact]
    public async Task EditarAsync_ComPagamentoAtualEmCaixaFechado_LancaCaixaFechadoENaoGrava()
    {
        var criada = await sut.CriarAsync(
            NovaVendaDe(agua.Id, 5, 50m, pagamentos: [new PagamentoVenda(FormaPagamento.PIX, 250m)]),
            CancellationToken.None);
        vendas.VendaTemPagamentoEmCaixaFechado = true;

        var e = await Assert.ThrowsAsync<ConflictException>(
            () => sut.EditarAsync(criada.Id, NovaVendaDe(agua.Id, 4, 50m), CancellationToken.None));

        Assert.Equal("CAIXA_FECHADO", e.Code);
        Assert.Null(vendas.UltimaEdicao);
    }

    [Fact]
    public async Task EditarAsync_ReinserindoPagamentoComCaixaDeHojeFechado_LancaCaixaFechado()
    {
        var criada = await sut.CriarAsync(NovaVendaDe(agua.Id, 5, 50m), CancellationToken.None);
        vendas.CaixaHojeFechado = true;

        var e = await Assert.ThrowsAsync<ConflictException>(
            () => sut.EditarAsync(
                criada.Id,
                NovaVendaDe(agua.Id, 5, 50m, pagamentos: [new PagamentoVenda(FormaPagamento.PIX, 250m)]),
                CancellationToken.None));

        Assert.Equal("CAIXA_FECHADO", e.Code);
        Assert.Null(vendas.UltimaEdicao);
    }

    [Fact]
    public async Task EmitirCupomAsync_QuandoJaEmitido_LancaConflict()
    {
        var criada = await sut.CriarAsync(NovaVendaDe(agua.Id, 1, 50m), CancellationToken.None);
        await sut.EmitirCupomAsync(criada.Id, CancellationToken.None);

        var e = await Assert.ThrowsAsync<ConflictException>(
            () => sut.EmitirCupomAsync(criada.Id, CancellationToken.None));

        Assert.Equal("CUPOM_JA_EMITIDO", e.Code);
    }

    [Fact]
    public async Task CriarAsync_QuandoSemSaldo_LancaInsufficientStockENaoGrava()
    {
        lookup.SaldosEstoque[agua.Id] = 0;

        await Assert.ThrowsAsync<InsufficientStockException>(
            () => sut.CriarAsync(NovaVendaDe(agua.Id, 1, 50m), CancellationToken.None));

        Assert.Null(vendas.UltimaGravacao);
    }

    [Fact]
    public async Task CriarAsync_ConcorrenteComSaldo3_AceitaSo3De5()
    {
        lookup.SaldosEstoque[agua.Id] = 3;

        var resultados = await Task.WhenAll(Enumerable.Range(0, 5).Select(async _ =>
        {
            try
            {
                await sut.CriarAsync(NovaVendaDe(agua.Id, 1, 50m), CancellationToken.None);
                return true;
            }
            catch (InsufficientStockException)
            {
                return false;
            }
        }));

        Assert.Equal(3, resultados.Count(sucesso => sucesso));
        Assert.Equal(0, lookup.SaldosEstoque[agua.Id]);
    }

    [Fact]
    public async Task CriarAsync_QuandoGravacaoAtomicaRecusa_LancaInsufficientStockMesmoComLeituraAlta()
    {
        lookup.SaldosEstoque[agua.Id] = 100; // leitura avulsa desatualizada: a gravação atômica é quem decide
        vendas.RecusarSempre = true;

        await Assert.ThrowsAsync<InsufficientStockException>(
            () => sut.CriarAsync(NovaVendaDe(agua.Id, 1, 50m), CancellationToken.None));
    }

    [Fact]
    public async Task EditarAsync_QuandoMantemQuantidadeComSaldoZeradoPelaPropriaVenda_Aceita()
    {
        lookup.SaldosEstoque[agua.Id] = 4;
        var criada = await sut.CriarAsync(NovaVendaDe(agua.Id, 4, 50m), CancellationToken.None);
        Assert.Equal(0, lookup.SaldosEstoque[agua.Id]);

        await sut.EditarAsync(criada.Id, NovaVendaDe(agua.Id, 4, 50m), CancellationToken.None);

        Assert.NotNull(vendas.UltimaEdicao);
        Assert.Equal(0, lookup.SaldosEstoque[agua.Id]);
    }

    [Fact]
    public async Task CriarAsync_QuandoClienteIdVazio_LancaIdInvalido()
    {
        var venda = NovaVendaDe(agua.Id, 1, 50m) with { ClienteId = Guid.Empty };

        var e = await Assert.ThrowsAsync<RequestValidationException>(
            () => sut.CriarAsync(venda, CancellationToken.None));

        Assert.Equal("ID_INVALIDO", e.Code);
    }

    [Fact]
    public async Task CriarAsync_QuandoFuncionarioIdVazio_LancaIdInvalido()
    {
        var venda = NovaVendaDe(agua.Id, 1, 50m) with { FuncionarioId = Guid.Empty };

        var e = await Assert.ThrowsAsync<RequestValidationException>(
            () => sut.CriarAsync(venda, CancellationToken.None));

        Assert.Equal("ID_INVALIDO", e.Code);
    }

    [Fact]
    public async Task CriarAsync_QuandoProdutoIdDoItemVazio_LancaIdInvalido()
    {
        var e = await Assert.ThrowsAsync<RequestValidationException>(
            () => sut.CriarAsync(NovaVendaDe(Guid.Empty, 1, 50m), CancellationToken.None));

        Assert.Equal("ID_INVALIDO", e.Code);
    }

    [Fact]
    public async Task AdicionarPagamentoAsync_QuandoFormaForaDaFaixa_LancaValorEnumInvalido()
    {
        var e = await Assert.ThrowsAsync<RequestValidationException>(
            () => sut.AdicionarPagamentoAsync(Guid.NewGuid(), (FormaPagamento)99, 10m, CancellationToken.None));

        Assert.Equal("VALOR_ENUM_INVALIDO", e.Code);
    }

    [Fact]
    public async Task ListarAsync_QuandoInicioDepoisDoFim_LancaPeriodoInvalido()
    {
        var e = await Assert.ThrowsAsync<RequestValidationException>(() => sut.ListarAsync(
            null, new DateOnly(2026, 2, 1), new DateOnly(2026, 1, 1), 1, 50, CancellationToken.None));

        Assert.Equal("PERIODO_INVALIDO", e.Code);
    }

    [Fact]
    public async Task ListarAsync_QuandoPeriodoValido_Lista()
    {
        var lista = await sut.ListarAsync(
            null, new DateOnly(2026, 1, 1), new DateOnly(2026, 1, 1), 1, 50, CancellationToken.None);

        Assert.Empty(lista);
    }

    private NovaVenda NovaVendaDe(
        Guid produtoId,
        int quantidade,
        decimal preco,
        int cascosDevolvidos = 0,
        bool devolvidosNaHora = false,
        int sucataEntregue = 0,
        IReadOnlyList<PagamentoVenda>? pagamentos = null) => new(
        clienteId, funcionarioId, null,
        [new ItemVenda(produtoId, quantidade, preco, null)],
        pagamentos ?? [],
        cascosDevolvidos, devolvidosNaHora, sucataEntregue, null);
}
