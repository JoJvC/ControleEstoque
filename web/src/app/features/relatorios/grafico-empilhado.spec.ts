import { montarGraficoEmpilhado, proximoIndice } from './grafico-empilhado';

const OPCOES = {
  largura: 400,
  altura: 240,
  margem: { topo: 10, direita: 10, base: 30, esquerda: 60 },
};
// área útil: 330 × 200; base em y = 210

const normalizar = (s: string) => s.normalize('NFKC');
const ponto = (dia: string, recebido: number, fiadoGerado: number) => ({
  dia,
  recebido,
  fiadoGerado,
});

describe('montarGraficoEmpilhado', () => {
  it('série vazia: vazio e nenhuma barra', () => {
    const m = montarGraficoEmpilhado([], OPCOES);
    expect(m.vazio).toBe(true);
    expect(m.barras).toEqual([]);
    expect(Number.isFinite(m.maximo)).toBe(true);
  });

  it('exemplo: recebido embaixo, fiado em cima, altura total proporcional ao máximo', () => {
    const m = montarGraficoEmpilhado(
      [ponto('2026-11-10', 150, 40), ponto('2026-11-11', 0, 0)],
      OPCOES,
    );
    expect(m.vazio).toBe(false);
    expect(m.barras).toHaveLength(2);
    expect(m.maximo).toBeGreaterThanOrEqual(190);
    const [a, b] = m.barras;
    expect(a.recebido.altura).toBeCloseTo((150 / m.maximo) * 200);
    expect(a.fiado.altura).toBeCloseTo((40 / m.maximo) * 200);
    expect(a.recebido.altura + a.fiado.altura).toBeCloseTo((190 / m.maximo) * 200);
    // recebido toca a base; fiado começa onde o recebido termina
    expect(a.recebido.y + a.recebido.altura).toBeCloseTo(m.yBase);
    expect(a.fiado.y + a.fiado.altura).toBeCloseTo(a.recebido.y);
    expect(normalizar(a.ariaLabel)).toBe(
      '10/11: recebido R$ 150,00; fiado gerado R$ 40,00; total R$ 190,00',
    );
    expect(a.rotuloDia).toBe('10/11');
    expect(b.recebido.altura).toBe(0);
    expect(b.fiado.altura).toBe(0);
  });

  it('o maior dia chega ao topo da escala quando o total é um valor redondo', () => {
    const m = montarGraficoEmpilhado([ponto('2026-11-10', 100, 100)], OPCOES);
    expect(m.maximo).toBe(200);
    const b = m.barras[0];
    expect(b.recebido.altura + b.fiado.altura).toBeCloseTo(200);
  });

  it('ticks em valores redondos, crescentes, do 0 ao máximo', () => {
    const m = montarGraficoEmpilhado([ponto('2026-11-10', 150, 40)], OPCOES);
    expect(m.ticks.map((t) => t.valor)).toEqual([0, 50, 100, 150, 200]);
    expect(m.ticks[0].y).toBeCloseTo(m.yBase);
    expect(m.ticks.at(-1)!.y).toBeCloseTo(10);
    expect(normalizar(m.ticks[1].rotulo)).toBe('R$ 50,00');
  });

  it('todos os valores 0: sem NaN nem Infinity, alturas 0', () => {
    const m = montarGraficoEmpilhado(
      [ponto('2026-11-10', 0, 0), ponto('2026-11-11', 0, 0)],
      OPCOES,
    );
    expect(m.vazio).toBe(false);
    const numeros = [
      m.maximo,
      ...m.ticks.flatMap((t) => [t.valor, t.y]),
      ...m.barras.flatMap((b) => [
        b.x,
        b.largura,
        b.recebido.y,
        b.recebido.altura,
        b.fiado.y,
        b.fiado.altura,
      ]),
    ];
    expect(numeros.every(Number.isFinite)).toBe(true);
    expect(m.maximo).toBeGreaterThan(0);
    for (const b of m.barras) {
      expect(b.recebido.altura).toBe(0);
      expect(b.fiado.altura).toBe(0);
    }
  });

  it('um dia só: a barra ocupa o centro da área útil', () => {
    const m = montarGraficoEmpilhado([ponto('2026-11-10', 80, 20)], OPCOES);
    expect(m.barras).toHaveLength(1);
    const b = m.barras[0];
    expect(b.x + b.largura / 2).toBeCloseTo(60 + 330 / 2);
    expect(b.largura).toBeGreaterThan(0);
    expect(b.largura).toBeLessThan(330);
  });

  it('dia com um dos valores 0: segmento com altura 0', () => {
    const m = montarGraficoEmpilhado(
      [ponto('2026-11-10', 100, 0), ponto('2026-11-11', 0, 100)],
      OPCOES,
    );
    expect(m.barras[0].fiado.altura).toBe(0);
    expect(m.barras[0].recebido.altura).toBeGreaterThan(0);
    expect(m.barras[1].recebido.altura).toBe(0);
    expect(m.barras[1].fiado.altura).toBeGreaterThan(0);
    // sem recebido, o fiado fica sobre a base
    expect(m.barras[1].fiado.y + m.barras[1].fiado.altura).toBeCloseTo(m.yBase);
  });

  it('valores decimais: somam e formatam em pt-BR', () => {
    const m = montarGraficoEmpilhado([ponto('2026-11-10', 10.25, 0.5)], OPCOES);
    const b = m.barras[0];
    expect(b.recebido.altura + b.fiado.altura).toBeCloseTo((10.75 / m.maximo) * 200);
    expect(normalizar(b.ariaLabel)).toBe(
      '10/11: recebido R$ 10,25; fiado gerado R$ 0,50; total R$ 10,75',
    );
    expect(m.maximo).toBeGreaterThanOrEqual(10.75);
    const pequeno = montarGraficoEmpilhado([ponto('2026-11-10', 0.3, 0.1)], OPCOES);
    expect(pequeno.maximo).toBeGreaterThanOrEqual(0.4);
    expect(pequeno.ticks.every((t) => Number.isFinite(t.y))).toBe(true);
  });

  it('milhares: separador pt-BR', () => {
    const m = montarGraficoEmpilhado([ponto('2026-11-10', 1234.5, 0)], OPCOES);
    expect(normalizar(m.barras[0].ariaLabel)).toContain('recebido R$ 1.234,50');
  });

  it('preserva a ordem recebida e não deixa as barras se sobreporem', () => {
    const dias = ['2026-11-12', '2026-11-10', '2026-11-11'];
    const m = montarGraficoEmpilhado(
      dias.map((d) => ponto(d, 10, 5)),
      OPCOES,
    );
    expect(m.barras.map((b) => b.dia)).toEqual(dias);
    expect(m.barras.map((b) => b.rotuloDia)).toEqual(['12/11', '10/11', '11/11']);
    for (let i = 1; i < m.barras.length; i++) {
      expect(m.barras[i].x).toBeGreaterThanOrEqual(m.barras[i - 1].x + m.barras[i - 1].largura);
    }
  });

  it('valor inválido (NaN, negativo) vira 0', () => {
    const m = montarGraficoEmpilhado([ponto('2026-11-10', Number.NaN, -5)], OPCOES);
    expect(m.barras[0].recebido.altura).toBe(0);
    expect(m.barras[0].fiado.altura).toBe(0);
  });
});

describe('proximoIndice', () => {
  it('ArrowRight avança e para no fim', () => {
    expect(proximoIndice(0, 'ArrowRight', 3)).toBe(1);
    expect(proximoIndice(2, 'ArrowRight', 3)).toBe(2);
  });

  it('ArrowLeft volta e para no começo', () => {
    expect(proximoIndice(2, 'ArrowLeft', 3)).toBe(1);
    expect(proximoIndice(0, 'ArrowLeft', 3)).toBe(0);
  });

  it('Home vai para 0 e End para total−1', () => {
    expect(proximoIndice(2, 'Home', 5)).toBe(0);
    expect(proximoIndice(1, 'End', 5)).toBe(4);
  });

  it('outra tecla devolve o atual; total 0 também', () => {
    expect(proximoIndice(1, 'a', 3)).toBe(1);
    expect(proximoIndice(1, 'Tab', 3)).toBe(1);
    expect(proximoIndice(0, 'End', 0)).toBe(0);
  });
});
