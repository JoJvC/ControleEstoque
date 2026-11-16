namespace ControleEstoque.Estoque.Domain;

// Os nomes dos membros espelham exatamente os labels dos ENUMs do PostgreSQL
// (init.sql) e o contrato JSON das APIs — não renomear.

/// <summary>Comportamento do produto no sistema (não a natureza da mercadoria).</summary>
public enum TipoProduto
{
    RETORNAVEL,
    DESCARTAVEL
}

/// <summary>Situação do casco no estoque físico, por tipo de casco.</summary>
public enum SituacaoCasco
{
    VAZIO,
    SUCATA
}

public enum TipoMovimentoEstoque
{
    ENTRADA_ABASTECIMENTO,
    SAIDA_VENDA,
    DEVOLUCAO_CLIENTE,
    ENTRADA_SUCATA,
    BAIXA_QUEBRA,
    BAIXA_PERDA,
    AJUSTE
}

public enum TipoFrete
{
    TERCEIRIZADO,
    PROPRIO
}
