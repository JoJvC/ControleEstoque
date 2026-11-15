import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { ProdutoResponse } from '../../core/api/models/estoque';
import { produtoResp } from '../../core/api/testing';
import { CascoTipoEstado, CobrarAcao, CobrarEstado, CobrarPainel } from './cobrar-painel';
import { itemCarrinho } from './testing';

function produto(tipo: ProdutoResponse['tipo'], nome: string): ProdutoResponse {
  return produtoResp({ id: `p-${nome}`, tipo, nome });
}

const CASCO_T: CascoTipoEstado = {
  tipoCascoId: 't-1',
  nome: 'Casco 20L',
  aceitaSucata: true,
  vendidosEmTroca: 5,
  devolvidos: 3,
  travado: false,
  sucata: 1,
  naRua: 2,
  aMais: 0,
};

const CASCO_G: CascoTipoEstado = {
  ...CASCO_T,
  tipoCascoId: 't-2',
  nome: 'Casco 10L',
  aceitaSucata: false,
  vendidosEmTroca: 2,
  devolvidos: 0,
  sucata: 0,
  naRua: 2,
};

const ESTADO: CobrarEstado = {
  itens: [
    itemCarrinho({
      produto: produto('RETORNAVEL', 'Água 20L'),
      quantidade: 5,
      desconto: { tipo: 'VALOR', valor: 10, motivo: 'cliente antigo' },
    }),
  ],
  totais: { bruto: 250, desconto: 10, liquido: 240 },
  cascos: [CASCO_T],
  cascosNaHora: false,
  clienteNome: 'Ana',
  pagamentos: [{ forma: 'PIX', valor: 200 }],
  excede: false,
  erro: null,
  enviando: false,
  podeRegistrar: true,
  rotuloConfirmar: 'Confirmar venda',
};

function montar(estado: Partial<CobrarEstado> = {}) {
  const fixture: ComponentFixture<CobrarPainel> = TestBed.createComponent(CobrarPainel);
  fixture.componentRef.setInput('estado', { ...ESTADO, ...estado });
  const acoes: CobrarAcao[] = [];
  fixture.componentInstance.acao.subscribe((a) => acoes.push(a));
  const el = fixture.nativeElement as HTMLElement;
  const texto = () => (el.textContent ?? '').replace(/\s+/g, ' ');
  const botao = (rotulo: string) =>
    Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.trim().includes(rotulo))!;
  const campo = (seletor: string, indice = 0) =>
    el.querySelectorAll<HTMLInputElement>(seletor)[indice];
  return { fixture, acoes, el, texto, botao, campo };
}

describe('CobrarPainel', () => {
  it('input: mostra linhas, totais, cascos, sucata, pagamento e o botão com o total', async () => {
    const t = montar();
    await t.fixture.whenStable();

    expect(t.texto()).toContain('5× Água 20L — Indaiá');
    expect(t.texto()).toMatch(/desc\. R\$ 10,00 · cliente antigo/);
    expect(t.texto()).toMatch(/Bruto ?R\$ 250,00/);
    expect(t.texto()).toMatch(/Desconto \(por item\) ?− R\$ 10,00/);
    expect(t.texto()).toMatch(/Total ?R\$ 240,00/);
    expect(t.texto()).toContain('Cascos devolvidos agora');
    expect(t.texto()).toContain('Casco 20L: Ficam 2 cascos na rua com Ana');
    expect(t.texto()).toContain('Sucata entregue agora');
    expect(t.texto()).toContain('Sucata não abate o débito de casco');
    expect(t.texto()).toMatch(/Vai para fiado: R\$ 40,00/);
    expect(t.botao('Confirmar venda').textContent).toMatch(/Confirmar venda · R\$\s240,00/);
  });

  it('input: marca Genérica aparece como "sem marca" na linha', async () => {
    const gelo = produtoResp({ id: 'p-gelo', tipo: 'DESCARTAVEL', nome: 'Gelo 5kg' });
    const t = montar({
      itens: [itemCarrinho({ produto: gelo, marca: { ...gelo.marcas[0], marcaNome: 'Genérica' } })],
    });
    await t.fixture.whenStable();

    expect(t.texto()).toContain('1× Gelo 5kg — sem marca');
    expect(t.texto()).not.toContain('Genérica');
  });

  it('input: o feedback de casco na rua usa o nome completo do cliente', async () => {
    const t = montar({ clienteNome: 'Dona Rosa' });
    await t.fixture.whenStable();

    expect(t.texto()).toContain('Casco 20L: Ficam 2 cascos na rua com Dona Rosa');
  });

  it('input: sem tipo de casco no carrinho oculta cascos e sucata', async () => {
    const t = montar({ cascos: [] });
    await t.fixture.whenStable();

    expect(t.el.querySelector('.casco')).toBeNull();
    expect(t.el.querySelector('.sucata')).toBeNull();
  });

  it('input: um stepper de devolução por tipo; sucata só para quem aceita', async () => {
    const t = montar({ cascos: [CASCO_T, CASCO_G] });
    await t.fixture.whenStable();

    const devolucao = t.el.querySelectorAll('.casco ce-quantity-stepper');
    const sucata = t.el.querySelectorAll('.sucata ce-quantity-stepper');
    expect(devolucao.length).toBe(2);
    expect(sucata.length).toBe(1);
    expect(t.texto()).toContain('Sucata entregue — Casco 20L');
    expect(t.texto()).not.toContain('Sucata entregue — Casco 10L');
  });

  it('input: vasilhame pago aparece na linha do carrinho', async () => {
    const t = montar({
      itens: [itemCarrinho({ produto: produto('RETORNAVEL', 'Água 20L'), pagouVasilhame: true })],
    });
    await t.fixture.whenStable();

    expect(t.texto()).toContain('vasilhame pago');
  });

  it('input: com "na hora" o stepper de cada tipo fica desabilitado no valor vendido', async () => {
    const travado = { ...CASCO_T, devolvidos: 5, travado: true };
    const t = montar({
      cascos: [travado, { ...CASCO_G, devolvidos: 2, travado: true }],
      cascosNaHora: true,
    });
    await t.fixture.whenStable();

    const campos = Array.from(
      t.el.querySelectorAll<HTMLInputElement>('.casco ce-quantity-stepper input'),
    );
    expect(campos.map((c) => c.disabled)).toEqual([true, true]);
    expect(campos.map((c) => c.value)).toEqual(['5', '2']);
  });

  it('input: sem "na hora" o stepper fica editável', async () => {
    const t = montar();
    await t.fixture.whenStable();

    expect(t.campo('.casco ce-quantity-stepper input').disabled).toBe(false);
  });

  it('input: excede mostra a mensagem do erro; erro e rótulo vêm do estado', async () => {
    const t = montar({
      excede: true,
      erro: 'O caixa do dia já está fechado.',
      rotuloConfirmar: 'Salvar alterações',
    });
    await t.fixture.whenStable();

    const alertas = Array.from(t.el.querySelectorAll('[role="alert"]')).map((a) => a.textContent);
    expect(alertas).toContain('A soma dos pagamentos ultrapassa o total da venda.');
    expect(alertas).toContain('O caixa do dia já está fechado.');
    expect(t.botao('Salvar alterações')).toBeTruthy();
  });

  it('input: podeRegistrar falso desabilita o botão', async () => {
    const t = montar({ podeRegistrar: false });
    await t.fixture.whenStable();

    expect(t.botao('Confirmar venda').disabled).toBe(true);
  });

  it('output: registrar, atalho de casco, cascos, sucata, pagamentos e atalho de pagamento', async () => {
    const t = montar();
    await t.fixture.whenStable();
    const aoMudar = async (campo: HTMLInputElement, valor: string) => {
      campo.value = valor;
      campo.dispatchEvent(new Event('input'));
      await t.fixture.whenStable();
    };

    t.campo('ce-checkbox input').click();
    await aoMudar(t.campo('ce-quantity-stepper input', 0), '4');
    await aoMudar(t.campo('ce-quantity-stepper input', 1), '2');
    await aoMudar(t.campo('ce-money-input input'), '10000');
    t.botao('Metade').click();
    t.botao('Dinheiro').click();
    t.botao('PIX').click();
    t.botao('Tudo fiado').click();
    t.botao('Confirmar venda').click();
    await t.fixture.whenStable();

    expect(t.acoes).toEqual([
      { tipo: 'naHora', valor: true },
      { tipo: 'cascos', tipoCascoId: 't-1', valor: 4 },
      { tipo: 'sucata', tipoCascoId: 't-1', valor: 2 },
      { tipo: 'pagamentos', valor: [{ forma: 'PIX', valor: 100 }] },
      { tipo: 'atalho', indice: 0, qual: 'metade' },
      {
        tipo: 'pagamentos',
        valor: [
          { forma: 'PIX', valor: 200 },
          { forma: 'DINHEIRO', valor: 40 },
        ],
      },
      { tipo: 'pagamentos', valor: [] },
      { tipo: 'tudoFiado' },
      { tipo: 'registrar' },
    ]);
  });

  it('output: botão desabilitado não emite registrar', async () => {
    const t = montar({ podeRegistrar: false });
    const emitir = vi.fn();
    t.fixture.componentInstance.acao.subscribe(emitir);
    await t.fixture.whenStable();

    t.botao('Confirmar venda').click();

    expect(emitir).not.toHaveBeenCalled();
  });
});
