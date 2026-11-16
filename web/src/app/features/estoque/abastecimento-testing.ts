import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import {
  AbastecimentoDetalheResponse,
  AbastecimentoPendenteResponse,
} from '../../core/api/models/estoque';
import { marcaResp, produtoResp } from '../../core/api/testing';
import { ConfigStore } from '../../core/config/app-config';
import { apiErrorInterceptor } from '../../core/http/api-error-interceptor';
import { OperatorStore } from '../../core/operator/operator-store';
import { FakeStorage, operadorValido } from '../../core/permissions/testing';
import { StorageService } from '../../core/platform/storage-service';
import { ToastService } from '../../core/toast/toast-service';
import { ESTOQUE_ROUTES } from './estoque-routes';

/** Apoio de spec das telas de custo da carga: rotas reais de estoque, guards e dublê HTTP. */
export const BASE = '/api/estoque/v1';

export const AGUA = produtoResp({
  id: 'a1',
  nome: 'Água 20L',
  marcas: [marcaResp({ id: 'pm-a', marcaNome: 'Marca A' })],
});
export const GAS = produtoResp({
  id: 'g1',
  nome: 'Gás P13',
  marcas: [marcaResp({ id: 'pm-g', marcaNome: 'Genérica' })],
});
export const TIPO_CASCO = {
  id: 'T20',
  nome: 'Galão 20L',
  marcaId: null,
  marca: null,
  precoVasilhame: 30,
  aceitaSucata: true,
};

export function detalhe(
  p: Partial<AbastecimentoDetalheResponse> = {},
): AbastecimentoDetalheResponse {
  return {
    id: 'ab1',
    data: '2026-11-10',
    tipoFrete: 'TERCEIRIZADO',
    funcionarioId: 'f1',
    observacao: null,
    frete: null,
    custoPendente: true,
    totalUnidades: 18,
    custoTotal: null,
    itens: [
      {
        id: 'l1',
        produtoMarcaId: 'pm-a',
        quantidade: 10,
        custoUnitario: null,
        custoDaUnidade: null,
      },
      {
        id: 'l2',
        produtoMarcaId: 'pm-g',
        quantidade: 5,
        custoUnitario: null,
        custoDaUnidade: null,
      },
    ],
    cascos: [
      { id: 'c1', tipoCascoId: 'T20', quantidade: 3, custoUnitario: null, custoDaUnidade: null },
    ],
    ...p,
  };
}

export function pendente(
  id: string,
  p: Partial<AbastecimentoPendenteResponse> = {},
): AbastecimentoPendenteResponse {
  return {
    id,
    data: '2026-11-10',
    tipoFrete: 'TERCEIRIZADO',
    totalUnidades: 18,
    linhasSemCusto: 2,
    freteFaltando: true,
    ...p,
  };
}

@Component({ template: 'home' })
class Home {}

export async function montarRotas(
  permissoes: string[],
  urlInicial: string,
  catalogo: object[] = [AGUA, GAS],
) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        { path: '', component: Home },
        { path: 'estoque', children: ESTOQUE_ROUTES },
      ]),
      provideHttpClient(withInterceptors([apiErrorInterceptor])),
      provideHttpClientTesting(),
      { provide: ConfigStore, useValue: { apiBaseUrl: '/api' } },
      { provide: StorageService, useValue: new FakeStorage() },
    ],
  });
  TestBed.inject(OperatorStore).select(operadorValido(permissoes));
  const http = TestBed.inject(HttpTestingController);
  const harness = await RouterTestingHarness.create();
  const el = () => harness.routeNativeElement as HTMLElement;
  const assentar = async () => {
    await harness.fixture.whenStable();
    harness.detectChanges();
  };
  const navegar = async (url: string) => {
    await harness.navigateByUrl(url);
    await assentar();
  };
  const texto = () => (el()?.textContent ?? '').replace(/\s+/g, ' ');
  const botao = (rotulo: string) =>
    Array.from(el().querySelectorAll('button')).find((b) => b.textContent?.includes(rotulo));
  const clicar = async (rotulo: string) => {
    botao(rotulo)!.click();
    await assentar();
    await assentar();
  };
  const digitar = async (campo: HTMLInputElement, valor: string) => {
    campo.value = valor;
    campo.dispatchEvent(new Event('input'));
    await assentar();
  };
  /** Responde o que a tela de custos pede ao abrir: detalhe, catálogo e tipos de casco. */
  const responderCustos = async (id: string, d: AbastecimentoDetalheResponse) => {
    http.expectOne((r) => r.url === `${BASE}/abastecimentos/${id}`).flush(d);
    http.expectOne(`${BASE}/produtos`).flush(catalogo);
    http.expectOne(`${BASE}/estoque/cascos`).flush([]);
    http.expectOne(`${BASE}/tipos-casco`).flush([TIPO_CASCO]);
    await assentar();
    await assentar();
  };
  await navegar(urlInicial);
  return {
    harness,
    http,
    el,
    texto,
    botao,
    clicar,
    digitar,
    navegar,
    assentar,
    responderCustos,
    toasts: () => TestBed.inject(ToastService).toasts(),
    url: () => TestBed.inject(Router).url,
  };
}
