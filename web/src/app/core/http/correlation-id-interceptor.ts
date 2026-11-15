import { HttpInterceptorFn } from '@angular/common/http';

/**
 * uuid v4. `crypto.randomUUID` só existe em contexto seguro (HTTPS ou localhost): aberto pela rede
 * local em http (ex.: celular em http://192.168.0.x:8080) ele é undefined e toda chamada quebraria.
 * `crypto.getRandomValues` existe em qualquer contexto.
 */
export function novoUuid(): string {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Injeta X-Correlation-Id (uuid v4) em toda chamada — a API ecoa o header. */
export const correlationIdInterceptor: HttpInterceptorFn = (req, next) =>
  next(req.clone({ setHeaders: { 'X-Correlation-Id': novoUuid() } }));
