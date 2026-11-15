import { ClienteResponse } from '../../core/api/models/clientes';
import { montarLinhas, normalizarFiltro, urlLista } from './clientes-linhas';

function cliente(id: string, nome: string, bairro: string | null, telefone: string | null) {
  return {
    id,
    nome,
    telefone,
    observacoes: null,
    enderecos: bairro
      ? [
          {
            id: 'e0',
            logradouro: 'Rua',
            numero: null,
            bairro: 'Outro',
            complemento: null,
            referencia: null,
            principal: false,
          },
          {
            id: 'e1',
            logradouro: 'Rua',
            numero: null,
            bairro,
            complemento: null,
            referencia: null,
            principal: true,
          },
        ]
      : [],
  } as ClienteResponse;
}

const FIADO = [
  { clienteId: 'a', nome: 'Ana', saldoDevedor: 42.5 },
  { clienteId: 'z', nome: 'ZÉ', saldoDevedor: -10 },
];
const CASCOS = [
  { clienteId: 'a', nome: 'Ana', saldoCascos: 6 },
  { clienteId: 'b', nome: 'Bia', saldoCascos: 0 },
];

describe('montarLinhas', () => {
  it('todos: secundário é o bairro do endereço principal, senão o telefone, senão vazio', () => {
    const linhas = montarLinhas(
      'todos',
      [
        cliente('a', 'Ana', 'Centro', '1'),
        cliente('b', 'Bia', null, '2'),
        cliente('c', 'Cris', null, null),
      ],
      [],
      [],
      'ignorado',
    );
    expect(linhas.map((l) => l.secundario)).toEqual(['Centro', '2', undefined]);
  });

  it('fiado e casco filtram por termo sem diferenciar maiúsculas e minúsculas', () => {
    expect(montarLinhas('fiado', [], FIADO, CASCOS, 'zé').map((l) => l.id)).toEqual(['z']);
    expect(montarLinhas('fiado', [], FIADO, CASCOS, ' AN ').map((l) => l.id)).toEqual(['a']);
    expect(montarLinhas('casco', [], FIADO, CASCOS, 'bIa').map((l) => l.id)).toEqual(['b']);
    expect(montarLinhas('casco', [], FIADO, CASCOS, 'zzz')).toEqual([]);
  });

  it('no relatório o secundário fica vazio e os selos vêm da junção por id', () => {
    const [ana] = montarLinhas('fiado', [], FIADO, CASCOS, '');
    expect(ana).toEqual({
      id: 'a',
      nome: 'Ana',
      secundario: undefined,
      saldoCascos: 6,
      saldoFiado: 42.5,
    });
  });

  it('selo ausente com saldo 0 ou cliente fora do relatório', () => {
    const [ana] = montarLinhas('todos', [cliente('a', 'Ana', null, null)], [], CASCOS, '');
    expect(ana.saldoFiado).toBeUndefined();
    expect(ana.saldoCascos).toBe(6);
    const [bia] = montarLinhas('casco', [], [], CASCOS, 'bia');
    expect(bia.saldoCascos).toBeUndefined();
  });

  it('saldo negativo passa como vem', () => {
    const [ze] = montarLinhas('fiado', [], FIADO, CASCOS, 'zé');
    expect(ze.saldoFiado).toBe(-10);
  });
});

describe('normalizarFiltro', () => {
  it.each([
    ['fiado', 'fiado'],
    ['casco', 'casco'],
    ['todos', 'todos'],
    ['xyz', 'todos'],
    ['', 'todos'],
    [null, 'todos'],
    [undefined, 'todos'],
  ])('%j → %s', (entrada, esperado) => {
    expect(normalizarFiltro(entrada)).toBe(esperado);
  });
});

describe('urlLista', () => {
  it.each([
    [null, 'todos', '/clientes'],
    [undefined, 'fiado', '/clientes?filtro=fiado'],
    [null, 'casco', '/clientes?filtro=casco'],
    ['c1', 'todos', '/clientes/c1'],
    ['c1', 'fiado', '/clientes/c1?filtro=fiado'],
    ['c1', 'casco', '/clientes/c1?filtro=casco'],
  ] as const)('(%s, %s) → %s', (id, filtro, esperado) => {
    expect(urlLista(id, filtro)).toBe(esperado);
  });
});
