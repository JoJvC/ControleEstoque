import { VendaDetalheResponse } from '../../core/api/models/vendas';
import { cupomHtml, dataHoraCupom } from './cupom-html';
import { EstadoProduto } from './venda-rotulos';

const VENDA: VendaDetalheResponse = {
  id: 'v-1',
  clienteId: 'c-1',
  funcionarioId: 'f-1',
  enderecoEntregaId: null,
  data: '2026-01-02T10:30:00',
  totalBruto: 120,
  totalDesconto: 20,
  totalLiquido: 100,
  statusPagamento: 'PAGA',
  observacao: null,
  cupomEmitido: true,
  cupomNumero: 'CF-00000001',
  cupomEmitidoEm: '2026-01-02T11:00:00',
  itens: [
    {
      produtoId: 'p-1',
      marcaId: 'm-1',
      tipoCascoId: null,
      quantidade: 3,
      precoUnitario: 40,
      descontoTipo: null,
      descontoValor: null,
      motivoDesconto: null,
      totalItem: 120,
    },
  ],
  pagamentos: [{ forma: 'PIX', valor: 100 }],
  cascosDevolvidos: [],
  vasilhames: [],
  sucataEntregue: [],
};

const normalizar = (s: string) => s.replace(/\s/g, ' ');

describe('cupomHtml', () => {
  it('traz número, data, itens, totais e pagamentos', () => {
    const produtos = new Map<string, EstadoProduto>([['p-1', { estado: 'ok', nome: 'Água 20L' }]]);
    const html = normalizar(cupomHtml(VENDA, produtos));

    expect(html).toContain('Cupom fiscal nº CF-00000001');
    expect(html).toContain(dataHoraCupom('2026-01-02T11:00:00'));
    expect(html).toContain('Água 20L');
    expect(html).toContain('<td>3</td>');
    expect(html).toContain('R$ 40,00');
    expect(html).toContain('Bruto: R$ 120,00');
    expect(html).toContain('Desconto: R$ 20,00');
    expect(html).toContain('Líquido: R$ 100,00');
    expect(html).toContain('PIX');
  });

  it('escapa texto vindo de dados', () => {
    const produtos = new Map<string, EstadoProduto>([
      ['p-1', { estado: 'ok', nome: '<script>alert(1)</script>' }],
    ]);
    const html = cupomHtml(VENDA, produtos);

    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });
});
