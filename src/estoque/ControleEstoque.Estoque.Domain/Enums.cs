namespace ControleEstoque.Estoque.Domain;

// Os nomes dos membros espelham exatamente os labels dos ENUMs do PostgreSQL
// (init.sql) e o contrato JSON das APIs — não renomear.

/// <summary>Comportamento do produto no sistema (não a natureza da mercadoria).</summary>
public enum TipoProduto
{
    AGUA,
    GALAO_COMPLETO,
    CASCO,
    SUCATA,
    DESCARTAVEL
}

public enum TipoMovimentoEstoque
{
    ENTRADA_ABASTECIMENTO,
    SAIDA_VENDA,
    DEVOLUCAO_CLIENTE,
    ENTRADA_SUCATA,
    BAIXA_QUEBRA,
    AJUSTE
}

public enum TipoFrete
{
    TERCEIRIZADO,
    PROPRIO
}
