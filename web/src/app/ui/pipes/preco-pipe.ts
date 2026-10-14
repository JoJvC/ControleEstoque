import { Pipe, PipeTransform } from '@angular/core';

const FORMATADOR = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** Dinheiro SEMPRE por aqui (plano §1): `{{ valor | cePreco }}` → "R$ 1.234,56". */
@Pipe({ name: 'cePreco' })
export class PrecoPipe implements PipeTransform {
  transform(valor: number | null | undefined): string {
    return valor == null || Number.isNaN(valor) ? '—' : FORMATADOR.format(valor);
  }
}
