import { ProdutoMarcaResponse, ProdutoResponse } from './models/estoque';

/** Fixtures de spec: produto com uma marca; `preco` e `minimo` vão para essa marca. */
export function marcaResp(p: Partial<ProdutoMarcaResponse> = {}): ProdutoMarcaResponse {
  return {
    id: 'pm-1',
    marcaId: 'm-1',
    marcaNome: 'Indaiá',
    precoReferencia: 50,
    estoqueMinimo: 0,
    quantidade: 0,
    abaixoMinimo: false,
    fotoUrl: null,
    tipoCascoId: null,
    tipoCascoResolvidoId: null,
    ...p,
  };
}

export function produtoResp(
  p: Partial<ProdutoResponse> & { preco?: number; minimo?: number } = {},
): ProdutoResponse {
  const { preco = 50, minimo = 0, ...resto } = p;
  return {
    id: 'p-1',
    tipo: 'RETORNAVEL',
    nome: 'Produto',
    categoria: null,
    tamanho: null,
    tipoCascoId: null,
    estoqueGeral: 0,
    marcas: [marcaResp({ precoReferencia: preco, estoqueMinimo: minimo })],
    ...resto,
  };
}
