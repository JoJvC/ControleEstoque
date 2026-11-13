import { VendaDetalheResponse } from '../../core/api/models/vendas';
import { EstadoProduto, rotuloForma, rotuloProduto } from './venda-rotulos';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const DATA_HORA = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

/** Data/hora do cupom como aparece no HTML (pt-BR). */
export function dataHoraCupom(iso: string): string {
  return DATA_HORA.format(new Date(iso));
}

// O HTML vai para doc.write no WebPrintService: todo texto vindo de dados é escapado.
function esc(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** HTML do cupom fiscal de uma venda com cupom emitido (cupomNumero/cupomEmitidoEm preenchidos). */
export function cupomHtml(
  venda: VendaDetalheResponse,
  produtos: ReadonlyMap<string, EstadoProduto>,
): string {
  const itens = venda.itens
    .map(
      (i) =>
        `<tr><td>${esc(rotuloProduto(produtos.get(i.produtoId)))}</td><td>${i.quantidade}</td>` +
        `<td>${BRL.format(i.precoUnitario)}</td><td>${BRL.format(i.totalItem)}</td></tr>`,
    )
    .join('');
  const pagamentos = venda.pagamentos
    .map((p) => `<tr><td>${esc(rotuloForma(p.forma))}</td><td>${BRL.format(p.valor)}</td></tr>`)
    .join('');
  const emitidoEm = venda.cupomEmitidoEm ? dataHoraCupom(venda.cupomEmitidoEm) : '';

  return (
    `<h1>Cupom fiscal nº ${esc(venda.cupomNumero ?? '')}</h1><p>${esc(emitidoEm)}</p>` +
    `<table><thead><tr><th>Item</th><th>Qtd</th><th>Unitário</th><th>Total</th></tr></thead>` +
    `<tbody>${itens}</tbody></table>` +
    `<p>Bruto: ${BRL.format(venda.totalBruto)}</p>` +
    `<p>Desconto: ${BRL.format(venda.totalDesconto)}</p>` +
    `<p><strong>Líquido: ${BRL.format(venda.totalLiquido)}</strong></p>` +
    `<h2>Pagamentos</h2><table><tbody>${pagamentos}</tbody></table>`
  );
}
