import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { ProdutoResponse } from '../../core/api/models/estoque';
import { CobrarAcao, CobrarEstado, CobrarPainel } from './cobrar-painel';

function produto(tipo: ProdutoResponse['tipo'], nome: string): ProdutoResponse {
  return {
    id: `p-${nome}`,
    tipo,
    nome,
    marcaId: null,
    marca: null,
    categoria: null,
    tamanho: null,
    fotoUrl: null,
    precoReferencia: 50,
    estoqueMinimo: 0,
  };
}

const ESTADO: CobrarEstado = {
  itens: [
    {
      produto: produto('AGUA', 'Água 20L'),
      quantidade: 5,
      precoUnitario: 50,
      desconto: { tipo: 'VALOR', valor: 10, motivo: 'cliente antigo' },
    },
  ],
  totais: { bruto: 250, desconto: 10, liquido: 240 },
  comCascos: true,
  comGalaoCompleto: false,
  cascosDevolvidos: 3,
  cascosNaHora: false,
  cascoNaRua: 2,
  cascosAMais: 0,
  clienteNome: 'Ana',
  sucataEntregue: 1,
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

    expect(t.texto()).toContain('5× Água 20L');
    expect(t.texto()).toMatch(/desc\. R\$ 10,00 · cliente antigo/);
    expect(t.texto()).toMatch(/Bruto ?R\$ 250,00/);
    expect(t.texto()).toMatch(/Desconto \(por item\) ?− R\$ 10,00/);
    expect(t.texto()).toMatch(/Total ?R\$ 240,00/);
    expect(t.texto()).toContain('Cascos devolvidos agora');
    expect(t.texto()).toContain('Ficam 2 cascos na rua com Ana');
    expect(t.texto()).toContain('Sucata entregue agora');
    expect(t.texto()).toContain('Sucata não abate o débito de casco');
    expect(t.texto()).toMatch(/Vai para fiado: R\$ 40,00/);
    expect(t.botao('Confirmar venda').textContent).toMatch(/Confirmar venda · R\$\s240,00/);
  });

  it('input: sem ÁGUA oculta cascos e sucata; galão completo mostra a nota', async () => {
    const t = montar({ comCascos: false, comGalaoCompleto: true });
    await t.fixture.whenStable();

    expect(t.el.querySelector('.casco')).toBeNull();
    expect(t.el.querySelector('.sucata')).toBeNull();
    expect(t.texto()).toContain('Galão completo não gera casco: nada a devolver.');
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
      { tipo: 'cascos', valor: 4 },
      { tipo: 'sucata', valor: 2 },
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
