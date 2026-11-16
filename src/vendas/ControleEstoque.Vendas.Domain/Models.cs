using ControleEstoque.Shared.Results;

namespace ControleEstoque.Vendas.Domain;

public sealed record Desconto(TipoDesconto Tipo, decimal Valor, string Motivo);

/// <summary>Item = produto+marca.</summary>
public sealed record ItemVenda(
    Guid ProdutoId, Guid MarcaId, int Quantidade, decimal PrecoUnitario, Desconto? Desconto);

/// <summary>Vasilhame vendido como item próprio do tipo de casco; o preço vem do request (pré-preenchido na tela).</summary>
public sealed record VasilhameVenda(
    Guid TipoCascoId, int Quantidade, decimal PrecoUnitario, ModoCreditoVasilhame Modo);

/// <summary>Vasilhame com o abate do crédito de galão já resolvido; Total é o cobrado (sem o abatido).</summary>
public sealed record VasilhameCalculado(
    Guid TipoCascoId, int Quantidade, int QuantidadeAbatida, decimal PrecoUnitario,
    ModoCreditoVasilhame Modo, decimal Total);

/// <summary>Sucata entregue na venda: o valor por unidade vira desconto e a sucata não entra no saldo do cliente.</summary>
public sealed record SucataVenda(Guid TipoCascoId, int Quantidade, decimal ValorUnitario)
{
    public decimal Total => Quantidade * ValorUnitario;
}

public sealed record PagamentoVenda(FormaPagamento Forma, decimal Valor);

/// <summary>Quantidade de casco (devolvido, emprestado ou sucata) de um tipo de casco.</summary>
public sealed record CascoQuantidade(Guid TipoCascoId, int Quantidade);

public sealed record SaldoCascoTipo(Guid TipoCascoId, string Nome, long Saldo);

/// <summary>Caixa escolhido pelo lançador (caixa reaberto): a data dele vale para a venda.</summary>
public sealed record CaixaVenda(Guid Id, DateOnly Data, bool Aberto);

/// <summary>Comando de criação/edição de venda, como chega da API.</summary>
public sealed record NovaVenda(
    Guid ClienteId,
    Guid FuncionarioId,
    Guid? EnderecoEntregaId,
    IReadOnlyList<ItemVenda> Itens,
    IReadOnlyList<VasilhameVenda> Vasilhames,
    IReadOnlyList<PagamentoVenda> Pagamentos,
    IReadOnlyList<CascoQuantidade> CascosDevolvidos,
    IReadOnlyList<SucataVenda> SucataEntregue,
    string? Observacao,
    Guid? CaixaId = null);

/// <summary>Resolução do item no banco: associação e casco resolvido.</summary>
public sealed record ItemResolvido(Guid ProdutoMarcaId, Guid? TipoCascoId);

/// <summary>Item com totais já calculados pelo sistema (nunca aceitos do cliente HTTP).</summary>
public sealed record ItemCalculado(
    Guid ProdutoId,
    Guid MarcaId,
    Guid ProdutoMarcaId,
    Guid? TipoCascoId,
    int Quantidade,
    decimal PrecoUnitario,
    Desconto? Desconto,
    decimal TotalBruto,
    decimal ValorDesconto,
    decimal TotalItem);

/// <summary>TotalDesconto = descontos dos itens + DescontoSucata; CreditoGerado = sobra do pagamento acima do líquido.</summary>
public sealed record TotaisVenda(
    IReadOnlyList<ItemCalculado> Itens,
    decimal TotalBruto,
    decimal TotalDesconto,
    decimal DescontoSucata,
    decimal TotalLiquido,
    decimal TotalPago,
    decimal Faltante,
    decimal CreditoGerado,
    StatusPagamento Status);

/// <summary>Produto+marca da venda (lookup no banco), com os dois tipos de casco que a regra resolve.</summary>
public sealed record ProdutoVenda(
    Guid ProdutoMarcaId,
    Guid ProdutoId,
    Guid MarcaId,
    TipoProduto Tipo,
    string Nome,
    Guid? TipoCascoProdutoId,
    Guid? TipoCascoMarcaId);

public sealed record TipoCascoVenda(Guid Id, decimal PrecoVasilhame, bool AceitaSucata);

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
    decimal DescontoSucata,
    decimal TotalLiquido,
    StatusPagamento Status,
    IReadOnlyList<ItemCalculado> Itens,
    IReadOnlyList<VasilhameCalculado> Vasilhames,
    IReadOnlyList<PagamentoVenda> Pagamentos,
    IReadOnlyList<CascoQuantidade> CascosEmprestados,
    IReadOnlyList<CascoQuantidade> CascosDevolvidos,
    IReadOnlyList<CascoQuantidade> VaziosSaidos,
    IReadOnlyList<CascoQuantidade> CascosConvertidos,
    IReadOnlyList<SucataVenda> SucataEntregue,
    decimal DebitoFiado,
    decimal CreditoGerado,
    decimal UsoCredito,
    DateTimeOffset? Instante = null,
    Guid? CaixaId = null);

/// <summary>
/// Resultado da gravação: saldo de casco do cliente por tipo, ou a falta de estoque que causou o rollback
/// (SaldoInsuficiente.ProdutoId carrega o id da associação produto+marca).
/// </summary>
public sealed record ResultadoGravacao(IReadOnlyList<SaldoCascoTipo> SaldoCascoPorTipo, SaldoInsuficiente? Falta = null)
{
    public long SaldoCasco => SaldoCascoPorTipo.Sum(s => s.Saldo);
}

public sealed record ResultadoVenda(
    Guid Id,
    decimal TotalBruto,
    decimal TotalDesconto,
    decimal DescontoSucata,
    decimal TotalLiquido,
    decimal TotalPago,
    decimal SaldoFiadoGerado,
    decimal CreditoGerado,
    StatusPagamento StatusPagamento,
    IReadOnlyList<SaldoCascoTipo> SaldoCascoClientePorTipo)
{
    public long SaldoCascoCliente => SaldoCascoClientePorTipo.Sum(s => s.Saldo);
}

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
    IReadOnlyList<PagamentoVenda> Pagamentos,
    IReadOnlyList<CascoQuantidade> CascosDevolvidos,
    IReadOnlyList<SucataVenda> SucataEntregue,
    IReadOnlyList<VasilhameCalculado> Vasilhames,
    string? CupomNumero = null,
    DateTimeOffset? CupomEmitidoEm = null,
    decimal DescontoSucata = 0m);

/// <summary>Preço unitário (antes do desconto do item) da compra mais recente do cliente.</summary>
public sealed record UltimoPrecoVenda(Guid VendaId, DateTimeOffset Data, decimal PrecoUnitario);

public sealed record CupomFiscal(Guid Id, string Numero, DateTimeOffset EmitidoEm);

public sealed record InfoPagamentoVenda(
    decimal TotalLiquido, decimal TotalPago, decimal DebitoFiadoRestante, StatusPagamento Status);

public sealed record FaturamentoPorProduto(Guid ProdutoId, string Nome, long Quantidade, decimal TotalLiquido);

public sealed record FaturamentoPorDia(DateOnly Dia, decimal TotalLiquido, decimal Recebido, decimal FiadoGerado);

public sealed record FaturamentoPorCategoria(string Categoria, long Quantidade, decimal TotalLiquido);

public sealed record RelatorioFaturamento(
    decimal TotalBruto,
    decimal TotalDesconto,
    decimal TotalLiquido,
    IReadOnlyList<FaturamentoPorProduto> PorProduto,
    IReadOnlyList<FaturamentoPorDia> PorDia,
    IReadOnlyList<FaturamentoPorCategoria> PorCategoria,
    decimal Recebido,
    decimal FiadoGerado);

public sealed record VendasPorFuncionario(Guid FuncionarioId, string Nome, long QuantidadeVendas, decimal TotalLiquido);

/// <summary>Item = produto+marca, como na venda; o pedido ainda não calcula totais.</summary>
public sealed record NovoPedido(
    Guid ClienteId, Guid FuncionarioId, Guid? EnderecoEntregaId, IReadOnlyList<ItemVenda> Itens,
    IReadOnlyList<Guid> FuncionariosIds, string? Observacao);

/// <summary>ProdutoMarcaId é a associação produto+marca (a que o estoque e a reserva usam).</summary>
public sealed record ItemPedido(
    Guid ProdutoId, Guid MarcaId, Guid ProdutoMarcaId, int Quantidade, decimal PrecoUnitario, Desconto? Desconto);

public sealed record FuncionarioPedido(Guid Id, string Nome);

public sealed record PedidoGravacao(
    Guid PedidoId, Guid ClienteId, Guid? EnderecoEntregaId, string? Observacao, Guid CriadoPor,
    DateTimeOffset CriadoEm, IReadOnlyList<ItemPedido> Itens, IReadOnlyList<Guid> FuncionariosIds);

public sealed record PedidoResumo(
    Guid Id, Guid ClienteId, Guid? EnderecoEntregaId, StatusPedido Status, string? Observacao,
    DateTimeOffset CreatedAt, DateTimeOffset? IniciadoEm, DateTimeOffset? CanceladoEm);

public sealed record Pedido(
    Guid Id, Guid ClienteId, Guid? EnderecoEntregaId, StatusPedido Status, string? Observacao, Guid CreatedBy,
    DateTimeOffset CreatedAt, DateTimeOffset? IniciadoEm, DateTimeOffset? CanceladoEm, Guid? CanceladoPor,
    IReadOnlyList<ItemPedido> Itens, IReadOnlyList<FuncionarioPedido> Funcionarios, Guid? VendaId = null,
    IReadOnlyList<PerdaPedido>? Perdas = null);

/// <summary>Conclusão do pedido em venda: o <see cref="NovaVenda"/> sem cliente e endereço, que vêm do pedido.</summary>
public sealed record ConclusaoPedido(
    Guid FuncionarioId,
    IReadOnlyList<ItemVenda> Itens,
    IReadOnlyList<VasilhameVenda> Vasilhames,
    IReadOnlyList<PagamentoVenda> Pagamentos,
    IReadOnlyList<CascoQuantidade> CascosDevolvidos,
    IReadOnlyList<SucataVenda> SucataEntregue,
    string? Observacao,
    Guid? CaixaId = null);

/// <summary>Ocorrência pedida: CHEIO traz ProdutoId+MarcaId; VAZIO, TipoCascoId.</summary>
public sealed record OcorrenciaPerda(
    GalaoPerda Galao, Guid? ProdutoId, Guid? MarcaId, Guid? TipoCascoId, int Quantidade, MotivoPerda Motivo);

/// <summary>Quantidade com sinal; Situacao só no destino CASCO.</summary>
public sealed record MovimentoPerda(
    DestinoMovimento Destino, SituacaoCasco? Situacao, TipoMovimentoPerda Tipo, int Quantidade);

/// <summary>Ocorrência resolvida pelo serviço: o repositório só persiste. ProdutoMarcaId só no CHEIO.</summary>
public sealed record PerdaGravacao(
    Guid Id, GalaoPerda Galao, Guid? ProdutoMarcaId, Guid TipoCascoId, int Quantidade, MotivoPerda Motivo,
    IReadOnlyList<MovimentoPerda> Movimentos);

/// <summary>Perda registrada (baixas_casco com pedido_id); ProdutoId e MarcaId só no CHEIO.</summary>
public sealed record PerdaPedido(
    GalaoPerda Galao, Guid? ProdutoId, Guid? MarcaId, Guid TipoCascoId, int Quantidade, MotivoPerda Motivo,
    DateTimeOffset RegistradoEm);
