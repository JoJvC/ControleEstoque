import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { vi } from 'vitest';

import { ConfigStore } from '../../core/config/app-config';
import { OperatorStore } from '../../core/operator/operator-store';
import { FakeStorage, operadorValido } from '../../core/permissions/testing';
import { StorageService } from '../../core/platform/storage-service';
import { ClientesPage } from './clientes-page';

async function montar(permissoes: string[]) {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: ConfigStore, useValue: { apiBaseUrl: '/api' } },
      { provide: StorageService, useValue: new FakeStorage() },
    ],
  });
  TestBed.inject(OperatorStore).select(operadorValido(permissoes));
  const navegar = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  const fixture = TestBed.createComponent(ClientesPage);
  fixture.detectChanges();
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  return {
    navegar,
    novo: () =>
      Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('Novo')),
  };
}

describe('ClientesPage — permissão clientes.cadastrar', () => {
  it('sem a chave: Novo some', async () => {
    expect((await montar([])).novo()).toBeUndefined();
  });

  it('com clientes.cadastrar: Novo navega para /clientes/novo', async () => {
    const t = await montar(['clientes.cadastrar']);
    t.novo()!.click();
    expect(t.navegar).toHaveBeenCalledWith('/clientes/novo');
  });
});
