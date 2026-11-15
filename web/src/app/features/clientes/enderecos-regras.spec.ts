import {
  DadosEndereco,
  RascunhoEndereco,
  adicionar,
  editar,
  marcarPrincipal,
  remover,
} from './enderecos-regras';

const dados = (logradouro: string, principal = false): DadosEndereco => ({
  logradouro,
  numero: null,
  bairro: null,
  complemento: null,
  referencia: null,
  principal,
});

const principais = (l: readonly RascunhoEndereco[]) =>
  l.filter((e) => e.principal).map((e) => e.chave);

function lista(...logradouros: string[]): RascunhoEndereco[] {
  return logradouros.reduce<RascunhoEndereco[]>((l, n) => adicionar(l, dados(n), n), []);
}

describe('enderecos-regras', () => {
  it('regra 1: o primeiro endereço vira principal mesmo sem marcar', () => {
    expect(principais(adicionar([], dados('A'), 'A'))).toEqual(['A']);
  });

  it('segundo sem marcar não muda o principal; marcado desmarca o anterior (regra 2)', () => {
    const l = lista('A', 'B');
    expect(principais(l)).toEqual(['A']);
    expect(principais(adicionar(l, dados('C', true), 'C'))).toEqual(['C']);
  });

  it('regra 2: marcarPrincipal desmarca o anterior', () => {
    expect(principais(marcarPrincipal(lista('A', 'B'), 'B'))).toEqual(['B']);
  });

  it('regra 2: editar com principal=true desmarca o anterior', () => {
    expect(principais(editar(lista('A', 'B'), 'B', dados('B2', true)))).toEqual(['B']);
  });

  it('regra 4: editar o principal com principal=false mantém o principal', () => {
    const l = editar(lista('A', 'B'), 'A', dados('A2', false));
    expect(principais(l)).toEqual(['A']);
    expect(l[0].logradouro).toBe('A2');
  });

  it('regra 3: remover o principal promove o mais antigo dos que sobram', () => {
    const l = remover(lista('A', 'B', 'C'), 'A');
    expect(l.map((e) => e.chave)).toEqual(['B', 'C']);
    expect(principais(l)).toEqual(['B']);
  });

  it('remover um não principal mantém o principal; remover o último deixa a lista vazia', () => {
    expect(principais(remover(lista('A', 'B'), 'B'))).toEqual(['A']);
    expect(remover(lista('A'), 'A')).toEqual([]);
  });

  it('invariante: após qualquer sequência de gestos há exatamente um principal', () => {
    let l = lista('A', 'B', 'C', 'D');
    l = marcarPrincipal(l, 'C');
    l = remover(l, 'C');
    l = editar(l, 'D', dados('D', true));
    l = adicionar(l, dados('E'), 'E');
    l = remover(l, 'D');
    expect(principais(l)).toHaveLength(1);
  });

  it('não muta a lista recebida', () => {
    const l = lista('A', 'B');
    const copia = JSON.stringify(l);
    marcarPrincipal(l, 'B');
    remover(l, 'A');
    expect(JSON.stringify(l)).toBe(copia);
  });
});
