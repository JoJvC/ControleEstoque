import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';

import { SheetService } from '../../core/overlay/sheet-service';
import { ToastService } from '../../core/toast/toast-service';
import { ICONES } from '../../ui/atoms/icon';

import { acoes, assentar, configurar } from './testing';
import { lerPadraoPagina, reenviarForm } from '../../ui/organisms/padrao-pagina.testing';
import { FuncionarioPage } from './funcionario-page';
import { LancarSheet } from './lancar-sheet';

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

async function montar(
  func: object = ANA,
  permissoes = ['rh.gerir'],
  opcoes: { desktop?: boolean; lancamentos?: unknown[]; saldo?: number; fecharCom?: number } = {},
) {
  const abrir = vi.fn(() => ({ closed: of(opcoes.fecharCom) }));
  configurar(permissoes, opcoes.desktop ?? false, [{ provide: SheetService, useValue: { abrir } }]);
  const http = TestBed.inject(HttpTestingController);
  const fixture = TestBed.createComponent(FuncionarioPage);
  fixture.componentRef.setInput('id', 'f1');
  fixture.detectChanges();
  await assentar(fixture);
  if (opcoes.desktop) {
    http.expectOne('/api/rh/v1/funcionarios').flush([ANA]);
  }
  http.expectOne(URL).flush(func);
  await assentar(fixture);
  http.expectOne(CARGOS).flush([CAIXA]);
  http.expectOne(`${URL}/conta-corrente`).flush(extrato(opcoes.saldo ?? 100, opcoes.lancamentos));
  await assentar(fixture);
  return { fixture, http, abrir, ...acoes(fixture) };
}

describe('FuncionarioPage', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('ce-app-header mostra o nome do funcionário como título', async () => {
    const t = await montar();
    expect(t.el.querySelector('ce-app-header h1')!.textContent).toContain('Ana');
  });

  it('padrão de página no celular: voltar e Salvar no cabeçalho, Vale e Pagamento no destaque', async () => {
    const t = await montar();
    expect(lerPadraoPagina(t.el)).toEqual({
      cabecalhos: 1,
      voltar: true,
      acoes: ['Salvar'],
      barras: 0,
      cancelar: 0,
    });
    expect(t.el.querySelector('ce-app-header .destaque [aria-label="Lançar vale"]')).not.toBeNull();
    expect(
      t.el.querySelector<HTMLButtonElement>('ce-funcionario-form button[type="submit"]')!.hidden,
    ).toBe(true); // só o submitter do Enter; o Salvar visível mora no cabeçalho
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

  it('envio duplo: com o PUT pendente, Enter e Salvar do cabeçalho não enviam de novo', async () => {
    const t = await montar();
    t.botao('Salvar')!.click();
    const req = t.http.expectOne(URL);
    expect(req.request.method).toBe('PUT');
    const submitter = reenviarForm(t.el);
    t.botao('Salvar')!.click();
    await assentar(t.fixture);
    t.http.expectNone(URL); // um só PUT
    t.fixture.detectChanges();
    expect(submitter.hidden).toBe(true);
    expect(submitter.disabled).toBe(true);
    req.flush({}, { status: 500, statusText: 'Erro' });
    await assentar(t.fixture);
    t.fixture.detectChanges();
    expect(submitter.disabled).toBe(false);
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

  it('herói: saldo do servidor, rótulo com o primeiro nome e linha cargo · diária', async () => {
    const t = await montar({ ...ANA, nome: 'Ana Souza' }, ['rh.gerir'], { saldo: 37.5 });
    // saldo do servidor (37,50) difere da soma dos lançamentos (100,00)
    expect(t.el.querySelector('.destaque__saldo')!.textContent).toMatch(/R\$\s*37,50/);
    expect(t.el.querySelector('.destaque__rotulo')!.textContent).toContain(
      'Conta-corrente · a pagar a Ana',
    );
    expect(t.el.querySelector('.destaque__linha')!.textContent).toMatch(
      /Caixa ·\s*diária R\$\s*100,00/,
    );
  });

  it('valorDiaria 0: linha com "sem diária"', async () => {
    const t = await montar({ ...ANA, valorDiaria: 0 });
    expect(t.el.querySelector('.destaque__linha')!.textContent).toMatch(/Caixa ·\s*sem diária/);
  });

  it('botões Vale e Pagamento com aria-label e ícones do protótipo', async () => {
    const t = await montar();
    const vale = t.el.querySelector('[aria-label="Lançar vale"]')!;
    const pagamento = t.el.querySelector('[aria-label="Lançar pagamento"]')!;
    expect(vale.textContent).toContain('Vale');
    expect(vale.querySelector('path')!.getAttribute('d')).toBe(ICONES.vale[0]);
    expect(pagamento.textContent).toContain('Pagamento');
    expect(pagamento.querySelector('path')!.getAttribute('d')).toBe(ICONES.dinheiro[0]);
  });

  it.each([
    ['Lançar vale', 'VALE'],
    ['Lançar pagamento', 'PAGAMENTO'],
  ])(
    '%s abre a sheet e, ao fechar com o saldo novo, mostra "Saldo agora"',
    async (rotulo, tipo) => {
      const t = await montar(ANA, ['rh.gerir'], { fecharCom: 70 });
      t.el.querySelector<HTMLButtonElement>(`[aria-label="${rotulo}"]`)!.click();
      await assentar(t.fixture);
      expect(t.abrir).toHaveBeenCalledWith(LancarSheet, {
        funcionarioId: 'f1',
        nome: 'Ana',
        tipo,
        saldo: 100,
      });
      const toasts = TestBed.inject(ToastService).toasts();
      expect(toasts).toHaveLength(1);
      expect(toasts[0].message).toMatch(/Saldo agora R\$\s*70,00/);
    },
  );

  it('sheet cancelada: sem "Saldo agora"', async () => {
    const t = await montar();
    t.el.querySelector<HTMLButtonElement>('[aria-label="Lançar vale"]')!.click();
    await assentar(t.fixture);
    expect(TestBed.inject(ToastService).toasts()).toHaveLength(0);
  });

  it('extrato: da mais nova para a mais antiga, com sinal, saldo por linha e ícones', async () => {
    const t = await montar(ANA, ['rh.gerir'], {
      saldo: 300,
      lancamentos: [
        { id: 'p', tipo: 'PAGAMENTO', valor: 100, data: '2026-11-10T09:00:00', observacao: null },
        { id: 'v', tipo: 'VALE', valor: 50, data: '2026-11-14T09:30:00', observacao: 'gasolina' },
      ],
    });
    const linhas = Array.from(t.el.querySelectorAll('.extrato li'));
    expect(linhas).toHaveLength(2);
    expect(linhas[0].textContent).toContain('Vale');
    expect(linhas[0].textContent).toContain('gasolina');
    expect(linhas[0].textContent).toMatch(/14\/11\/2026 09:30 · saldo\s*R\$\s*300,00/);
    expect(linhas[0].querySelector('.valor')!.textContent).toMatch(/−\s*R\$\s*50,00/);
    expect(linhas[1].textContent).toContain('Pagamento');
    expect(linhas[1].textContent).toMatch(/saldo\s*R\$\s*350,00/);
    expect(linhas[1].querySelector('.valor')!.textContent).toMatch(/−\s*R\$\s*100,00/);
    expect(linhas[0].querySelector('.icone-tipo.fiado svg path')!.getAttribute('d')).toBe(
      ICONES.vale[0],
    );
  });

  it('extrato: diária soma ("+") com o ícone receber', async () => {
    const t = await montar();
    const li = t.el.querySelector('.extrato li')!;
    expect(li.querySelector('.valor')!.textContent).toMatch(/\+\s*R\$\s*100,00/);
    expect(li.querySelector('.icone-tipo.pago svg path')!.getAttribute('d')).toBe(
      ICONES.receber[0],
    );
    expect(li.textContent).toMatch(/saldo\s*R\$\s*100,00/);
  });

  it('extrato vazio: estado "Sem lançamentos"', async () => {
    const t = await montar(ANA, ['rh.gerir'], { lancamentos: [] });
    expect(t.el.querySelector('.extrato')).toBeNull();
    expect(t.el.querySelector('ce-empty-state')!.textContent).toContain('Sem lançamentos');
    expect(t.el.textContent).toContain(
      'Diárias entram no fechamento do caixa; vales e pagamentos você lança aqui.',
    );
  });

  it('o formulário de dados fica abaixo do extrato', async () => {
    const t = await montar();
    const extrato = t.el.querySelector('.extrato')!;
    const form = t.el.querySelector('ce-funcionario-form')!;
    expect(extrato.compareDocumentPosition(form) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('desktop: grade com a lista (aria-current no aberto) e sem botão Voltar', async () => {
    const t = await montar(ANA, ['rh.gerir'], { desktop: true });
    expect(t.el.querySelector('ce-rh-grade')).not.toBeNull();
    expect(t.el.querySelector('.mestre ce-list-item')!.getAttribute('aria-current')).toBe('true');
    expect(t.el.querySelector('.detalhe ce-app-header h1')!.textContent).toContain('Ana');
    // '+ Novo' só no cabeçalho de seção da coluna do mestre; o detalhe tem o seu cabeçalho
    expect(t.el.querySelector('.mestre ce-app-header h2')!.textContent).toContain('Funcionários');
    expect(t.el.querySelector('.mestre ce-app-header')!.textContent).toContain('+ Novo');
    expect(t.el.querySelector('.detalhe ce-app-header')!.textContent).not.toContain('+ Novo');
    expect(t.el.querySelector('ce-barra-acao')).toBeNull();
    expect(t.el.querySelector('ce-app-header button[aria-label="Voltar"]')).toBeNull();
  });

  it('sem rh.gerir: sem Salvar nem lançar', async () => {
    const t = await montar(ANA, []);
    expect(t.botao('Salvar')).toBeUndefined();
    expect(t.el.querySelector('[aria-label="Lançar vale"]')).toBeNull();
    expect(t.el.querySelector('[aria-label="Lançar pagamento"]')).toBeNull();
    expect(t.el.querySelector('.destaque__acoes button')).toBeNull();
  });

  it('falha no GET da conta-corrente: alerta e sem herói', async () => {
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
    expect(el.querySelector('.destaque__saldo')).toBeNull();
    expect(el.querySelector('[role="alert"]')!.textContent).toContain('conta-corrente');
  });
});
