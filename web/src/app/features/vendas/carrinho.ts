import { ProdutoResponse } from '../../core/api/models/estoque';
import { ItemVendaRequest, TipoDesconto } from '../../core/api/models/vendas';

export interface DescontoCarrinho {
  readonly tipo: TipoDesconto;
  readonly valor: number;
  readonly motivo: string;
}

export interface ItemCarrinho {
  readonly produto: ProdutoResponse;
  readonly quantidade: number;
  readonly precoUnitario: number;
  readonly desconto: DescontoCarrinho | null;
}

// Espelho client-side de VendaCalculos (backend) — SÓ para feedback ao vivo;
// os totais oficiais vêm sempre do response do servidor (Regra 8.6).

export function brutoDe(item: ItemCarrinho): number {
  return item.quantidade * item.precoUnitario;
}

export function valorDescontoDe(item: ItemCarrinho): number {
  if (item.desconto === null) {
    return 0;
  }
  const bruto = brutoDe(item);
  const valor =
    item.desconto.tipo === 'PERCENTUAL'
      ? Math.round(bruto * item.desconto.valor) / 100
      : item.desconto.valor;
  return Math.min(valor, bruto);
}

export function totalItemDe(item: ItemCarrinho): number {
  return brutoDe(item) - valorDescontoDe(item);
}

export function paraItemRequest(item: ItemCarrinho): ItemVendaRequest {
  return {
    produtoId: item.produto.id,
    quantidade: item.quantidade,
    precoUnitario: item.precoUnitario,
    desconto:
      item.desconto === null
        ? null
        : { tipo: item.desconto.tipo, valor: item.desconto.valor, motivo: item.desconto.motivo },
  };
}
