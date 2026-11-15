import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { acoes, assentar, configurar } from './testing';
import { FuncionarioPage } from './funcionario-page';

const URL = '/api/rh/v1/funcionarios/f1';
const CARGOS = '/api/rh/v1/cargos';
const ANA = {
  id: 'f1',
  nome: 'Ana',
  telefone: null,
  cargoId: 'c1',
  cargo: 'Caixa',
  valorDiaria: 100,
  ativo: true,
};
const DIARIA = {
  id: 'l1',
  tipo: 'DIARIA',
  valor: 100,
  data: '2026-11-13T10:00:00',
  observacao: null,
};
const extrato = (saldoAPagar: number, lancamentos: unknown[] = [DIARIA]) => ({
  funcionarioId: 'f1',
  saldoAPagar,
  lancamentos,
});
const CAIXA = { id: 'c1', nome: 'Caixa', nativo: false, permissoes: [] };

async function montar(func: object = ANA, permissoes = ['rh.gerir']) {
  configurar(permissoes);
  const http = TestBed.inject(HttpTestingController);
  const fixture = TestBed.createComponent(FuncionarioPage);
  fixture.componentRef.setInput('id', 'f1');
  fixture.detectChanges();
  await assentar(fixture);
  http.expectOne(URL).flush(func);
  await assentar(fixture);
  http.expectOne(CARGOS).flush([CAIXA]);
  http.expectOne(`${URL}/conta-corrente`).flush(extrato(100));
  await assentar(fixture);
  const a = acoes(fixture);
  return {
    fixture,
    http,
    ...a,
    chip: () => a.el.querySelector('ce-saldo-chip')!.textContent!,
    valor: async (digitos: string) => {
      const campo = a.el.querySelector('form.lancar ce-money-input input') as HTMLInputElement;
      campo.value = digitos;
      campo.dispatchEvent(new Event('input'));
      await fixture.whenStable();
    },
  };
}

describe('FuncionarioPage', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('ce-app-header mostra o nome do funcionário como título', async () => {
    const t = await montar();
    expect(t.el.querySelector('ce-app-header h1')!.textContent).toContain('Ana');
  });

  it('voltar do ce-app-header navega para /rh/funcionarios', async () => {
    const t = await montar();
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    t.el.querySelector<HTMLButtonElement>('ce-app-header button[aria-label="Voltar"]')!.click();
    expect(navegar).toHaveBeenCalledWith('/rh/funcionarios');
  });

  it('carregando a conta-corrente mostra skeleton e o texto acessível', async () => {
    configurar(['rh.gerir']);
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(FuncionarioPage);
    fixture.componentRef.setInput('id', 'f1');
    fixture.detectChanges();
    await assentar(fixture);
    http.expectOne(URL).flush(ANA);
    await assentar(fixture);
    http.expectOne(CARGOS).flush([CAIXA]);
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('ce-skeleton')).not.toBeNull();
    expect(el.textContent).toContain('Carregando conta-corrente…');
    http.expectOne(`${URL}/conta-corrente`).flush(extrato(100));
    await assentar(fixture);
    expect(el.querySelector('ce-skeleton')).toBeNull();
  });

  it('o saldo exibido é o que o servidor devolveu, sem soma no front', async () => {
    configurar(['rh.gerir']);
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(FuncionarioPage);
    fixture.componentRef.setInput('id', 'f1');
    fixture.detectChanges();
    await assentar(fixture);
    http.expectOne(URL).flush(ANA);
    await assentar(fixture);
    http.expectOne(CARGOS).flush([CAIXA]);
    // saldo do servidor (37,50) difere da soma dos lançamentos (100,00)
    http.expectOne(`${URL}/conta-corrente`).flush(extrato(37.5));
    await assentar(fixture);
    const chip = (fixture.nativeElement as HTMLElement).querySelector('ce-saldo-chip')!;
    expect(chip.textContent).toMatch(/R\$\s*37,50/);
  });

  it('extrato é lista informativa: sem botão nem estado disabled', async () => {
    const t = await montar();
    expect(t.el.querySelector('.lancamentos li.lancamento')).not.toBeNull();
    expect(t.el.querySelector('.lancamentos button, .lancamentos ce-list-item')).toBeNull();
  });

  it('mostra saldo no chip e o extrato com tipo, data, valor', async () => {
    const t = await montar();
    expect(t.chip()).toContain('Saldo a pagar');
    expect(t.chip()).toMatch(/R\$\s*100,00/);
    const li = t.el.querySelector('.lancamentos li')!.textContent!;
    expect(li).toContain('Diária');
    expect(li).toContain('13/11/2026');
    expect(li).toMatch(/R\$\s*100,00/);
  });

  it('Salvar com ativo desmarcado gera PUT com ativo false', async () => {
    const t = await montar();
    await t.marcar('Ativo');
    t.botao('Salvar')!.click();
    const req = t.http.expectOne(URL);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({
      nome: 'Ana',
      telefone: null,
      cargoId: 'c1',
      valorDiaria: 100,
      ativo: false,
    });
    req.flush({ ...ANA, ativo: false });
    await assentar(t.fixture);
  });

  it('valorDiaria 0 abre com Sem diária marcada e o PUT leva 0', async () => {
    const t = await montar({ ...ANA, valorDiaria: 0 });
    expect(t.caixa('Sem diária').checked).toBe(true);
    expect(t.inputDiaria().value).toBe('0,00');
    expect(t.inputDiaria().disabled).toBe(true);
    t.botao('Salvar')!.click();
    const req = t.http.expectOne(URL);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body.valorDiaria).toBe(0);
    req.flush({ ...ANA, valorDiaria: 0 });
    await assentar(t.fixture);
  });

  it('ciclo: vale de 30 e pagamento de 70 atualizam o chip', async () => {
    const t = await montar();
    await t.valor('3000');
    t.botao('Lançar vale')!.click();
    const vale = t.http.expectOne(`${URL}/vales`);
    expect(vale.request.method).toBe('POST');
    expect(vale.request.body).toEqual({ valor: 30, observacao: null });
    vale.flush({ saldoAPagar: 70 }, { status: 201, statusText: 'Created' });
    await assentar(t.fixture);
    t.http.expectOne(`${URL}/conta-corrente`).flush(extrato(70));
    await assentar(t.fixture);
    expect(t.chip()).toMatch(/R\$\s*70,00/);

    await t.valor('7000');
    t.botao('Lançar pagamento')!.click();
    const pag = t.http.expectOne(`${URL}/pagamentos`);
    expect(pag.request.body).toEqual({ valor: 70, observacao: null });
    pag.flush({ saldoAPagar: 0 }, { status: 201, statusText: 'Created' });
    await assentar(t.fixture);
    t.http.expectOne(`${URL}/conta-corrente`).flush(extrato(0));
    await assentar(t.fixture);
    expect(t.chip()).toMatch(/R\$\s*0,00/);
  });

  it('422 PAGAMENTO_EXCEDE_SALDO mostra o alerta e o chip não muda', async () => {
    const t = await montar();
    await t.valor('8000');
    t.botao('Lançar pagamento')!.click();
    t.http
      .expectOne(`${URL}/pagamentos`)
      .flush(
        { code: 'PAGAMENTO_EXCEDE_SALDO', message: 'm', traceId: 't' },
        { status: 422, statusText: 'Unprocessable' },
      );
    await assentar(t.fixture);
    expect(t.el.querySelector('[role="alert"]')!.textContent).toContain(
      'O valor do pagamento é maior que o saldo devedor.',
    );
    expect(t.chip()).toMatch(/R\$\s*100,00/);
  });

  it('botões de lançar ficam desabilitados sem valor', async () => {
    const t = await montar();
    expect(t.botao('Lançar vale')!.disabled).toBe(true);
    expect(t.botao('Lançar pagamento')!.disabled).toBe(true);
  });

  it('sem rh.gerir: sem Salvar nem lançar', async () => {
    const t = await montar(ANA, []);
    expect(t.botao('Salvar')).toBeUndefined();
    expect(t.botao('Lançar vale')).toBeUndefined();
    expect(t.botao('Lançar pagamento')).toBeUndefined();
  });

  it('falha no GET da conta-corrente: alerta e sem chip', async () => {
    configurar(['rh.gerir']);
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(FuncionarioPage);
    fixture.componentRef.setInput('id', 'f1');
    fixture.detectChanges();
    await assentar(fixture);
    http.expectOne(URL).flush(ANA);
    await assentar(fixture);
    http.expectOne(CARGOS).flush([CAIXA]);
    http.expectOne(`${URL}/conta-corrente`).flush({}, { status: 500, statusText: 'Server Error' });
    await assentar(fixture);
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('ce-saldo-chip')).toBeNull();
    expect(el.querySelector('[role="alert"]')!.textContent).toContain('conta-corrente');
  });
});
