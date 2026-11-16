namespace ControleEstoque.Vendas.Domain;

// Os nomes dos membros espelham exatamente os labels dos ENUMs do PostgreSQL
// (init.sql) e o contrato JSON das APIs — não renomear.

public enum TipoProduto
{
    RETORNAVEL,
    DESCARTAVEL
}

public enum FormaPagamento
{
    PIX,
    CARTAO_CREDITO,
    CARTAO_DEBITO,
    DINHEIRO,
    OUTRO,
    CREDITO_CLIENTE // "Crédito do cliente": usa o saldo positivo; não é dinheiro que entra no caixa
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

/// <summary>Como o vasilhame vendido trata o crédito de galão do cliente no tipo.</summary>
public enum ModoCreditoVasilhame
{
    ABATER_CREDITO, // padrão: vasilhames cobertos pelo crédito não são cobrados e o crédito diminui
    COMPRAR         // cobra tudo e o crédito segue
}
