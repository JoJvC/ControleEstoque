import { PrecoPipe } from '../../ui/pipes/preco-pipe';

/** Geometria do gráfico de barras empilhadas (recebido embaixo, fiado em cima). Sem DOM: só números. */

export interface PontoDiario {
  dia: string;
  recebido: number;
  fiadoGerado: number;
}

export interface Margem {
  topo: number;
  direita: number;
  base: number;
  esquerda: number;
}

export interface OpcoesGrafico {
  largura: number;
  altura: number;
  margem?: Margem;
}

export interface Segmento {
  y: number;
  altura: number;
}

export interface BarraGrafico {
  dia: string;
  rotuloDia: string;
  x: number;
  largura: number;
  recebido: Segmento;
  fiado: Segmento;
  ariaLabel: string;
}

export interface TickEixo {
  valor: number;
  y: number;
  rotulo: string;
}

export interface ModeloGrafico {
  vazio: boolean;
  largura: number;
  altura: number;
  margem: Margem;
  /** Ordenada da base (valor 0), em px. */
  yBase: number;
  /** Altura útil entre o topo e a base, em px. */
  alturaUtil: number;
  maximo: number;
  ticks: TickEixo[];
  barras: BarraGrafico[];
}

export type TeclaNavegacao = string;

export const MARGEM_PADRAO: Margem = { topo: 12, direita: 12, base: 28, esquerda: 80 };

const INTERVALOS_EIXO = 4;
/** Fração do espaço de cada dia ocupada pela barra. */
const PREENCHIMENTO = 0.7;
const preco = new PrecoPipe();

function positivo(n: number): number {
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Passo "redondo" (1, 2, 5 × 10^n) para dividir `maximo` em ~4 intervalos. */
function passoRedondo(maximo: number): number {
  const bruto = maximo / INTERVALOS_EIXO;
  const magnitude = 10 ** Math.floor(Math.log10(bruto));
  const f = bruto / magnitude;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * magnitude;
}

/** yyyy-MM-dd → dd/mm por texto (Date deslocaria o dia pelo fuso). */
function rotuloDia(dia: string): string {
  return `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
}

export function montarGraficoEmpilhado(
  porDia: readonly PontoDiario[],
  { largura, altura, margem = MARGEM_PADRAO }: OpcoesGrafico,
): ModeloGrafico {
  const alturaUtil = Math.max(0, altura - margem.topo - margem.base);
  const larguraUtil = Math.max(0, largura - margem.esquerda - margem.direita);
  const yBase = margem.topo + alturaUtil;

  const maiorTotal = Math.max(
    0,
    ...porDia.map((p) => positivo(p.recebido) + positivo(p.fiadoGerado)),
  );
  const passo = maiorTotal > 0 ? passoRedondo(maiorTotal) : 1;
  const maximo = maiorTotal > 0 ? passo * Math.ceil(maiorTotal / passo - 1e-9) : passo;
  const nTicks = Math.round(maximo / passo);
  const ticks: TickEixo[] = Array.from({ length: nTicks + 1 }, (_, i) => {
    const valor = Math.round(i * passo * 1e6) / 1e6;
    return { valor, y: yBase - (valor / maximo) * alturaUtil, rotulo: preco.transform(valor) };
  });

  const espaco = porDia.length > 0 ? larguraUtil / porDia.length : 0;
  const larguraBarra = espaco * PREENCHIMENTO;
  const barras = porDia.map((p, i): BarraGrafico => {
    const recebido = positivo(p.recebido);
    const fiado = positivo(p.fiadoGerado);
    const alturaRecebido = (recebido / maximo) * alturaUtil;
    const alturaFiado = (fiado / maximo) * alturaUtil;
    const rotulo = rotuloDia(p.dia);
    return {
      dia: p.dia,
      rotuloDia: rotulo,
      x: margem.esquerda + i * espaco + (espaco - larguraBarra) / 2,
      largura: larguraBarra,
      recebido: { y: yBase - alturaRecebido, altura: alturaRecebido },
      fiado: { y: yBase - alturaRecebido - alturaFiado, altura: alturaFiado },
      ariaLabel:
        `${rotulo}: recebido ${preco.transform(recebido)}; ` +
        `fiado gerado ${preco.transform(fiado)}; total ${preco.transform(recebido + fiado)}`,
    };
  });

  return {
    vazio: porDia.length === 0,
    largura,
    altura,
    margem,
    yBase,
    alturaUtil,
    maximo,
    ticks,
    barras,
  };
}

/** Roving tabindex: setas andam sem dar a volta, Home/End vão às pontas, outra tecla não move. */
export function proximoIndice(atual: number, tecla: TeclaNavegacao, total: number): number {
  if (total <= 0) {
    return atual;
  }
  switch (tecla) {
    case 'ArrowRight':
      return Math.min(atual + 1, total - 1);
    case 'ArrowLeft':
      return Math.max(atual - 1, 0);
    case 'Home':
      return 0;
    case 'End':
      return total - 1;
    default:
      return atual;
  }
}
