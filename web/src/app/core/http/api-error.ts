/** Espelho de ControleEstoque.Shared.Contracts.ApiErrorEnvelope. */
export interface ApiErrorEnvelope {
  code: string;
  message: string;
  traceId: string;
}

/** Erro tipado que TODA falha HTTP vira depois do apiErrorInterceptor. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    /** Mensagem pt-BR pronta para exibir ao usuário. */
    readonly userMessage: string,
    readonly traceId: string | null,
  ) {
    super(`${status} ${code}: ${userMessage}`);
    this.name = 'ApiError';
  }
}
