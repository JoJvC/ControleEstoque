using ControleEstoque.Vendas.Domain;

namespace ControleEstoque.Vendas.Contracts;

public sealed record DescontoRequest(TipoDesconto Tipo, decimal Valor, string? Motivo);

public sealed record ItemVendaRequest(
    Guid ProdutoId, int Quantidade, decimal PrecoUnitario, DescontoRequest? Desconto);

public sealed record PagamentoRequest(FormaPagamento Forma, decimal Valor);

public sealed record CreateVendaRequest(
    Guid ClienteId,
    Guid FuncionarioId,
    Guid? EnderecoEntregaId,
    List<ItemVendaRequest>? Itens,
    List<PagamentoRequest>? Pagamentos,
    int CascosDevolvidos,
    bool CascosDevolvidosNaHora,
    int SucataEntregue,
    string? Observacao);

public sealed record VendaResponse(
    Guid Id,
    decimal TotalBruto,
    decimal TotalDesconto,
    decimal TotalLiquido,
    decimal TotalPago,
    decimal SaldoFiadoGerado,
    StatusPagamento StatusPagamento,
    long SaldoCascoCliente)
{
    public static VendaResponse From(ResultadoVenda r) => new(
        r.Id, r.TotalBruto, r.TotalDesconto, r.TotalLiquido, r.TotalPago,
        r.SaldoFiadoGerado, r.StatusPagamento, r.SaldoCascoCliente);
}

public sealed record ItemVendaResponse(
    Guid ProdutoId,
    int Quantidade,
    decimal PrecoUnitario,
    TipoDesconto? DescontoTipo,
    decimal? DescontoValor,
    string? MotivoDesconto,
    decimal TotalItem);

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
    IReadOnlyList<PagamentoResponse> Pagamentos)
{
    public static VendaDetalheResponse From(Venda v) => new(
        v.Id, v.ClienteId, v.FuncionarioId, v.EnderecoEntregaId, v.Data,
        v.TotalBruto, v.TotalDesconto, v.TotalLiquido, v.StatusPagamento,
        v.Observacao, v.CupomEmitido,
        v.Itens.Select(i => new ItemVendaResponse(
            i.ProdutoId, i.Quantidade, i.PrecoUnitario,
            i.Desconto?.Tipo, i.Desconto?.Valor, i.Desconto?.Motivo, i.TotalItem)).ToList(),
        v.Pagamentos.Select(p => new PagamentoResponse(p.Forma, p.Valor)).ToList());
}

public sealed record AddPagamentoRequest(FormaPagamento Forma, decimal Valor);

public sealed record CupomFiscalResponse(Guid CupomId, string Numero, DateTimeOffset EmitidoEm);
