namespace ControleEstoque.Vendas.Domain;

// Os nomes dos membros espelham exatamente os labels dos ENUMs do PostgreSQL
// (init.sql) e o contrato JSON das APIs — não renomear.

public enum TipoProduto
{
    AGUA,
    GALAO_COMPLETO,
    CASCO,
    SUCATA,
    DESCARTAVEL
}

public enum FormaPagamento
{
    PIX,
    CARTAO_CREDITO,
    CARTAO_DEBITO,
    DINHEIRO,
    OUTRO
}

public enum StatusPagamento
{
    PENDENTE,
    PARCIAL,
    PAGA
}

public enum TipoDesconto
{
    VALOR,
    PERCENTUAL
}
