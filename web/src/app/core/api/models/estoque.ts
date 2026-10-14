// Espelho manual de src/estoque/ControleEstoque.Estoque.Contracts — não inventar campos.
// Enums serializam como string (JsonStringEnumConverter).

export type TipoProduto = 'AGUA' | 'GALAO_COMPLETO' | 'CASCO' | 'SUCATA' | 'DESCARTAVEL';

export type TipoFrete = 'TERCEIRIZADO' | 'PROPRIO';

export interface MarcaResponse {
  id: string;
  nome: string;
}

export interface CreateMarcaRequest {
  nome: string;
}

export interface CreateProdutoRequest {
  tipo: TipoProduto;
  nome: string;
  marcaId: string | null;
  categoria: string | null;
  tamanho: string | null;
  precoReferencia: number;
  estoqueMinimo: number;
}

export interface ProdutoResponse {
  id: string;
  tipo: TipoProduto;
  nome: string;
  marcaId: string | null;
  marca: string | null;
  categoria: string | null;
  tamanho: string | null;
  fotoUrl: string | null;
  precoReferencia: number;
  estoqueMinimo: number;
}

export interface EstoqueItemResponse {
  produtoId: string;
  tipo: TipoProduto;
  nome: string;
  marca: string | null;
  categoria: string | null;
  tamanho: string | null;
  quantidade: number;
  estoqueMinimo: number;
  abaixoMinimo: boolean;
}

export interface CreateMovimentoRequest {
  produtoId: string;
  quantidade: number;
  observacao: string | null;
}

export interface AbastecimentoItemRequest {
  produtoId: string;
  quantidade: number;
  custoUnitario: number;
}

export interface CreateAbastecimentoRequest {
  tipoFrete: TipoFrete;
  custoTotal: number;
  funcionarioId: string | null;
  observacao: string | null;
  itens: AbastecimentoItemRequest[];
}

export interface CreateBaixaCascoRequest {
  quantidade: number;
  motivo: string | null;
  responsaveisIds: string[];
}

export interface CreatedResponse {
  id: string;
}

export interface FotoResponse {
  fotoUrl: string;
}
