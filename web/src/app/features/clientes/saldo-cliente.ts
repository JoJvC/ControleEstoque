import { ChipTom } from '../../ui/atoms/chip';
import { PrecoPipe } from '../../ui/pipes/preco-pipe';

export interface SaldoClassificado {
  readonly tipo: 'fiado' | 'credito' | 'zerado';
  /** Módulo do saldo. */
  readonly valor: number;
  readonly tom: ChipTom;
}

/** Saldo único do servidor: negativo é fiado, positivo é crédito, zero é zerado. Sem soma local. */
export function classificarSaldo(saldo: number): SaldoClassificado {
  if (saldo < 0) {
    return { tipo: 'fiado', valor: -saldo, tom: 'fiado' };
  }
  return { tipo: saldo > 0 ? 'credito' : 'zerado', valor: saldo, tom: 'pago' };
}

const preco = new PrecoPipe();

export function rotuloSaldo({ tipo, valor }: SaldoClassificado): string {
  switch (tipo) {
    case 'fiado':
      return `Fiado ${preco.transform(valor)}`;
    case 'credito':
      return `Crédito ${preco.transform(valor)}`;
    default:
      return 'Em dia';
  }
}
