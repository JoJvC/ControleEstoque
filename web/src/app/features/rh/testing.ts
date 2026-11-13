import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ConfigStore } from '../../core/config/app-config';
import { apiErrorInterceptor } from '../../core/http/api-error-interceptor';
import { OperatorStore } from '../../core/operator/operator-store';
import { FakeStorage, operadorValido } from '../../core/permissions/testing';
import { StorageService } from '../../core/platform/storage-service';

/** Apoio de spec das páginas de funcionários. */
export async function assentar(fixture: ComponentFixture<unknown>): Promise<void> {
  await new Promise((r) => setTimeout(r, 0));
  await fixture.whenStable();
}

export function configurar(permissoes: string[]) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideHttpClient(withInterceptors([apiErrorInterceptor])),
      provideHttpClientTesting(),
      { provide: ConfigStore, useValue: { apiBaseUrl: '/api' } },
      { provide: StorageService, useValue: new FakeStorage() },
    ],
  });
  TestBed.inject(OperatorStore).select(operadorValido(permissoes));
}

/** Ações de DOM compartilhadas pelas specs das duas páginas. */
export function acoes(fixture: ComponentFixture<unknown>) {
  const el = fixture.nativeElement as HTMLElement;
  return {
    el,
    botao: (texto: string) =>
      Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes(texto)) as
        HTMLButtonElement | undefined,
    nome: async (v: string) => {
      const campo = el.querySelector('ce-input input') as HTMLInputElement;
      campo.value = v;
      campo.dispatchEvent(new Event('input'));
      await fixture.whenStable();
    },
    cargo: async (id: string) => {
      const s = el.querySelector('ce-select select') as HTMLSelectElement;
      s.value = id;
      s.dispatchEvent(new Event('change'));
      await fixture.whenStable();
    },
    diaria: async (digitos: string) => {
      const campo = el.querySelector('ce-form-field ce-money-input input') as HTMLInputElement;
      campo.value = digitos;
      campo.dispatchEvent(new Event('input'));
      await fixture.whenStable();
    },
    marcar: async (rotulo: string) => {
      const c = Array.from(el.querySelectorAll('ce-checkbox')).find((x) =>
        x.textContent?.includes(rotulo),
      )!;
      (c.querySelector('input') as HTMLInputElement).click();
      await fixture.whenStable();
    },
    caixa: (rotulo: string) =>
      Array.from(el.querySelectorAll('ce-checkbox'))
        .find((x) => x.textContent?.includes(rotulo))!
        .querySelector('input') as HTMLInputElement,
    inputDiaria: () => el.querySelector('ce-form-field ce-money-input input') as HTMLInputElement,
  };
}
