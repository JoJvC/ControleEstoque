import { produtoResp } from '../../core/api/testing';
import { ItemCarrinho } from './carrinho';

/** Fixture de spec: linha do carrinho com a primeira marca do produto, em troca (sem vasilhame pago). */
export function itemCarrinho(p: Partial<ItemCarrinho> = {}): ItemCarrinho {
  const produto = p.produto ?? produtoResp();
  return {
    produto,
    marca: produto.marcas[0],
    quantidade: 1,
    precoUnitario: 50,
    desconto: null,
    pagouVasilhame: false,
    precoVasilhame: 0,
    ...p,
  };
}
