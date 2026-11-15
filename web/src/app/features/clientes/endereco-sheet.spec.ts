import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { ConfigStore } from '../../core/config/app-config';
import { apiErrorInterceptor } from '../../core/http/api-error-interceptor';
import { EnderecoSheet, EnderecoSheetDados } from './endereco-sheet';

const BASE = '/api/clientes/v1/clientes/c-1/enderecos';

async function montar(dados: EnderecoSheetDados) {
  const close = vi.fn();
  await TestBed.configureTestingModule({
    imports: [EnderecoSheet],
    providers: [
      provideHttpClient(withInterceptors([apiErrorInterceptor])),
      provideHttpClientTesting(),
      { provide: ConfigStore, useValue: { apiBaseUrl: '/api' } },
      { provide: DIALOG_DATA, useValue: dados },
      { provide: DialogRef, useValue: { close } },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(EnderecoSheet);
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  const digitar = async (i: number, v: string) => {
    const campo = el.querySelectorAll<HTMLInputElement>('ce-input input')[i];
    campo.value = v;
    campo.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  };
  const enviar = () => el.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
  return { fixture, el, close, digitar, enviar, http: TestBed.inject(HttpTestingController) };
}

describe('EnderecoSheet', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('modo criar: POST com o corpo e fecha com a resposta', async () => {
    const t = await montar({ clienteId: 'c-1' });
    expect(t.el.textContent).toContain('Novo endereço');
    await t.digitar(0, ' Rua A ');
    t.enviar();
    const req = t.http.expectOne(BASE);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      logradouro: 'Rua A',
      numero: null,
      bairro: null,
      complemento: null,
      referencia: null,
      principal: false,
    });
    req.flush({ id: 'e-1' });
    await t.fixture.whenStable();
    expect(t.close).toHaveBeenCalledWith({ id: 'e-1' });
  });

  it('modo editar: preenche o formulário e faz PUT no endereço', async () => {
    const t = await montar({
      clienteId: 'c-1',
      enderecoId: 'e-1',
      inicial: {
        logradouro: 'Rua A',
        numero: '10',
        bairro: null,
        complemento: null,
        referencia: null,
        principal: true,
      },
    });
    expect(t.el.textContent).toContain('Editar endereço');
    expect(t.el.querySelector<HTMLInputElement>('ce-input input')!.value).toBe('Rua A');
    await t.digitar(0, 'Rua B');
    t.enviar();
    const req = t.http.expectOne(`${BASE}/e-1`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toMatchObject({ logradouro: 'Rua B', numero: '10', principal: true });
    req.flush({ id: 'e-1' });
    await t.fixture.whenStable();
    expect(t.close).toHaveBeenCalledWith({ id: 'e-1' });
  });

  it('logradouro obrigatório: não chama a API e mostra o erro', async () => {
    const t = await montar({ clienteId: 'c-1' });
    t.enviar();
    await t.fixture.whenStable();
    t.fixture.detectChanges();
    t.http.expectNone(BASE);
    expect(t.el.querySelector('[role="alert"]')!.textContent).toContain('Informe o logradouro');
    expect(t.close).not.toHaveBeenCalled();
  });

  it('erro da API: mostra a mensagem e não fecha', async () => {
    const t = await montar({ clienteId: 'c-1' });
    await t.digitar(0, 'Rua A');
    t.enviar();
    t.http
      .expectOne(BASE)
      .flush({ code: 'X', message: 'Falhou feio' }, { status: 422, statusText: 'x' });
    await t.fixture.whenStable();
    t.fixture.detectChanges();
    expect(t.el.querySelector('[role="alert"]')).not.toBeNull();
    expect(t.close).not.toHaveBeenCalled();
  });

  it('modo local (sem clienteId): fecha com os dados sem chamar a API', async () => {
    const t = await montar({});
    await t.digitar(0, 'Rua A');
    t.enviar();
    await t.fixture.whenStable();
    t.http.expectNone(() => true);
    expect(t.close).toHaveBeenCalledWith({
      logradouro: 'Rua A',
      numero: null,
      bairro: null,
      complemento: null,
      referencia: null,
      principal: false,
    });
  });
});
