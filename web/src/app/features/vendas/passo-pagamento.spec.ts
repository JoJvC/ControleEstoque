import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CobrarAcao, CobrarEstado } from './cobrar-estado';
import { PassoPagamento } from './passo-pagamento';
import { estadoCobrar } from './testing';

function montar(estado: Partial<CobrarEstado> = {}) {
  const fixture: ComponentFixture<PassoPagamento> = TestBed.createComponent(PassoPagamento);
  fixture.componentRef.setInput('estado', estadoCobrar(estado));
  const acoes: CobrarAcao[] = [];
  fixture.componentInstance.acao.subscribe((a) => acoes.push(a));
  const el = fixture.nativeElement as HTMLElement;
  const botao = (rotulo: string) =>
    Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.trim() === rotulo)!;
  const texto = () => (el.textContent ?? '').replace(/\s+/g, ' ');
  return { fixture, acoes, el, botao, texto };
}

describe('PassoPagamento', () => {
  it('toque: pílula de forma, valor, Metade, Tudo e Tudo fiado emitem as ações', async () => {
    const t = montar();
    await t.fixture.whenStable();

    t.botao('Dinheiro').click();
    const valor = t.el.querySelector<HTMLInputElement>('.forma-linha ce-money-input input')!;
    valor.value = '10000';
    valor.dispatchEvent(new Event('input'));
    await t.fixture.whenStable();
    t.botao('Metade').click();
    t.botao('Tudo').click();
    t.botao('Tudo fiado').click();

    expect(t.acoes).toEqual([
      {
        tipo: 'pagamentos',
        valor: [
          { forma: 'PIX', valor: 200 },
          { forma: 'DINHEIRO', valor: 50 },
        ],
      },
      { tipo: 'pagamentos', valor: [{ forma: 'PIX', valor: 100 }] },
      { tipo: 'atalho', indice: 0, qual: 'metade' },
      { tipo: 'atalho', indice: 0, qual: 'tudo' },
      { tipo: 'tudoFiado' },
    ]);
  });

  it('mensagens: fiado, sobra que vira crédito e pago por completo', async () => {
    const t = montar();
    await t.fixture.whenStable();
    expect(t.texto()).toContain('Vai para fiado: R$ 50,00');

    t.fixture.componentRef.setInput(
      'estado',
      estadoCobrar({ pagamentos: [{ forma: 'PIX', valor: 300 }] }),
    );
    await t.fixture.whenStable();
    expect(t.texto()).toContain('Sobra de R$ 50,00 vira crédito de Ana');

    t.fixture.componentRef.setInput(
      'estado',
      estadoCobrar({ pagamentos: [{ forma: 'PIX', valor: 250 }] }),
    );
    await t.fixture.whenStable();
    expect(t.texto()).toContain('Pago por completo');
  });

  it('a forma "Crédito do cliente" só existe com crédito disponível', async () => {
    const sem = montar({ creditoDisponivel: 0 });
    await sem.fixture.whenStable();
    expect(sem.texto()).not.toContain('Crédito do cliente');

    const com = montar({ creditoDisponivel: 30 });
    await com.fixture.whenStable();
    expect(com.texto()).toContain('Crédito do cliente');
  });

  it('o crédito não passa do disponível', async () => {
    const t = montar({
      creditoDisponivel: 30,
      pagamentos: [{ forma: 'CREDITO_CLIENTE', valor: 10 }],
    });
    await t.fixture.whenStable();

    const valor = t.el.querySelector<HTMLInputElement>('.forma-linha ce-money-input input')!;
    valor.value = '8000';
    valor.dispatchEvent(new Event('input'));
    await t.fixture.whenStable();

    expect(t.acoes).toEqual([
      { tipo: 'pagamentos', valor: [{ forma: 'CREDITO_CLIENTE', valor: 30 }] },
    ]);
  });

  it('mostra o erro do estado e não tem botão de confirmar', async () => {
    const t = montar({ erro: 'O caixa do dia já está fechado.' });
    await t.fixture.whenStable();

    expect(t.el.querySelector('[role="alert"]')?.textContent).toContain('caixa do dia');
    expect(t.el.querySelector('[data-testid="confirmar-venda"]')).toBeNull();
  });
});
