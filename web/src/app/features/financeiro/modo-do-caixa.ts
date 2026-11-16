import { StatusCaixa } from '../../core/api/models/financeiro';

export type ModoDoCaixa = 'fechado' | 'reaberto' | 'hoje';

/** A API não expõe flag de reabertura: ABERTO com data anterior a hoje é um caixa reaberto. Datas em yyyy-MM-dd. */
export function modoDoCaixa(status: StatusCaixa, data: string, hoje: string): ModoDoCaixa {
  if (status === 'FECHADO') {
    return 'fechado';
  }
  return data < hoje ? 'reaberto' : 'hoje';
}
