using ControleEstoque.Vendas.Domain;

namespace ControleEstoque.Vendas.Contracts;

public sealed record DescontoRequest(TipoDesconto Tipo, decimal Valor, string? Motivo);

public sealed record ItemVendaRequest(
    Guid ProdutoId, Guid MarcaId, int Quantidade, decimal PrecoUnitario, DescontoRequest? Desconto,
    bool PagouVasilhame = false);

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
    List<PagamentoRequest>? Pagamentos,
    List<CascoQuantidadeRequest>? CascosDevolvidos,
    List<CascoQuantidadeRequest>? SucataEntregue,
    string? Observacao);

public sealed record VendaResponse(
    Guid Id,
    decimal TotalBruto,
    decimal TotalDesconto,
    decimal TotalLiquido,
    decimal TotalPago,
    decimal SaldoFiadoGerado,
    StatusPagamento StatusPagamento,
    long SaldoCascoCliente,
    IReadOnlyList<CascoPorTipoResponse> SaldoCascoClientePorTipo)
{
    public static VendaResponse From(ResultadoVenda r) => new(
        r.Id, r.TotalBruto, r.TotalDesconto, r.TotalLiquido, r.TotalPago,
        r.SaldoFiadoGerado, r.StatusPagamento, r.SaldoCascoCliente,
        r.SaldoCascoClientePorTipo.Select(s => new CascoPorTipoResponse(s.TipoCascoId, s.Nome, s.Saldo)).ToList());
}

public sealed record ItemVendaResponse(
    Guid ProdutoId,
    Guid MarcaId,
    Guid? TipoCascoId,
    int Quantidade,
    decimal PrecoUnitario,
    bool PagouVasilhame,
    decimal? PrecoVasilhame,
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
    IReadOnlyList<PagamentoResponse> Pagamentos,
    IReadOnlyList<CascoQuantidadeResponse> CascosDevolvidos,
    IReadOnlyList<CascoQuantidadeResponse> SucataEntregue,
    string? CupomNumero,
    DateTimeOffset? CupomEmitidoEm)
{
    public static VendaDetalheResponse From(Venda v) => new(
        v.Id, v.ClienteId, v.FuncionarioId, v.EnderecoEntregaId, v.Data,
        v.TotalBruto, v.TotalDesconto, v.TotalLiquido, v.StatusPagamento,
        v.Observacao, v.CupomEmitido,
        v.Itens.Select(i => new ItemVendaResponse(
            i.ProdutoId, i.MarcaId, i.TipoCascoId, i.Quantidade, i.PrecoUnitario, i.PagouVasilhame,
            i.PrecoVasilhame, i.Desconto?.Tipo, i.Desconto?.Valor, i.Desconto?.Motivo, i.TotalItem)).ToList(),
        v.Pagamentos.Select(p => new PagamentoResponse(p.Forma, p.Valor)).ToList(),
        v.CascosDevolvidos.Select(c => new CascoQuantidadeResponse(c.TipoCascoId, c.Quantidade)).ToList(),
        v.SucataEntregue.Select(c => new CascoQuantidadeResponse(c.TipoCascoId, c.Quantidade)).ToList(),
        v.CupomNumero, v.CupomEmitidoEm);
}

public sealed record AddPagamentoRequest(FormaPagamento Forma, decimal Valor);

public sealed record CupomFiscalResponse(Guid CupomId, string Numero, DateTimeOffset EmitidoEm);
