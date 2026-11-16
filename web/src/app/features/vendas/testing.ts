import { produtoResp } from '../../core/api/testing';
import { ItemCarrinho } from './carrinho';
import { CobrarEstado } from './cobrar-estado';

/** Fixture de spec: linha do carrinho com a primeira marca do produto, sem desconto. */
export function itemCarrinho(p: Partial<ItemCarrinho> = {}): ItemCarrinho {
  const produto = p.produto ?? produtoResp();
  return {
    produto,
    marca: produto.marcas[0],
    quantidade: 1,
    precoUnitario: 50,
    desconto: null,
    ...p,
  };
}

/** Fixture de spec: o estado de cobrança com um tipo de casco (20L, aceita sucata) e pagamento em PIX. */
export function estadoCobrar(p: Partial<CobrarEstado> = {}): CobrarEstado {
  return {
    itens: [itemCarrinho({ quantidade: 5 })],
    totais: { bruto: 250, desconto: 0, liquido: 250 },
    vasilhames: [],
    totalVasilhames: 0,
    descontoSucata: 0,
    sucataExcede: false,
    cascos: [
      {
        tipoCascoId: 't-1',
        nome: 'Casco 20L',
        aceitaSucata: true,
        vendidosEmTroca: 5,
        devolvidos: 3,
        travado: false,
        sucata: 1,
        valorSucata: 0,
        naRua: 2,
        aMais: 0,
      },
    ],
    cascosNaHora: false,
    clienteNome: 'Ana',
    pagamentos: [{ forma: 'PIX', valor: 200 }],
    creditoDisponivel: null,
    nomeDoCliente: 'Ana',
    erro: null,
    enviando: false,
    podeRegistrar: true,
    rotuloConfirmar: 'Confirmar venda',
    ...p,
  };
}
