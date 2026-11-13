import { FormaPagamento, StatusPagamento } from '../../core/api/models/vendas';

/** Nome no cache da VendaStore: resolvido por GET /v1/clientes/{id} ou /v1/estoque/produtos/{id}. */
export type EstadoNome =
  { estado: 'carregando' } | { estado: 'ok'; nome: string } | { estado: 'removido' };
export type EstadoCliente = EstadoNome;
export type EstadoProduto = EstadoNome;

export function rotuloCliente(estado: EstadoCliente | undefined): string {
  switch (estado?.estado) {
    case 'ok':
      return estado.nome;
    case 'removido':
      return 'Cliente removido';
    default:
      return 'Carregando cliente…';
  }
}

export function rotuloProduto(estado: EstadoProduto | undefined): string {
  switch (estado?.estado) {
    case 'ok':
      return estado.nome;
    case 'removido':
      return 'Produto removido';
    default:
      return 'Carregando produto…';
  }
}

const STATUS: Record<StatusPagamento, string> = {
  PENDENTE: 'Pendente',
  PARCIAL: 'Parcial',
  PAGA: 'Paga',
};

export function rotuloStatusPagamento(status: StatusPagamento): string {
  return STATUS[status] ?? status;
}

const FORMAS: Record<FormaPagamento, string> = {
  PIX: 'PIX',
  CARTAO_CREDITO: 'Cartão de crédito',
  CARTAO_DEBITO: 'Cartão de débito',
  DINHEIRO: 'Dinheiro',
  OUTRO: 'Outro',
};

export function rotuloForma(forma: FormaPagamento): string {
  return FORMAS[forma] ?? forma;
}
