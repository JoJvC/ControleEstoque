import {
  CreateProdutoMarcaRequest,
  CreateProdutoRequest,
  MarcaResponse,
  ProdutoResponse,
  TipoCascoResponse,
  TipoProduto,
} from '../../core/api/models/estoque';
import { ehMarcaGenerica } from '../../core/api/produto-leitura';
import { SelectOpcao } from '../../ui/atoms/select';

/** Valor da opção "Sem marca" no select de marca da linha; grava na marca 'Genérica'. */
export const SEM_MARCA = '__sem-marca__';
export const NOME_MARCA_GENERICA = 'Genérica';

const EXTENSOES_FOTO = /\.(jpe?g|png)$/i;
const FOTO_MAX_BYTES = 5 * 1024 * 1024;

/** Campos da linha que o PUT da associação envia; serve para saber se a linha salva mudou. */
export interface ValoresLinha {
  marcaId: string | null;
  preco: number | null;
  minimo: string;
  tipoCascoId: string | null;
}

export interface LinhaMarca extends ValoresLinha {
  /** Identidade local da linha (track do @for). */
  chave: number;
  /** Id da associação já salva; null em linha nova. */
  produtoMarcaId: string | null;
  foto: File | null;
  /** Prévia: foto escolhida ou a já salva. */
  fotoSrc: string | null;
  /** Valores como vieram do servidor; null em linha nova. */
  original: ValoresLinha | null;
}

export interface FormProduto {
  id: string | null;
  tipo: TipoProduto;
  nome: string;
  categoria: string;
  tamanho: string;
  /** Casco genérico do produto (só Retornável). */
  tipoCascoId: string | null;
  linhas: LinhaMarca[];
}

export interface ErrosLinha {
  marca?: string;
  preco?: string;
  minimo?: string;
  foto?: string;
}

export interface ErrosProduto {
  nome?: string;
  casco?: string;
  /** Alinhado por índice com `form.linhas`. */
  linhas: ErrosLinha[];
}

let proximaChave = 0;

export function novaLinha(parcial: Partial<LinhaMarca> = {}): LinhaMarca {
  return {
    chave: ++proximaChave,
    produtoMarcaId: null,
    marcaId: null,
    preco: null,
    minimo: '0',
    tipoCascoId: null,
    foto: null,
    fotoSrc: null,
    original: null,
    ...parcial,
  };
}

export function novoForm(): FormProduto {
  return aoTrocarTipo(
    {
      id: null,
      tipo: 'DESCARTAVEL',
      nome: '',
      categoria: '',
      tamanho: '',
      tipoCascoId: null,
      linhas: [],
    },
    'DESCARTAVEL',
  );
}

/** Monta o formulário de edição; a associação na 'Genérica' abre como "Sem marca". */
export function formDe(
  produto: ProdutoResponse,
  urlFotoMarca: (produtoMarcaId: string) => string,
): FormProduto {
  return {
    id: produto.id,
    tipo: produto.tipo,
    nome: produto.nome,
    categoria: produto.categoria ?? '',
    tamanho: produto.tamanho ?? '',
    tipoCascoId: produto.tipoCascoId,
    linhas: produto.marcas.map((m) => {
      const valores: ValoresLinha = {
        marcaId: ehMarcaGenerica(m.marcaNome) ? SEM_MARCA : m.marcaId,
        preco: m.precoReferencia,
        minimo: String(m.estoqueMinimo),
        tipoCascoId: m.tipoCascoId,
      };
      return novaLinha({
        ...valores,
        produtoMarcaId: m.id,
        fotoSrc: m.fotoUrl ? urlFotoMarca(m.id) : null,
        original: valores,
      });
    }),
  };
}

/** Produto novo Descartável sem marcas ganha a linha 'Sem marca'; o resto não muda. */
export function aoTrocarTipo(form: FormProduto, tipo: TipoProduto): FormProduto {
  const linhas =
    form.id === null && tipo === 'DESCARTAVEL' && form.linhas.length === 0
      ? [novaLinha({ marcaId: SEM_MARCA })]
      : form.linhas;
  return { ...form, tipo, linhas };
}

export function validarFoto(foto: File): string | null {
  if (!EXTENSOES_FOTO.test(foto.name)) {
    return 'A foto deve ser .jpg, .jpeg ou .png.';
  }
  if (foto.size < 1 || foto.size > FOTO_MAX_BYTES) {
    return 'A foto deve ter de 1 byte a 5 MB.';
  }
  return null;
}

const minimoValido = (minimo: string): boolean => /^\d+$/.test(minimo.trim());

export function validarProduto(form: FormProduto): ErrosProduto {
  const erros: ErrosProduto = { linhas: [] };
  if (form.nome.trim() === '') {
    erros.nome = 'Informe o nome do produto.';
  }
  if (form.tipo === 'RETORNAVEL' && form.tipoCascoId === null) {
    erros.casco = 'Produto retornável exige o casco genérico.';
  }
  const vistas = new Set<string>();
  erros.linhas = form.linhas.map((linha) => {
    const e: ErrosLinha = {};
    if (linha.marcaId === null) {
      e.marca = 'Escolha a marca (ou "Sem marca").';
    } else if (vistas.has(linha.marcaId)) {
      e.marca = 'Marca repetida.';
    } else {
      vistas.add(linha.marcaId);
    }
    if (linha.preco === null || !(linha.preco >= 0)) {
      e.preco = 'Informe um preço válido.';
    }
    if (!minimoValido(linha.minimo)) {
      e.minimo = 'Informe um número inteiro, 0 ou mais.';
    }
    const erroFoto = linha.foto === null ? null : validarFoto(linha.foto);
    if (erroFoto !== null) {
      e.foto = erroFoto;
    }
    return e;
  });
  return erros;
}

export const temErros = (erros: ErrosProduto): boolean =>
  erros.nome !== undefined ||
  erros.casco !== undefined ||
  erros.linhas.some((l) => Object.keys(l).length > 0);

export function montarProduto(form: FormProduto): CreateProdutoRequest {
  return {
    tipo: form.tipo,
    nome: form.nome.trim(),
    categoria: form.categoria.trim() || null,
    tamanho: form.tamanho.trim() || null,
    tipoCascoId: form.tipo === 'RETORNAVEL' ? form.tipoCascoId : null,
  };
}

/** Id real da marca da linha; "Sem marca" usa o da 'Genérica' (null se ela ainda não existe). */
export function marcaIdDaLinha(
  linha: Pick<LinhaMarca, 'marcaId'>,
  genericaId: string | null,
): string | null {
  return linha.marcaId === SEM_MARCA ? genericaId : linha.marcaId;
}

export function montarMarca(
  linha: LinhaMarca,
  tipo: TipoProduto,
  genericaId: string | null = null,
): CreateProdutoMarcaRequest {
  const marcaId = marcaIdDaLinha(linha, genericaId);
  if (marcaId === null) {
    throw new Error('Linha sem marca resolvida.');
  }
  return {
    marcaId,
    precoReferencia: linha.preco ?? 0,
    estoqueMinimo: Number(linha.minimo),
    tipoCascoId: tipo === 'RETORNAVEL' ? linha.tipoCascoId : null,
  };
}

/** Linha cujo envio difere do que veio do servidor; em Descartável o casco específico sai nulo. */
export function linhaAlterada(linha: LinhaMarca, tipo: TipoProduto): boolean {
  const o = linha.original;
  return (
    o === null ||
    o.marcaId !== linha.marcaId ||
    o.preco !== linha.preco ||
    o.minimo !== linha.minimo ||
    o.tipoCascoId !== (tipo === 'RETORNAVEL' ? linha.tipoCascoId : null)
  );
}

export const cascosGenericos = (tipos: readonly TipoCascoResponse[]): TipoCascoResponse[] =>
  tipos.filter((t) => t.marcaId === null);

/** Específicos de uma marca; sem marca resolvida (ex.: 'Genérica' inexistente), nenhum. */
export const cascosDaMarca = (
  tipos: readonly TipoCascoResponse[],
  marcaId: string | null,
): TipoCascoResponse[] => (marcaId === null ? [] : tipos.filter((t) => t.marcaId === marcaId));

/** 'Específico vence', como no backend. */
export const cascoEfetivo = (
  linha: Pick<LinhaMarca, 'tipoCascoId'>,
  genericoId: string | null,
): string | null => linha.tipoCascoId ?? genericoId;

export const marcaGenericaDe = (marcas: readonly MarcaResponse[]): MarcaResponse | null =>
  marcas.find((m) => ehMarcaGenerica(m.nome)) ?? null;

/** 'Sem marca' primeiro; a 'Genérica' não repete, já é representada por ele. */
export function opcoesDeMarca(marcas: readonly MarcaResponse[]): SelectOpcao[] {
  return [
    { value: SEM_MARCA, label: 'Sem marca' },
    ...marcas.filter((m) => !ehMarcaGenerica(m.nome)).map((m) => ({ value: m.id, label: m.nome })),
  ];
}
