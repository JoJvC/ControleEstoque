import { ProdutoMarcaResponse, ProdutoResponse } from '../../core/api/models/estoque';
import {
  adicionarItem,
  alterarQuantidade,
  itemDoPedido,
  paraCriarPedidoRequest,
  podeCancelar,
  podeIniciar,
  rotuloStatus,
  selecaoInicial,
} from './pedido-form';

const MARCA = {
  id: 'pm-1',
  marcaId: 'm-1',
  marcaNome: 'Cristal',
  precoReferencia: 12.5,
} as ProdutoMarcaResponse;
const OUTRA = {
  id: 'pm-2',
  marcaId: 'm-2',
  marcaNome: 'Serra',
  precoReferencia: 9,
} as ProdutoMarcaResponse;
const PRODUTO = { id: 'p-1', nome: 'Água 20L', marcas: [MARCA, OUTRA] } as ProdutoResponse;

describe('pedido-form', () => {
  it('rotuloStatus', () => {
    expect(rotuloStatus('PENDENTE')).toBe('Pendente');
    expect(rotuloStatus('EM_ANDAMENTO')).toBe('Em andamento');
    expect(rotuloStatus('CONCLUIDO')).toBe('Concluído');
    expect(rotuloStatus('CANCELADO')).toBe('Cancelado');
  });

  it('itemDoPedido: quantidade 1 e preço de referência da marca', () => {
    const item = itemDoPedido(PRODUTO, MARCA);
    expect(item.quantidade).toBe(1);
    expect(item.precoUnitario).toBe(12.5);
    expect(item.desconto).toBeNull();
  });

  it('adicionarItem: mesmo produto+marca soma 1; outra marca cria linha', () => {
    const um = adicionarItem([], PRODUTO, MARCA);
    const dois = adicionarItem(um, PRODUTO, MARCA);
    expect(dois).toHaveLength(1);
    expect(dois[0].quantidade).toBe(2);
    expect(adicionarItem(dois, PRODUTO, OUTRA)).toHaveLength(2);
  });

  it('alterarQuantidade: soma, subtrai e remove ao chegar a 0', () => {
    const itens = adicionarItem(adicionarItem([], PRODUTO, MARCA), PRODUTO, OUTRA);
    const mais = alterarQuantidade(itens, PRODUTO, MARCA, 1);
    expect(mais[0].quantidade).toBe(2);
    expect(mais[1].quantidade).toBe(1);
    const menos = alterarQuantidade(mais, PRODUTO, MARCA, -1);
    expect(menos[0].quantidade).toBe(1);
    const removido = alterarQuantidade(menos, PRODUTO, MARCA, -1);
    expect(removido.map((i) => i.marca.marcaId)).toEqual(['m-2']);
  });

  it('paraCriarPedidoRequest: manda marca.marcaId, desconto null e observação aparada', () => {
    const itens = alterarQuantidade(adicionarItem([], PRODUTO, MARCA), PRODUTO, MARCA, 1);
    expect(
      paraCriarPedidoRequest({
        funcionarioId: 'f-op',
        clienteId: 'c-1',
        enderecoEntregaId: 'e-1',
        itens,
        funcionariosIds: ['f-1'],
        observacao: '  entregar cedo ',
      }),
    ).toEqual({
      funcionarioId: 'f-op',
      clienteId: 'c-1',
      enderecoEntregaId: 'e-1',
      itens: [
        { produtoId: 'p-1', marcaId: 'm-1', quantidade: 2, precoUnitario: 12.5, desconto: null },
      ],
      funcionariosIds: ['f-1'],
      observacao: 'entregar cedo',
    });
  });

  it('paraCriarPedidoRequest: observação vazia vira null', () => {
    const req = paraCriarPedidoRequest({
      funcionarioId: 'f',
      clienteId: 'c',
      enderecoEntregaId: null,
      itens: [],
      funcionariosIds: [],
      observacao: '   ',
    });
    expect(req.observacao).toBeNull();
    expect(req.enderecoEntregaId).toBeNull();
  });

  it('selecaoInicial: só os do cadastro que estão ativos', () => {
    const pedido = {
      funcionarios: [
        { id: 'a', nome: 'A' },
        { id: 'b', nome: 'B' },
      ],
    };
    expect([...selecaoInicial(pedido, [{ id: 'a' }, { id: 'c' }])]).toEqual(['a']);
    expect(selecaoInicial({ funcionarios: [] }, [{ id: 'a' }]).size).toBe(0);
  });

  it('podeIniciar e podeCancelar por status', () => {
    expect(podeIniciar('PENDENTE')).toBe(true);
    expect(podeIniciar('EM_ANDAMENTO')).toBe(false);
    expect(podeCancelar('PENDENTE')).toBe(true);
    expect(podeCancelar('EM_ANDAMENTO')).toBe(true);
    expect(podeCancelar('CONCLUIDO')).toBe(false);
    expect(podeCancelar('CANCELADO')).toBe(false);
  });
});
