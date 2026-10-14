/**
 * Mapa central código de erro da API → mensagem pt-BR.
 * Códigos vêm de ControlledFailureException e derivadas (ver PLANO_IMPLEMENTACAO.md §4/§7.5).
 */
const MENSAGENS: Record<string, string> = {
  ESTOQUE_INSUFICIENTE: 'Estoque insuficiente para o produto.',
  QUANTIDADE_INVALIDA: 'Quantidade inválida para a operação.',
  RESPONSAVEL_OBRIGATORIO: 'Informe ao menos um funcionário responsável pela quebra.',
  MARCA_DUPLICADA: 'Já existe uma marca com esse nome.',
  CLIENTE_NAO_ENCONTRADO: 'Cliente não encontrado.',
  PAGAMENTO_EXCEDE_TOTAL: 'A soma dos pagamentos ultrapassa o total da venda.',
  PAGAMENTO_EXCEDE_SALDO: 'O valor do pagamento é maior que o saldo devedor.',
  DESCONTO_SEM_MOTIVO: 'Informe o motivo do desconto.',
  DESCONTO_INVALIDO: 'Valor do desconto inválido.',
  DESCONTO_MAIOR_QUE_ITEM: 'O desconto não pode exceder o valor do item.',
  ITENS_OBRIGATORIOS: 'A venda deve ter ao menos um item.',
  PAGAMENTO_INVALIDO: 'Valor de pagamento deve ser positivo.',
  PRECO_INVALIDO: 'Preço unitário inválido.',
  VENDA_JA_FATURADA: 'Venda com cupom fiscal emitido não pode ser editada.',
  VENDA_NAO_ENCONTRADA: 'Venda não encontrada.',
  CUPOM_JA_EMITIDO: 'Cupom fiscal já emitido para esta venda.',
  PRODUTO_NAO_ENCONTRADO: 'Produto não encontrado.',
  FUNCIONARIO_NAO_ENCONTRADO: 'Funcionário não encontrado.',
  ENDERECO_NAO_PERTENCE_AO_CLIENTE: 'O endereço de entrega não pertence ao cliente.',
  CONVERSAO_MAIOR_QUE_SALDO: 'Quantidade maior que o saldo de cascos do cliente.',
  MARCA_OBRIGATORIA: 'Marca é obrigatória para água e galão completo.',
  CARGO_NATIVO: 'O cargo ADM é nativo e não pode ser alterado.',
  CAIXA_FECHADO: 'O caixa do dia já está fechado.',
  CAIXA_JA_FECHADO: 'O caixa do dia já está fechado.',
  CAIXA_NAO_ABERTO: 'O caixa do dia ainda não foi aberto.',
};

const GENERICA_POR_STATUS: Record<number, string> = {
  0: 'Sem conexão com o servidor. Verifique a rede e tente novamente.',
  400: 'Dados inválidos. Revise o formulário e tente novamente.',
  404: 'Registro não encontrado.',
  409: 'Operação conflita com um registro existente.',
  422: 'A operação viola uma regra de negócio.',
  500: 'Erro no servidor. Tente novamente em instantes.',
};

export function mensagemDoErro(code: string, status: number, serverMessage?: string): string {
  return (
    MENSAGENS[code] ?? serverMessage ?? GENERICA_POR_STATUS[status] ?? 'Ocorreu um erro inesperado.'
  );
}
