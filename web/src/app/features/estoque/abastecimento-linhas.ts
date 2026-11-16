import {
  AbastecimentoCascoRequest,
  AbastecimentoItemRequest,
  CustoLinhaRequest,
  TipoFrete,
} from '../../core/api/models/estoque';

export const FRETES: { value: TipoFrete; label: string }[] = [
  { value: 'TERCEIRIZADO', label: 'Fornecedor entrega' },
  { value: 'PROPRIO', label: 'Retirada nossa' },
];

export const rotuloDoFrete = (tipo: TipoFrete): string =>
  FRETES.find((f) => f.value === tipo)?.label ?? tipo;

/** Quantidade digitada numa linha da carga: produto+marca ou vasilhame (tipo de casco). */
export interface QuantidadeDigitada {
  readonly tipo: 'item' | 'casco';
  /** produtoMarcaId (item) ou tipoCascoId (casco). */
  readonly id: string;
  readonly quantidade: number;
}

/** Custo digitado numa linha já lançada da carga; `id` é o da linha da carga. */
export interface CustoDigitado {
  readonly id: string;
  readonly custo: number | null;
}

/** Momento 1: só quantidade > 0 vai no corpo; vasilhame vai em `cascos`. */
export function corpoDaCarga(linhas: readonly QuantidadeDigitada[]): {
  itens: AbastecimentoItemRequest[];
  cascos: AbastecimentoCascoRequest[];
} {
  const com = linhas.filter((l) => l.quantidade > 0);
  return {
    itens: com
      .filter((l) => l.tipo === 'item')
      .map((l) => ({ produtoMarcaId: l.id, quantidade: l.quantidade })),
    cascos: com
      .filter((l) => l.tipo === 'casco')
      .map((l) => ({ tipoCascoId: l.id, quantidade: l.quantidade })),
  };
}

const preenchidas = (linhas: readonly CustoDigitado[]): CustoLinhaRequest[] =>
  linhas
    .filter((l) => l.custo !== null)
    .map((l) => ({ id: l.id, custoUnitario: l.custo as number }));

/** Momento 2: custo vazio fica fora e frete vazio vai como null. */
export function corpoDosCustos(
  itens: readonly CustoDigitado[],
  cascos: readonly CustoDigitado[],
  frete: number | null,
): { frete: number | null; itens: CustoLinhaRequest[]; cascos: CustoLinhaRequest[] } {
  return { frete, itens: preenchidas(itens), cascos: preenchidas(cascos) };
}
