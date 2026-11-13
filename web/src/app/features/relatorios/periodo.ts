import { hojeLocal } from '../../core/util/data-local';

export interface Periodo {
  inicio: string;
  fim: string;
}

/** Do dia 1 do mês de `hoje` até `hoje`, em data local (yyyy-MM-dd). */
export function periodoPadrao(hoje: Date = new Date()): Periodo {
  return {
    inicio: hojeLocal(new Date(hoje.getFullYear(), hoje.getMonth(), 1)),
    fim: hojeLocal(hoje),
  };
}

/** yyyy-MM-dd compara como texto; data vazia (sem limite) nunca invalida. */
export function periodoInvertido(inicio: string, fim: string): boolean {
  return !!inicio && !!fim && inicio > fim;
}

export const MSG_PERIODO_INVERTIDO = 'A data inicial não pode ser depois da data final.';
