import { HttpInterceptorFn } from '@angular/common/http';

/** Injeta X-Correlation-Id (uuid v4) em toda chamada — a API ecoa o header. */
export const correlationIdInterceptor: HttpInterceptorFn = (req, next) =>
  next(req.clone({ setHeaders: { 'X-Correlation-Id': crypto.randomUUID() } }));
