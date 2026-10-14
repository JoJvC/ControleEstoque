import { HttpErrorResponse } from '@angular/common/http';

import { toApiError } from './api-error-interceptor';

describe('toApiError', () => {
  it('converte ApiErrorEnvelope em ApiError com mensagem pt-BR mapeada', () => {
    const response = new HttpErrorResponse({
      status: 422,
      error: { code: 'ESTOQUE_INSUFICIENTE', message: 'Insufficient stock', traceId: 'trace-1' },
    });

    const error = toApiError(response);

    expect(error.status).toBe(422);
    expect(error.code).toBe('ESTOQUE_INSUFICIENTE');
    expect(error.userMessage).toBe('Estoque insuficiente para o produto.');
    expect(error.traceId).toBe('trace-1');
  });

  it('usa a mensagem do servidor quando o código não está no mapa', () => {
    const response = new HttpErrorResponse({
      status: 422,
      error: { code: 'REGRA_NOVA', message: 'Mensagem do servidor', traceId: 't' },
    });

    expect(toApiError(response).userMessage).toBe('Mensagem do servidor');
  });

  it('resposta sem envelope vira erro genérico por status', () => {
    const response = new HttpErrorResponse({ status: 404, error: 'not found' });

    const error = toApiError(response);

    expect(error.code).toBe('ERRO_HTTP');
    expect(error.userMessage).toBe('Registro não encontrado.');
    expect(error.traceId).toBeNull();
  });

  it('falha de rede (status 0) vira SEM_CONEXAO', () => {
    const response = new HttpErrorResponse({ status: 0 });

    const error = toApiError(response);

    expect(error.code).toBe('SEM_CONEXAO');
    expect(error.userMessage).toContain('Sem conexão');
  });

  it('erro não-HTTP vira ERRO_INESPERADO', () => {
    const error = toApiError(new Error('boom'));

    expect(error.code).toBe('ERRO_INESPERADO');
    expect(error.status).toBe(0);
  });
});
