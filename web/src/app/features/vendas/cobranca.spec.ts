import { signal } from '@angular/core';

import { SaldosResponse } from '../../core/api/models/clientes';
import { TipoCascoResponse } from '../../core/api/models/estoque';
import { marcaResp, produtoResp } from '../../core/api/testing';
import { PagamentoEdicao } from '../../ui/organisms/pagamento-lista';
import { ItemCarrinho, VasilhameCarrinho } from './carrinho';
import { QuantidadesPorTipo } from './cascos-por-tipo';
import { PAGAMENTO_PADRAO, criarCobranca } from './cobranca';
import { itemCarrinho } from './testing';

const TIPO: TipoCascoResponse = {
  id: 't-1',
  nome: 'Casco 20L',
  marcaId: null,
  marca: null,
  precoVasilhame: 30,
  aceitaSucata: true,
};
const AGUA = produtoResp({
  tipo: 'RETORNAVEL',
  marcas: [marcaResp({ tipoCascoResolvidoId: 't-1' })],
});
const SALDOS = (creditoDisponivel: number): SaldosResponse => ({
  saldoCascos: 3,
  sucataEntregue: 0,
  saldoFiado: 0,
  saldo: creditoDisponivel,
  creditoDisponivel,
  cascosPorTipo: [{ tipoCascoId: 't-1', nome: 'Casco 20L', saldo: 3 }],
  sucataPorTipo: [],
});

// A extração no contexto da conclusão de pedido: nada de edição, endereço vem do pedido.
function montar(saldos: SaldosResponse | null = null) {
  const r = {
    itens: signal<readonly ItemCarrinho[]>([
      itemCarrinho({ produto: AGUA, quantidade: 2, precoUnitario: 12 }),
    ]),
    vasilhames: signal<readonly VasilhameCarrinho[]>([]),
    cascosDevolvidos: signal<QuantidadesPorTipo>({}),
    cascosNaHora: signal(false),
    sucataEntregue: signal<QuantidadesPorTipo>({}),
    sucataValores: signal<QuantidadesPorTipo>({}),
    pagamentos: signal<readonly PagamentoEdicao[]>(PAGAMENTO_PADRAO),
    tiposCasco: signal<readonly TipoCascoResponse[]>([TIPO]),
    saldos: signal<SaldosResponse | null>(saldos),
  };
  const cobranca = criarCobranca(r, {
    edicao: () => false,
    creditoEdicao: () => ({}),
    vendaCarregada: () => null,
    rotuloConfirmar: () => 'Concluir pedido',
    enderecoOk: () => true,
    nomeDoCliente: () => 'Ana',
    erro: () => null,
    enviando: () => false,
  });
  return { r, cobranca };
}

describe('criarCobranca (contexto da conclusão)', () => {
  it('o estado leva o rótulo do Confirmar, o nome do cliente e os totais', () => {
    const { cobranca } = montar();
    const e = cobranca.estado();
    expect(e.rotuloConfirmar).toBe('Concluir pedido');
    expect(e.nomeDoCliente).toBe('Ana');
    expect(e.totais).toEqual({ bruto: 24, desconto: 0, liquido: 24 });
    expect(e.podeRegistrar).toBe(true);
  });

  it('sem saldos o crédito é nulo e o casco só conta o da venda; com saldos entram o crédito e o saldo do cliente', () => {
    const { r, cobranca } = montar();
    expect(cobranca.estado().creditoDisponivel).toBeNull();
    expect(cobranca.estado().clienteNome).toBeNull();
    r.saldos.set(SALDOS(15));
    expect(cobranca.estado().creditoDisponivel).toBe(15);
    expect(cobranca.estado().clienteNome).toBe('Ana');
    expect(cobranca.estado().cascos[0].naRua).toBe(5); // 3 do saldo + 2 vendidos, nenhum devolvido
  });

  it('ação de cascos grava a quantidade devolvida do tipo', () => {
    const { r, cobranca } = montar(SALDOS(0));
    cobranca.agir({ tipo: 'cascos', tipoCascoId: 't-1', valor: 2 });
    expect(r.cascosDevolvidos()).toEqual({ 't-1': 2 });
    expect(cobranca.estado().cascos[0].devolvidos).toBe(2);
  });

  it('ações de pagamento: atalho Tudo preenche a linha e Tudo fiado limpa', () => {
    const { r, cobranca } = montar();
    cobranca.agir({ tipo: 'atalho', indice: 0, qual: 'tudo' });
    expect(r.pagamentos()).toEqual([{ forma: 'DINHEIRO', valor: 24 }]);
    cobranca.agir({ tipo: 'tudoFiado' });
    expect(r.pagamentos()).toEqual([]);
  });

  it('a ação registrar fica com a página (não muda nada)', () => {
    const { r, cobranca } = montar();
    cobranca.agir({ tipo: 'registrar' });
    expect(r.pagamentos()).toEqual(PAGAMENTO_PADRAO);
  });

  it('carrinho vazio bloqueia o registro', () => {
    const { r, cobranca } = montar();
    r.itens.set([]);
    expect(cobranca.podeRegistrar()).toBe(false);
  });
});
