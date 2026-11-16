import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { marcaResp, produtoResp } from '../../core/api/testing';
import { ConfigStore } from '../../core/config/app-config';
import { apiErrorInterceptor } from '../../core/http/api-error-interceptor';
import { AjusteSheet } from './ajuste-sheet';

const BASE = '/api/estoque/v1';
const MARCA = marcaResp({ id: 'pm1', marcaNome: 'Genérica', quantidade: 10 });
const PRODUTO = produtoResp({ id: 'p1', tipo: 'DESCARTAVEL', nome: 'Copo 200ml', marcas: [MARCA] });

async function montar() {
  const close = vi.fn();
  await TestBed.configureTestingModule({
    imports: [AjusteSheet],
    providers: [
      provideHttpClient(withInterceptors([apiErrorInterceptor])),
      provideHttpClientTesting(),
      { provide: ConfigStore, useValue: { apiBaseUrl: '/api' } },
      { provide: DIALOG_DATA, useValue: { produto: PRODUTO, marca: MARCA } },
      { provide: DialogRef, useValue: { close } },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(AjusteSheet);
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  return {
    fixture,
    el,
    close,
    http: TestBed.inject(HttpTestingController),
    botao: (texto: string) =>
      Array.from(el.querySelectorAll('button')).find((b) =>
        b.textContent?.includes(texto),
      ) as HTMLButtonElement,
  };
}

describe('AjusteSheet', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('renderiza o item e as duas direções, com Entrada marcada', async () => {
    const t = await montar();
    expect(t.el.textContent).toContain('Ajustar — Copo 200ml · sem marca');
    expect(t.botao('Entrada').getAttribute('aria-checked')).toBe('true');
    expect(t.botao('Saída').getAttribute('aria-checked')).toBe('false');
  });

  it('Confirmar ajuste envia o movimento de entrada e fecha com true', async () => {
    const t = await montar();

    t.botao('Confirmar ajuste').click();
    const req = t.http.expectOne(`${BASE}/estoque/movimentos`);
    expect(req.request.body).toEqual({ produtoMarcaId: 'pm1', quantidade: 1, observacao: null });
    req.flush(null);
    await t.fixture.whenStable();
    t.http.expectOne(`${BASE}/produtos`).flush([]);
    t.http.expectOne(`${BASE}/estoque/cascos`).flush([]);
    await t.fixture.whenStable();
    expect(t.close).toHaveBeenCalledWith(true);
  });

  it('Saída envia a quantidade negativa', async () => {
    const t = await montar();
    t.botao('Saída').click();
    await t.fixture.whenStable();

    t.botao('Confirmar ajuste').click();
    const req = t.http.expectOne(`${BASE}/estoque/movimentos`);
    expect(req.request.body.quantidade).toBe(-1);
    req.flush(null);
    await t.fixture.whenStable();
    t.http.expectOne(`${BASE}/produtos`).flush([]);
    t.http.expectOne(`${BASE}/estoque/cascos`).flush([]);
  });
});
