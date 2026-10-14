import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';

import { ToastService } from '../toast/toast-service';
import { ApiError, ApiErrorEnvelope } from './api-error';
import { mensagemDoErro } from './error-messages';

/**
 * Converte qualquer falha HTTP em ApiError tipado (mensagem pt-BR + traceId).
 * 5xx e falha de rede: toast genérico aqui (com traceId p/ suporte).
 * 4xx: rethrow apenas — a feature decide entre toast e erro inline.
 */
export const apiErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const toast = inject(ToastService);
  return next(req).pipe(
    catchError((error: unknown) => {
      const apiError = toApiError(error);
      if (apiError.status === 0 || apiError.status >= 500) {
        toast.error(
          apiError.userMessage,
          apiError.traceId ? `Código de suporte: ${apiError.traceId}` : undefined,
        );
      }
      return throwError(() => apiError);
    }),
  );
};

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }
  if (error instanceof HttpErrorResponse) {
    const body = error.error as Partial<ApiErrorEnvelope> | null;
    if (body && typeof body.code === 'string' && typeof body.message === 'string') {
      return new ApiError(
        error.status,
        body.code,
        mensagemDoErro(body.code, error.status, body.message),
        typeof body.traceId === 'string' ? body.traceId : null,
      );
    }
    return new ApiError(
      error.status,
      error.status === 0 ? 'SEM_CONEXAO' : 'ERRO_HTTP',
      mensagemDoErro('', error.status),
      null,
    );
  }
  return new ApiError(0, 'ERRO_INESPERADO', mensagemDoErro('', -1), null);
}
