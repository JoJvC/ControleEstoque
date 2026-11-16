import { CaixaDiariasPendentes } from '../../core/api/models/financeiro';

export interface AvisoFechadoPeloSistema {
  texto: string;
  /** Um caixa leva ao detalhe dele; vários, à lista de caixas. */
  rota: string;
}

/** `yyyy-MM-dd` → `dd/mm`. */
export function diaMes(data: string): string {
  const [, mes, dia] = data.split('-');
  return `${dia}/${mes}`;
}

export function avisoFechadoPeloSistema(
  pendentes: readonly CaixaDiariasPendentes[],
): AvisoFechadoPeloSistema | null {
  if (pendentes.length === 0) {
    return null;
  }
  if (pendentes.length === 1) {
    const [c] = pendentes;
    return {
      texto: `Caixa de ${diaMes(c.data)} fechado pelo sistema à meia-noite. Diárias pendentes.`,
      rota: `/financeiro/caixas/${c.id}`,
    };
  }
  return {
    texto: `${pendentes.length} caixas fechados pelo sistema à meia-noite com diárias pendentes.`,
    rota: '/financeiro/caixas',
  };
}
