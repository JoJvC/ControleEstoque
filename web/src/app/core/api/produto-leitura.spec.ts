import { ProdutoMarcaResponse } from './models/estoque';
import {
  ehMarcaGenerica,
  estoqueMinimoTotal,
  nomesDasMarcas,
  precoReferenciaDe,
  rotuloDaMarca,
} from './produto-leitura';

const marca = (marcaNome: string, preco: number, minimo: number): ProdutoMarcaResponse => ({
  id: `pm-${marcaNome}`,
  marcaId: `m-${marcaNome}`,
  marcaNome,
  precoReferencia: preco,
  estoqueMinimo: minimo,
  quantidade: 0,
  abaixoMinimo: false,
  fotoUrl: null,
  tipoCascoId: null,
  tipoCascoResolvidoId: null,
});

describe('produto-leitura', () => {
  it('precoReferenciaDe: preço da primeira marca, 0 sem marca', () => {
    expect(precoReferenciaDe({ marcas: [marca('Indaiá', 12, 5), marca('Crystal', 13, 3)] })).toBe(
      12,
    );
    expect(precoReferenciaDe({ marcas: [] })).toBe(0);
  });

  it('estoqueMinimoTotal: soma dos mínimos das marcas', () => {
    expect(estoqueMinimoTotal({ marcas: [marca('Indaiá', 12, 5), marca('Crystal', 13, 3)] })).toBe(
      8,
    );
    expect(estoqueMinimoTotal({ marcas: [] })).toBe(0);
  });

  it.each(['Genérica', 'generica', 'GENÉRICA', ' Genérica '])('ehMarcaGenerica(%j)', (nome) => {
    expect(ehMarcaGenerica(nome)).toBe(true);
  });

  it('ehMarcaGenerica: outras marcas não são', () => {
    expect(ehMarcaGenerica('Indaiá')).toBe(false);
    expect(ehMarcaGenerica('Genérica Plus')).toBe(false);
  });

  it('rotuloDaMarca: Genérica vira "sem marca"', () => {
    expect(rotuloDaMarca('GENERICA')).toBe('sem marca');
    expect(rotuloDaMarca('Indaiá')).toBe('Indaiá');
  });

  it('nomesDasMarcas: a Genérica sai como "sem marca"', () => {
    expect(nomesDasMarcas({ marcas: [marca('Indaiá', 1, 0), marca('Genérica', 1, 0)] })).toEqual([
      'Indaiá',
      'sem marca',
    ]);
  });
});
