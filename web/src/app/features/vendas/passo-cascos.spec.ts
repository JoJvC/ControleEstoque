import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CobrarAcao, CobrarEstado } from './cobrar-estado';
import { PassoCascos } from './passo-cascos';
import { estadoCobrar } from './testing';

function montar(estado: Partial<CobrarEstado> = {}) {
  const fixture: ComponentFixture<PassoCascos> = TestBed.createComponent(PassoCascos);
  fixture.componentRef.setInput('estado', estadoCobrar(estado));
  const acoes: CobrarAcao[] = [];
  fixture.componentInstance.acao.subscribe((a) => acoes.push(a));
  const el = fixture.nativeElement as HTMLElement;
  const digitar = async (seletor: string, valor: string, indice = 0) => {
    const campo = el.querySelectorAll<HTMLInputElement>(seletor)[indice];
    campo.value = valor;
    campo.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  };
  const botao = (rotulo: string) =>
    Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.trim() === rotulo)!;
  const texto = () => (el.textContent ?? '').replace(/\s+/g, ' ');
  return { fixture, acoes, el, digitar, botao, texto };
}

const VASILHAME = {
  tipoCascoId: 't-2',
  nome: 'Casco 10L',
  quantidade: 1,
  precoUnitario: 15,
  modo: 'COMPRAR' as const,
  abatida: 0,
  total: 15,
  escolhaModo: true,
};

describe('PassoCascos', () => {
  it('toque: checkbox "na hora", stepper de casco, quantidade e desconto da sucata emitem as ações', async () => {
    const t = montar();
    await t.fixture.whenStable();

    t.el.querySelector<HTMLInputElement>('ce-checkbox input')!.click();
    await t.digitar('.casco ce-quantity-stepper input', '4');
    await t.digitar('.sucata ce-quantity-stepper input', '2');
    await t.digitar('.sucata ce-money-input input', '500');

    expect(t.acoes).toEqual([
      { tipo: 'naHora', valor: true },
      { tipo: 'cascos', tipoCascoId: 't-1', valor: 4 },
      { tipo: 'sucata', tipoCascoId: 't-1', valor: 2 },
      { tipo: 'sucataValor', tipoCascoId: 't-1', valor: 5 },
    ]);
  });

  it('toque: quantidade, valor e modo do vasilhame comprado emitem a ação por tipo', async () => {
    const t = montar({ cascos: [], vasilhames: [VASILHAME], totalVasilhames: 15 });
    await t.fixture.whenStable();

    await t.digitar('.vasilhame ce-quantity-stepper input', '3');
    t.botao('Abater do crédito').click();

    expect(t.acoes).toEqual([
      { tipo: 'vasilhame', tipoCascoId: 't-2', mudanca: { quantidade: 3 } },
      { tipo: 'vasilhame', tipoCascoId: 't-2', mudanca: { modo: 'ABATER_CREDITO' } },
    ]);
    expect(t.texto()).toContain('Total dos vasilhames: R$ 15,00');
  });

  it('ordem: cascos devolvidos, sucata e vasilhames comprados', async () => {
    const t = montar({ vasilhames: [VASILHAME] });
    await t.fixture.whenStable();

    const titulos = Array.from(t.el.querySelectorAll('h3')).map((h) => h.textContent?.trim());
    expect(titulos).toEqual([
      'Cascos devolvidos agora',
      'Sucata entregue agora',
      'Vasilhames comprados agora',
    ]);
  });

  it('sem tipo que aceite sucata não há seção de sucata; sem nada, o passo fica vazio', async () => {
    const [casco] = estadoCobrar().cascos;
    const t = montar({ cascos: [{ ...casco, aceitaSucata: false }] });
    await t.fixture.whenStable();
    expect(t.el.querySelector('.sucata')).toBeNull();
    expect(t.el.querySelector('.casco')).not.toBeNull();

    const vazio = montar({ cascos: [] });
    await vazio.fixture.whenStable();
    expect(vazio.el.querySelector('section')).toBeNull();
  });
});
