using ControleEstoque.Vendas.Domain;

namespace ControleEstoque.Vendas.Contracts;

public sealed record DescontoRequest(TipoDesconto Tipo, decimal Valor, string? Motivo);

public sealed record ItemVendaRequest(
    Guid ProdutoId, Guid MarcaId, int Quantidade, decimal PrecoUnitario, DescontoRequest? Desconto);

/// <summary>ModoCredito omitido = ABATER_CREDITO.</summary>
public sealed record VasilhameVendaRequest(
    Guid TipoCascoId, int Quantidade, decimal PrecoUnitario, ModoCreditoVasilhame? ModoCredito = null);

/// <summary>ValorUnitario é obrigatório: omitido (null) é recusado com SUCATA_INVALIDA em vez de virar 0.</summary>
public sealed record SucataEntregueRequest(Guid TipoCascoId, int Quantidade, decimal? ValorUnitario);

public sealed record PagamentoRequest(FormaPagamento Forma, decimal Valor);

public sealed record CascoQuantidadeRequest(Guid TipoCascoId, int Quantidade);

public sealed record CascoQuantidadeResponse(Guid TipoCascoId, int Quantidade);

/// <summary>Mesmo formato do item de CascosPorTipo do contexto Clientes, sem referenciá-lo.</summary>
public sealed record CascoPorTipoResponse(Guid TipoCascoId, string Nome, long Saldo);

public sealed record CreateVendaRequest(
    Guid ClienteId,
    Guid FuncionarioId,
    Guid? EnderecoEntregaId,
    List<ItemVendaRequest>? Itens,
    List<VasilhameVendaRequest>? Vasilhames,
    List<PagamentoRequest>? Pagamentos,
    List<CascoQuantidadeRequest>? CascosDevolvidos,
    List<SucataEntregueRequest>? SucataEntregue,
    string? Observacao,
    Guid? CaixaId = null);

/// <summary>Conclusão do pedido: como CreateVendaRequest, sem cliente e endereço (vêm do pedido) e sem funcionários do pedido.</summary>
public sealed record ConcluirPedidoRequest(
    Guid FuncionarioId,
    List<ItemVendaRequest>? Itens,
    List<VasilhameVendaRequest>? Vasilhames,
    List<PagamentoRequest>? Pagamentos,
    List<CascoQuantidadeRequest>? CascosDevolvidos,
    List<SucataEntregueRequest>? SucataEntregue,
    string? Observacao,
    Guid? CaixaId = null);

public sealed record CancelarVendaRequest(Guid FuncionarioId);

public sealed record VendaResponse(
    Guid Id,
    decimal TotalBruto,
    decimal TotalDesconto,
    decimal DescontoSucata,
    decimal TotalLiquido,
    decimal TotalPago,
    decimal SaldoFiadoGerado,
    decimal CreditoGerado,
    StatusPagamento StatusPagamento,
    long SaldoCascoCliente,
    IReadOnlyList<CascoPorTipoResponse> SaldoCascoClientePorTipo)
{
    public static VendaResponse From(ResultadoVenda r) => new(
        r.Id, r.TotalBruto, r.TotalDesconto, r.DescontoSucata, r.TotalLiquido, r.TotalPago,
        r.SaldoFiadoGerado, r.CreditoGerado, r.StatusPagamento, r.SaldoCascoCliente,
        r.SaldoCascoClientePorTipo.Select(s => new CascoPorTipoResponse(s.TipoCascoId, s.Nome, s.Saldo)).ToList());
}

public sealed record ItemVendaResponse(
    Guid ProdutoId,
    Guid MarcaId,
    Guid? TipoCascoId,
    int Quantidade,
    decimal PrecoUnitario,
    TipoDesconto? DescontoTipo,
    decimal? DescontoValor,
    string? MotivoDesconto,
    decimal TotalItem);

public sealed record VasilhameResponse(
    Guid TipoCascoId,
    int Quantidade,
    int QuantidadeAbatida,
    decimal PrecoUnitario,
    ModoCreditoVasilhame Modo,
    decimal Total);

public sealed record SucataEntregueResponse(Guid TipoCascoId, int Quantidade, decimal ValorUnitario);

public sealed record UltimoPrecoResponse(Guid VendaId, DateTimeOffset Data, decimal PrecoUnitario);

public sealed record PagamentoResponse(FormaPagamento Forma, decimal Valor);

public sealed record VendaDetalheResponse(
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
    IReadOnlyList<ItemVendaResponse> Itens,
    IReadOnlyList<VasilhameResponse> Vasilhames,
    IReadOnlyList<PagamentoResponse> Pagamentos,
    IReadOnlyList<CascoQuantidadeResponse> CascosDevolvidos,
    IReadOnlyList<SucataEntregueResponse> SucataEntregue,
    string? CupomNumero,
    DateTimeOffset? CupomEmitidoEm)
{
    public static VendaDetalheResponse From(Venda v) => new(
        v.Id, v.ClienteId, v.FuncionarioId, v.EnderecoEntregaId, v.Data,
        v.TotalBruto, v.TotalDesconto, v.TotalLiquido, v.StatusPagamento,
        v.Observacao, v.CupomEmitido,
        v.Itens.Select(i => new ItemVendaResponse(
            i.ProdutoId, i.MarcaId, i.TipoCascoId, i.Quantidade, i.PrecoUnitario,
            i.Desconto?.Tipo, i.Desconto?.Valor, i.Desconto?.Motivo, i.TotalItem)).ToList(),
        v.Vasilhames.Select(x => new VasilhameResponse(
            x.TipoCascoId, x.Quantidade, x.QuantidadeAbatida, x.PrecoUnitario, x.Modo, x.Total)).ToList(),
        v.Pagamentos.Select(p => new PagamentoResponse(p.Forma, p.Valor)).ToList(),
        v.CascosDevolvidos.Select(c => new CascoQuantidadeResponse(c.TipoCascoId, c.Quantidade)).ToList(),
        v.SucataEntregue.Select(c => new SucataEntregueResponse(c.TipoCascoId, c.Quantidade, c.ValorUnitario)).ToList(),
        v.CupomNumero, v.CupomEmitidoEm);
}

public sealed record AddPagamentoRequest(FormaPagamento Forma, decimal Valor);

public sealed record CupomFiscalResponse(Guid CupomId, string Numero, DateTimeOffset EmitidoEm);

public sealed record CriarPedidoRequest(
    Guid FuncionarioId,
    Guid ClienteId,
    Guid? EnderecoEntregaId,
    IReadOnlyList<ItemVendaRequest>? Itens,
    IReadOnlyList<Guid>? FuncionariosIds,
    string? Observacao);

public sealed record IniciarPedidoRequest(Guid FuncionarioId, IReadOnlyList<Guid>? FuncionariosIds);

public sealed record CancelarPedidoRequest(Guid FuncionarioId);

public sealed record OcorrenciaPerdaRequest(
    GalaoPerda Galao, Guid? ProdutoId, Guid? MarcaId, Guid? TipoCascoId, int Quantidade, MotivoPerda Motivo);

public sealed record RegistrarPerdasRequest(Guid FuncionarioId, IReadOnlyList<OcorrenciaPerdaRequest>? Ocorrencias);

public sealed record PerdaPedidoResponse(
    GalaoPerda Galao, Guid? ProdutoId, Guid? MarcaId, Guid TipoCascoId, int Quantidade, MotivoPerda Motivo,
    DateTimeOffset RegistradoEm);

public sealed record PedidoResumoResponse(
    Guid Id,
    Guid ClienteId,
    Guid? EnderecoEntregaId,
    StatusPedido Status,
    string? Observacao,
    DateTimeOffset CreatedAt,
    DateTimeOffset? IniciadoEm,
    DateTimeOffset? CanceladoEm)
{
    public static PedidoResumoResponse From(PedidoResumo p) => new(
        p.Id, p.ClienteId, p.EnderecoEntregaId, p.Status, p.Observacao, p.CreatedAt, p.IniciadoEm, p.CanceladoEm);
}

public sealed record ItemPedidoResponse(
    Guid ProdutoId, Guid MarcaId, int Quantidade, decimal PrecoUnitario, DescontoRequest? Desconto);

public sealed record FuncionarioPedidoResponse(Guid Id, string Nome);

public sealed record PedidoResponse(
    Guid Id,
    Guid ClienteId,
    Guid? EnderecoEntregaId,
    StatusPedido Status,
    string? Observacao,
    Guid CreatedBy,
    DateTimeOffset CreatedAt,
    DateTimeOffset? IniciadoEm,
    DateTimeOffset? CanceladoEm,
    Guid? CanceladoPor,
    IReadOnlyList<ItemPedidoResponse> Itens,
    IReadOnlyList<FuncionarioPedidoResponse> Funcionarios,
    Guid? VendaId,
    IReadOnlyList<PerdaPedidoResponse> Perdas)
{
    public static PedidoResponse From(Pedido p) => new(
        p.Id, p.ClienteId, p.EnderecoEntregaId, p.Status, p.Observacao, p.CreatedBy, p.CreatedAt, p.IniciadoEm,
        p.CanceladoEm, p.CanceladoPor,
        p.Itens.Select(i => new ItemPedidoResponse(
            i.ProdutoId, i.MarcaId, i.Quantidade, i.PrecoUnitario,
            i.Desconto is null ? null : new DescontoRequest(i.Desconto.Tipo, i.Desconto.Valor, i.Desconto.Motivo)))
            .ToList(),
        p.Funcionarios.Select(f => new FuncionarioPedidoResponse(f.Id, f.Nome)).ToList(), p.VendaId,
        (p.Perdas ?? []).Select(x => new PerdaPedidoResponse(
            x.Galao, x.ProdutoId, x.MarcaId, x.TipoCascoId, x.Quantidade, x.Motivo, x.RegistradoEm)).ToList());
}
