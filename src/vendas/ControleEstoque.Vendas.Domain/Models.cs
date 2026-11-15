using ControleEstoque.Shared.Results;

namespace ControleEstoque.Vendas.Domain;

public sealed record Desconto(TipoDesconto Tipo, decimal Valor, string Motivo);

/// <summary>Item = produto+marca. PagouVasilhame soma o vasilhame ao bruto e não gera empréstimo de casco.</summary>
public sealed record ItemVenda(
    Guid ProdutoId, Guid MarcaId, int Quantidade, decimal PrecoUnitario, Desconto? Desconto,
    bool PagouVasilhame = false);

public sealed record PagamentoVenda(FormaPagamento Forma, decimal Valor);

/// <summary>Quantidade de casco (devolvido, emprestado ou sucata) de um tipo de casco.</summary>
public sealed record CascoQuantidade(Guid TipoCascoId, int Quantidade);

public sealed record SaldoCascoTipo(Guid TipoCascoId, string Nome, long Saldo);

/// <summary>Comando de criação/edição de venda, como chega da API.</summary>
public sealed record NovaVenda(
    Guid ClienteId,
    Guid FuncionarioId,
    Guid? EnderecoEntregaId,
    IReadOnlyList<ItemVenda> Itens,
    IReadOnlyList<PagamentoVenda> Pagamentos,
    IReadOnlyList<CascoQuantidade> CascosDevolvidos,
    IReadOnlyList<CascoQuantidade> SucataEntregue,
    string? Observacao);

/// <summary>Resolução do item no banco: associação, casco resolvido e preço do vasilhame desse casco.</summary>
public sealed record ItemResolvido(Guid ProdutoMarcaId, Guid? TipoCascoId, decimal PrecoVasilhame);

/// <summary>
/// Item com totais já calculados pelo sistema (nunca aceitos do cliente HTTP). O bruto inclui o vasilhame
/// quando PagouVasilhame; PrecoVasilhame é o preço aplicado (null quando não pagou).
/// </summary>
public sealed record ItemCalculado(
    Guid ProdutoId,
    Guid MarcaId,
    Guid ProdutoMarcaId,
    Guid? TipoCascoId,
    int Quantidade,
    decimal PrecoUnitario,
    Desconto? Desconto,
    bool PagouVasilhame,
    decimal? PrecoVasilhame,
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
    decimal TotalLiquido,
    StatusPagamento Status,
    IReadOnlyList<ItemCalculado> Itens,
    IReadOnlyList<PagamentoVenda> Pagamentos,
    IReadOnlyList<CascoQuantidade> CascosEmprestados,
    IReadOnlyList<CascoQuantidade> CascosDevolvidos,
    IReadOnlyList<CascoQuantidade> SucataEntregue,
    decimal DebitoFiado);

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
    decimal TotalLiquido,
    decimal TotalPago,
    decimal SaldoFiadoGerado,
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
    IReadOnlyList<CascoQuantidade> SucataEntregue,
    string? CupomNumero = null,
    DateTimeOffset? CupomEmitidoEm = null);

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
