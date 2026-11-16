import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { ConfigStore } from '../../core/config/app-config';
import { apiErrorInterceptor } from '../../core/http/api-error-interceptor';
import { OperatorStore } from '../../core/operator/operator-store';
import { FakeStorage, operadorValido } from '../../core/permissions/testing';
import { StorageService } from '../../core/platform/storage-service';
import { ReabrirCaixaSheet } from './reabrir-caixa-sheet';

const URL = '/api/financeiro/v1/caixas/cx-1/reabertura';

async function montar(operadorSelecionado = true) {
  const close = vi.fn();
  await TestBed.configureTestingModule({
    imports: [ReabrirCaixaSheet],
    providers: [
      provideHttpClient(withInterceptors([apiErrorInterceptor])),
      provideHttpClientTesting(),
      { provide: ConfigStore, useValue: { apiBaseUrl: '/api' } },
      { provide: StorageService, useValue: new FakeStorage() },
      { provide: DIALOG_DATA, useValue: { caixaId: 'cx-1' } },
      { provide: DialogRef, useValue: { close } },
    ],
  }).compileComponents();
  if (operadorSelecionado) {
    TestBed.inject(OperatorStore).select(operadorValido(['caixa.reabrir']));
  }
  const http = TestBed.inject(HttpTestingController);
  const fixture = TestBed.createComponent(ReabrirCaixaSheet);
  fixture.detectChanges();
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  const digitar = async (texto: string) => {
    const campo = el.querySelector('ce-input input') as HTMLInputElement;
    campo.value = texto;
    campo.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  };
  const confirmar = () =>
    (
      Array.from(el.querySelectorAll('button')).find(
        (b) => b.textContent?.trim() === 'Reabrir caixa',
      ) as HTMLButtonElement
    ).click();
  return { fixture, el, http, close, digitar, confirmar };
}

describe('ReabrirCaixaSheet', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('motivo vazio ou só espaços: mostra o alerta e não faz POST', async () => {
    const { fixture, el, digitar, confirmar, close } = await montar();
    confirmar();
    await fixture.whenStable();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain(
      'Informe o motivo da reabertura.',
    );
    await digitar('   ');
    confirmar();
    await fixture.whenStable();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain(
      'Informe o motivo da reabertura.',
    );
    expect(close).not.toHaveBeenCalled();
  });

  it('com motivo: POST com { funcionarioId, motivo } e close(true)', async () => {
    const { fixture, http, close, digitar, confirmar } = await montar();
    await digitar('  lançamento errado  ');
    confirmar();
    const req = http.expectOne(URL);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ funcionarioId: 'f1', motivo: 'lançamento errado' });
    req.flush({ id: 'cx-1', status: 'ABERTO' });
    await fixture.whenStable();
    expect(close).toHaveBeenCalledWith(true);
  });

  it('sem operador selecionado: alerta e nenhum POST', async () => {
    const { fixture, el, digitar, confirmar, close } = await montar(false);
    await digitar('motivo');
    confirmar();
    await fixture.whenStable();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Selecione o operador');
    expect(close).not.toHaveBeenCalled();
  });

  it('403 PERMISSAO_NEGADA mostra a mensagem e não fecha', async () => {
    const { fixture, el, http, close, digitar, confirmar } = await montar();
    await digitar('motivo');
    confirmar();
    http
      .expectOne(URL)
      .flush(
        { code: 'PERMISSAO_NEGADA', message: 'x', traceId: 't' },
        { status: 403, statusText: 'Forbidden' },
      );
    await fixture.whenStable();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain(
      'Você não tem permissão para esta ação.',
    );
    expect(close).not.toHaveBeenCalled();
  });
});
