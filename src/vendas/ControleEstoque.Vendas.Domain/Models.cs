namespace ControleEstoque.Vendas.Domain;

public sealed record Desconto(TipoDesconto Tipo, decimal Valor, string Motivo);

public sealed record ItemVenda(Guid ProdutoId, int Quantidade, decimal PrecoUnitario, Desconto? Desconto);

public sealed record PagamentoVenda(FormaPagamento Forma, decimal Valor);

/// <summary>Comando de criação/edição de venda, como chega da API.</summary>
public sealed record NovaVenda(
    Guid ClienteId,
    Guid FuncionarioId,
    Guid? EnderecoEntregaId,
    IReadOnlyList<ItemVenda> Itens,
    IReadOnlyList<PagamentoVenda> Pagamentos,
    int CascosDevolvidos,
    bool CascosDevolvidosNaHora,
    int SucataEntregue,
    string? Observacao);

/// <summary>Item com totais já calculados pelo sistema (nunca aceitos do cliente HTTP).</summary>
public sealed record ItemCalculado(
    Guid ProdutoId,
    int Quantidade,
    decimal PrecoUnitario,
    Desconto? Desconto,
    decimal TotalBruto,
    decimal ValorDesconto,
    decimal TotalItem);

public sealed record TotaisVenda(
    IReadOnlyList<ItemCalculado> Itens,
    decimal TotalBruto,
    decimal TotalDesconto,
    decimal TotalLiquido,
    decimal TotalPago,
    decimal Faltante,
    StatusPagamento Status);

/// <summary>Informações de produto necessárias à venda (lookup no banco).</summary>
public sealed record ProdutoVenda(Guid Id, TipoProduto Tipo, string Nome);

/// <summary>
/// Modelo de gravação totalmente resolvido pelo VendaService — o repositório
/// apenas persiste, sem recomputar regra de negócio.
/// </summary>
public sealed record VendaGravacao(
    Guid VendaId,
    Guid ClienteId,
    Guid FuncionarioId,
    Guid? EnderecoEntregaId,
    string? Observacao,
    decimal TotalBruto,
    decimal TotalDesconto,
    decimal TotalLiquido,
    StatusPagamento Status,
    IReadOnlyList<ItemCalculado> Itens,
    IReadOnlyList<PagamentoVenda> Pagamentos,
    int CascosEmprestados,
    int CascosDevolvidos,
    int SucataEntregue,
    decimal DebitoFiado,
    Guid? CascoProdutoId,
    Guid? SucataProdutoId);

public sealed record ResultadoVenda(
    Guid Id,
    decimal TotalBruto,
    decimal TotalDesconto,
    decimal TotalLiquido,
    decimal TotalPago,
    decimal SaldoFiadoGerado,
    StatusPagamento StatusPagamento,
    long SaldoCascoCliente);

public sealed record Venda(
    Guid Id,
    Guid ClienteId,
    Guid FuncionarioId,
    Guid? EnderecoEntregaId,
    DateTimeOffset Data,
    decimal TotalBruto,
    decimal TotalDesconto,
    decimal TotalLiquido,
    StatusPagamento StatusPagamento,
    string? Observacao,
    bool CupomEmitido,
    IReadOnlyList<ItemCalculado> Itens,
    IReadOnlyList<PagamentoVenda> Pagamentos);

public sealed record CupomFiscal(Guid Id, string Numero, DateTimeOffset EmitidoEm);

public sealed record InfoPagamentoVenda(
    decimal TotalLiquido, decimal TotalPago, decimal DebitoFiadoRestante, StatusPagamento Status);

public sealed record FaturamentoPorProduto(Guid ProdutoId, string Nome, long Quantidade, decimal TotalLiquido);

public sealed record FaturamentoPorDia(DateOnly Dia, decimal TotalLiquido);

public sealed record RelatorioFaturamento(
    decimal TotalBruto,
    decimal TotalDesconto,
    decimal TotalLiquido,
    IReadOnlyList<FaturamentoPorProduto> PorProduto,
    IReadOnlyList<FaturamentoPorDia> PorDia);

public sealed record VendasPorFuncionario(Guid FuncionarioId, string Nome, long QuantidadeVendas, decimal TotalLiquido);
