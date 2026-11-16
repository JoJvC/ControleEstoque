import { PagamentoFiadoResponse } from '../../core/api/models/financeiro';
import {
  corpoDevolucao,
  linhasRecolher,
  resumoPagamentoFiado,
  tiposConversiveis,
} from './cascos-cliente';

const tipo = (id: string, nome: string, precoVasilhame = 15) => ({
  id,
  nome,
  marcaId: null,
  marca: null,
  precoVasilhame,
  aceitaSucata: false,
});
const TIPOS = [tipo('t-20', 'Galão 20L'), tipo('t-10', 'Galão 10L', 9), tipo('t-5', 'Garrafão 5L')];

describe('linhasRecolher', () => {
  it('uma linha por tipo na ordem da lista; tipo fora dos saldos vale 0; negativo fica', () => {
    const saldos = [
      { tipoCascoId: 't-5', nome: 'Garrafão 5L', saldo: -1 },
      { tipoCascoId: 't-20', nome: 'Galão 20L', saldo: 3 },
    ];
    expect(linhasRecolher(TIPOS, saldos)).toEqual([
      { tipoCascoId: 't-20', nome: 'Galão 20L', saldo: 3 },
      { tipoCascoId: 't-10', nome: 'Galão 10L', saldo: 0 },
      { tipoCascoId: 't-5', nome: 'Garrafão 5L', saldo: -1 },
    ]);
  });

  it('tipo só nos saldos entra no fim', () => {
    const saldos = [{ tipoCascoId: 't-x', nome: 'Antigo', saldo: 2 }];
    expect(linhasRecolher([TIPOS[0]], saldos)).toEqual([
      { tipoCascoId: 't-20', nome: 'Galão 20L', saldo: 0 },
      { tipoCascoId: 't-x', nome: 'Antigo', saldo: 2 },
    ]);
  });
});

describe('corpoDevolucao', () => {
  it('só as linhas com quantidade > 0', () => {
    expect(corpoDevolucao({ 't-20': 2, 't-10': 1, 't-5': 0 })).toEqual([
      { tipoCascoId: 't-20', quantidade: 2 },
      { tipoCascoId: 't-10', quantidade: 1 },
    ]);
  });

  it('tudo em 0 devolve lista vazia', () => {
    expect(corpoDevolucao({ 't-20': 0 })).toEqual([]);
    expect(corpoDevolucao({})).toEqual([]);
  });
});

describe('tiposConversiveis', () => {
  it('só saldo > 0, com saldo e preço padrão', () => {
    const saldos = [
      { tipoCascoId: 't-20', nome: 'Galão 20L', saldo: 3 },
      { tipoCascoId: 't-10', nome: 'Galão 10L', saldo: 0 },
      { tipoCascoId: 't-5', nome: 'Garrafão 5L', saldo: -1 },
    ];
    expect(tiposConversiveis(TIPOS, saldos)).toEqual([
      { tipoCascoId: 't-20', nome: 'Galão 20L', saldo: 3, precoVasilhame: 15 },
    ]);
  });
});

describe('resumoPagamentoFiado', () => {
  const base: PagamentoFiadoResponse = {
    novoSaldoFiado: 0,
    novoSaldo: 0,
    vendasAbatidas: [],
    valorEmCredito: 0,
  };
  const limpo = (linhas: string[]) => linhas.map((l) => l.replace(/\s/g, ' '));

  it('PAGA e PARCIAL na ordem recebida, sem linha de crédito', () => {
    const r = {
      ...base,
      vendasAbatidas: [
        {
          vendaId: 'a',
          data: '2026-11-01T09:00:00',
          valorAbatido: 30,
          novoStatus: 'PAGA' as const,
          restante: 0,
        },
        {
          vendaId: 'b',
          data: '2026-11-03',
          valorAbatido: 50,
          novoStatus: 'PAGA' as const,
          restante: 0,
        },
        {
          vendaId: 'c',
          data: '2026-11-05',
          valorAbatido: 20,
          novoStatus: 'PARCIAL' as const,
          restante: 20,
        },
      ],
    };
    expect(limpo(resumoPagamentoFiado(r))).toEqual([
      '01/11 — quitada (R$ 30,00)',
      '03/11 — quitada (R$ 50,00)',
      '05/11 — abatida R$ 20,00, resta R$ 20,00',
    ]);
  });

  it('com sobra: venda quitada e linha de crédito', () => {
    const r = {
      ...base,
      vendasAbatidas: [
        {
          vendaId: 'a',
          data: '2026-11-01',
          valorAbatido: 30,
          novoStatus: 'PAGA' as const,
          restante: 0,
        },
      ],
      valorEmCredito: 20,
    };
    expect(limpo(resumoPagamentoFiado(r))).toEqual([
      '01/11 — quitada (R$ 30,00)',
      'R$ 20,00 virou crédito',
    ]);
  });

  it('sem venda abatida e com crédito: só a linha do crédito', () => {
    expect(limpo(resumoPagamentoFiado({ ...base, valorEmCredito: 7 }))).toEqual([
      'R$ 7,00 virou crédito',
    ]);
  });
});
