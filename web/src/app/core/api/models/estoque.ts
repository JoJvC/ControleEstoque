// Espelho manual de src/estoque/ControleEstoque.Estoque.Contracts — não inventar campos.
// Enums serializam como string (JsonStringEnumConverter).

export type TipoProduto = 'RETORNAVEL' | 'DESCARTAVEL';

export type TipoFrete = 'TERCEIRIZADO' | 'PROPRIO';

export interface MarcaResponse {
  id: string;
  nome: string;
}

export interface CreateMarcaRequest {
  nome: string;
}

export interface TipoCascoResponse {
  id: string;
  nome: string;
  marcaId: string | null;
  marca: string | null;
  precoVasilhame: number;
  aceitaSucata: boolean;
}

export interface TipoCascoRequest {
  nome: string;
  marcaId: string | null;
  precoVasilhame: number;
  aceitaSucata: boolean;
}

export interface CreateProdutoRequest {
  tipo: TipoProduto;
  nome: string;
  categoria: string | null;
  tamanho: string | null;
  /** Casco genérico (tipo de casco sem marca); só em RETORNAVEL. */
  tipoCascoId: string | null;
}

export interface CreateProdutoMarcaRequest {
  marcaId: string;
  precoReferencia: number;
  estoqueMinimo: number;
  /** Casco específico da marca; vence o genérico do produto. */
  tipoCascoId: string | null;
}

export interface ProdutoMarcaResponse {
  id: string;
  marcaId: string;
  marcaNome: string;
  precoReferencia: number;
  estoqueMinimo: number;
  quantidade: number;
  abaixoMinimo: boolean;
  fotoUrl: string | null;
  tipoCascoId: string | null;
  tipoCascoResolvidoId: string | null;
}

export interface ProdutoResponse {
  id: string;
  tipo: TipoProduto;
  nome: string;
  categoria: string | null;
  tamanho: string | null;
  tipoCascoId: string | null;
  estoqueGeral: number;
  marcas: ProdutoMarcaResponse[];
}

export interface EstoqueItemResponse {
  produtoMarcaId: string;
  produtoId: string;
  tipo: TipoProduto;
  nome: string;
  marcaId: string;
  marca: string | null;
  categoria: string | null;
  tamanho: string | null;
  quantidade: number;
  estoqueMinimo: number;
  abaixoMinimo: boolean;
}

export interface EstoqueCascoResponse {
  tipoCascoId: string;
  nome: string;
  marcaId: string | null;
  marca: string | null;
  aceitaSucata: boolean;
  vazios: number;
  sucata: number;
}

export interface CreateMovimentoRequest {
  produtoMarcaId: string;
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
  tipoCascoId: string;
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
