import { lerPadraoPagina } from '../../ui/organisms/padrao-pagina.testing';
import { BASE, detalhe, montarRotas, pendente } from './abastecimento-testing';

const COMPLETAR = 'Completar custo';
const total = (el: HTMLElement) =>
  (el.querySelector('.total b')?.textContent ?? '').replace(/\s/g, ' ');
const botoes = (el: HTMLElement) =>
  Array.from(el.querySelectorAll('button')).filter((b) => b.textContent?.includes(COMPLETAR));

describe('AbastecimentoPendentesPage', () => {
  it('lista as pendentes; completar uma leva aos custos e ela some ao recarregar', async () => {
    const t = await montarRotas(['estoque.custos'], '/estoque/abastecimento/pendentes');
    const lista = t.http.expectOne((r) => r.url === `${BASE}/abastecimentos/custos-pendentes`);
    expect(lista.request.params.get('funcionarioId')).toBe('f1');
    lista.flush([
      pendente('ab1', { linhasSemCusto: 1, freteFaltando: false }),
      pendente('ab2', { totalUnidades: 7, linhasSemCusto: 3, freteFaltando: true }),
    ]);
    await t.assentar();
    expect(botoes(t.el())).toHaveLength(2);
    expect(t.texto()).toContain('10/11/2026');
    expect(t.texto()).toContain('Fornecedor entrega · 7 un');
    expect(t.texto()).toContain('3 linhas sem custo · frete faltando');
    expect(t.texto()).toContain('1 linha sem custo');

    botoes(t.el())[1].click();
    await t.assentar();
    await t.assentar();
    expect(t.url()).toBe('/estoque/abastecimento/ab2/custos');
    await t.responderCustos('ab2', detalhe({ id: 'ab2' }));

    const campos = Array.from(t.el().querySelectorAll<HTMLInputElement>('ce-money-input input'));
    await t.digitar(campos[0], '800');
    await t.digitar(campos[1], '900');
    await t.digitar(campos[3], '1000');
    await t.clicar('Salvar');
    const put = t.http.expectOne(`${BASE}/abastecimentos/ab2/custos`);
    expect(put.request.method).toBe('PUT');
    put.flush(detalhe({ id: 'ab2', frete: 10, custoPendente: false, custoTotal: 190 }));
    await t.assentar();
    expect(total(t.el())).toBe('R$ 190,00');

    // Volta à lista: o servidor já não a devolve.
    await t.navegar('/estoque/abastecimento/pendentes');
    t.http
      .expectOne((r) => r.url === `${BASE}/abastecimentos/custos-pendentes`)
      .flush([pendente('ab1', { linhasSemCusto: 1, freteFaltando: false })]);
    await t.assentar();
    expect(botoes(t.el())).toHaveLength(1);
    t.http.verify();
  });

  it('padrão de página: voltar, sem ação no cabeçalho, sem barra nem Cancelar', async () => {
    const t = await montarRotas(['*'], '/estoque/abastecimento/pendentes');
    t.http.expectOne((r) => r.url === `${BASE}/abastecimentos/custos-pendentes`).flush([]);
    await t.assentar();
    expect(lerPadraoPagina(t.el())).toEqual({
      cabecalhos: 1,
      voltar: true,
      acoes: [],
      barras: 0,
      cancelar: 0,
    });
  });

  it('sem pendentes mostra o vazio', async () => {
    const t = await montarRotas(['*'], '/estoque/abastecimento/pendentes');
    t.http.expectOne((r) => r.url === `${BASE}/abastecimentos/custos-pendentes`).flush([]);
    await t.assentar();
    expect(t.texto()).toContain('Nenhuma carga com custo pendente');
  });

  it('erro de carga oferece tentar de novo', async () => {
    const t = await montarRotas(['*'], '/estoque/abastecimento/pendentes');
    t.http
      .expectOne((r) => r.url === `${BASE}/abastecimentos/custos-pendentes`)
      .flush(null, { status: 500, statusText: 'err' });
    await t.assentar();
    await t.clicar('Tentar novamente');
    t.http
      .expectOne((r) => r.url === `${BASE}/abastecimentos/custos-pendentes`)
      .flush([pendente('ab1')]);
    await t.assentar();
    expect(botoes(t.el())).toHaveLength(1);
  });
});
