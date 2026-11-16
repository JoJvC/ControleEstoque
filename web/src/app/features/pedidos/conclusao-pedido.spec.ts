import { ItemPedidoResponse } from '../../core/api/models/pedidos';
import { marcaResp, produtoResp } from '../../core/api/testing';
import { RascunhoVenda } from '../vendas/carrinho';
import { itemCarrinho } from '../vendas/testing';
import { itensDoPedido, paraConcluirPedidoRequest } from './conclusao-pedido';

const AGUA = produtoResp({
  id: 'pr-1',
  tipo: 'RETORNAVEL',
  nome: 'Água 20L',
  marcas: [marcaResp({ marcaId: 'm-1', tipoCascoResolvidoId: 't-1' })],
});
const item = (p: Partial<ItemPedidoResponse> = {}): ItemPedidoResponse => ({
  produtoId: 'pr-1',
  marcaId: 'm-1',
  quantidade: 2,
  precoUnitario: 12,
  desconto: null,
  ...p,
});

describe('itensDoPedido', () => {
  it('resolve produto e marca pelos ids e mantém quantidade e preço', () => {
    const { itens, foraDoCatalogo } = itensDoPedido([item()], [AGUA]);
    expect(foraDoCatalogo).toBe(0);
    expect(itens).toEqual([
      {
        produto: AGUA,
        marca: AGUA.marcas[0],
        quantidade: 2,
        precoUnitario: 12,
        desconto: null,
      },
    ]);
  });

  it('mapeia o desconto (tipo, valor e motivo; motivo nulo vira texto vazio)', () => {
    const { itens } = itensDoPedido(
      [
        item({ desconto: { tipo: 'PERCENTUAL', valor: 10, motivo: 'cliente antigo' } }),
        item({ desconto: { tipo: 'VALOR', valor: 3, motivo: null } }),
      ],
      [AGUA],
    );
    expect(itens[0].desconto).toEqual({ tipo: 'PERCENTUAL', valor: 10, motivo: 'cliente antigo' });
    expect(itens[1].desconto).toEqual({ tipo: 'VALOR', valor: 3, motivo: '' });
  });

  it('item fora do catálogo (produto ou marca) não entra e é contado', () => {
    const { itens, foraDoCatalogo } = itensDoPedido(
      [item(), item({ produtoId: 'pr-x' }), item({ marcaId: 'm-x' })],
      [AGUA],
    );
    expect(itens).toHaveLength(1);
    expect(foraDoCatalogo).toBe(2);
  });
});

describe('paraConcluirPedidoRequest', () => {
  const rascunho: Omit<RascunhoVenda, 'clienteId' | 'enderecoEntregaId'> = {
    funcionarioId: 'op-1',
    itens: [itemCarrinho({ produto: AGUA, quantidade: 2, precoUnitario: 12 })],
    vasilhames: [],
    pagamentos: [{ forma: 'DINHEIRO', valor: 10 }],
    cascosDevolvidos: { 't-1': 2 },
    cascosNaHora: false,
    sucataEntregue: {},
    sucataValores: {},
  };
  const tipos = [
    {
      id: 't-1',
      nome: 'Casco 20L',
      marcaId: null,
      marca: null,
      precoVasilhame: 30,
      aceitaSucata: true,
    },
  ];

  it('é o corpo da venda sem cliente, endereço nem caixa, com o funcionário do operador e observação nula', () => {
    const request = paraConcluirPedidoRequest(rascunho, tipos);
    expect(request).toEqual({
      funcionarioId: 'op-1',
      itens: [
        { produtoId: 'pr-1', marcaId: 'm-1', quantidade: 2, precoUnitario: 12, desconto: null },
      ],
      vasilhames: [],
      pagamentos: [{ forma: 'DINHEIRO', valor: 10 }],
      cascosDevolvidos: [{ tipoCascoId: 't-1', quantidade: 2 }],
      sucataEntregue: [],
      observacao: null,
    });
    for (const campo of ['clienteId', 'enderecoEntregaId', 'caixaId']) {
      expect(request).not.toHaveProperty(campo);
    }
  });

  it('pagamento parcial segue como está (o saldo vira fiado no servidor)', () => {
    const request = paraConcluirPedidoRequest(rascunho, tipos);
    expect(request.pagamentos).toEqual([{ forma: 'DINHEIRO', valor: 10 }]);
  });
});
