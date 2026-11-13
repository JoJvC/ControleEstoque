import { HttpParams } from '@angular/common/http';

/** `inicio` e `fim` (yyyy-MM-dd) só vão na query quando vierem. */
export function periodoParams(inicio?: string, fim?: string): HttpParams {
  let params = new HttpParams();
  if (inicio) {
    params = params.set('inicio', inicio);
  }
  if (fim) {
    params = params.set('fim', fim);
  }
  return params;
}
