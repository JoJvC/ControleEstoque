import { ProdutoResponse } from '../../core/api/models/estoque';
import {
  CreateVendaRequest,
  FormaPagamento,
  ItemVendaRequest,
  TipoDesconto,
  VendaDetalheResponse,
} from '../../core/api/models/vendas';
import { PagamentoEdicao } from '../../ui/organisms/pagamento-lista';

export interface DescontoCarrinho {
  readonly tipo: TipoDesconto;
  readonly valor: number;
  readonly motivo: string;
}

export interface ItemCarrinho {
  readonly produto: ProdutoResponse;
  readonly quantidade: number;
  readonly precoUnitario: number;
  readonly desconto: DescontoCarrinho | null;
}

// Espelho client-side de VendaCalculos (backend) — SÓ para feedback ao vivo;
// os totais oficiais vêm sempre do response do servidor (Regra 8.6).

export function brutoDe(item: ItemCarrinho): number {
  return item.quantidade * item.precoUnitario;
}

export function valorDescontoDe(item: ItemCarrinho): number {
  if (item.desconto === null) {
    return 0;
  }
  const bruto = brutoDe(item);
  const valor =
    item.desconto.tipo === 'PERCENTUAL'
      ? Math.round(bruto * item.desconto.valor) / 100
      : item.desconto.valor;
  return Math.min(valor, bruto);
}

export function totalItemDe(item: ItemCarrinho): number {
  return brutoDe(item) - valorDescontoDe(item);
}

export function paraItemRequest(item: ItemCarrinho): ItemVendaRequest {
  return {
    produtoId: item.produto.id,
    quantidade: item.quantidade,
    precoUnitario: item.precoUnitario,
    desconto:
      item.desconto === null
        ? null
        : { tipo: item.desconto.tipo, valor: item.desconto.valor, motivo: item.desconto.motivo },
  };
}

export interface TotaisCarrinho {
  readonly bruto: number;
  readonly desconto: number;
  readonly liquido: number;
}

export interface RascunhoVenda {
  readonly clienteId: string;
  readonly funcionarioId: string;
  readonly enderecoEntregaId: string | null;
  readonly itens: readonly ItemCarrinho[];
  readonly pagamentos: readonly PagamentoEdicao[];
  readonly cascosDevolvidos: number;
  readonly cascosDevolvidosNaHora: boolean;
  readonly sucataEntregue: number;
}

// Dinheiro em reais com 2 casas: arredonda para não acumular erro de ponto flutuante.
const centavos = (valor: number): number => Math.round(valor * 100) / 100;

export function totaisDe(itens: readonly ItemCarrinho[]): TotaisCarrinho {
  const bruto = centavos(itens.reduce((soma, i) => soma + brutoDe(i), 0));
  const desconto = centavos(itens.reduce((soma, i) => soma + valorDescontoDe(i), 0));
  return { bruto, desconto, liquido: centavos(bruto - desconto) };
}

export function totalPagoDe(pagamentos: readonly PagamentoEdicao[]): number {
  return centavos(pagamentos.reduce((soma, p) => soma + (p.valor ?? 0), 0));
}

export function fiadoDe(liquido: number, pagamentos: readonly PagamentoEdicao[]): number {
  return Math.max(0, centavos(liquido - totalPagoDe(pagamentos)));
}

export function pagamentoExcede(liquido: number, pagamentos: readonly PagamentoEdicao[]): boolean {
  return totalPagoDe(pagamentos) > liquido;
}

// Saldo ainda a pagar de uma venda já gravada (pagamentos do detalhe); nunca negativo.
export function saldoAPagar(liquido: number, pagamentos: readonly { valor: number }[]): number {
  const pago = pagamentos.reduce((soma, p) => soma + Math.round(p.valor * 100), 0);
  return Math.max(0, Math.round(liquido * 100) - pago) / 100;
}

// Regra 8.5: valor acima do saldo é bloqueado no cliente.
export function excedeSaldo(saldo: number, valor: number): boolean {
  return Math.round(valor * 100) > Math.round(saldo * 100);
}

export function temAgua(itens: readonly ItemCarrinho[]): boolean {
  return itens.some((i) => i.produto.tipo === 'AGUA');
}

export function quantidadeAgua(itens: readonly ItemCarrinho[]): number {
  return itens.filter((i) => i.produto.tipo === 'AGUA').reduce((s, i) => s + i.quantidade, 0);
}

// Sem ÁGUA no carrinho o passo Cascos não existe: casco e sucata vão zerados.
export function paraCreateVendaRequest(rascunho: RascunhoVenda): CreateVendaRequest {
  const comCascos = temAgua(rascunho.itens);
  return {
    clienteId: rascunho.clienteId,
    funcionarioId: rascunho.funcionarioId,
    enderecoEntregaId: rascunho.enderecoEntregaId,
    itens: rascunho.itens.map(paraItemRequest),
    pagamentos: rascunho.pagamentos
      .filter((p) => p.valor !== null && p.valor > 0)
      .map((p) => ({ forma: p.forma as FormaPagamento, valor: p.valor as number })),
    cascosDevolvidos: comCascos ? rascunho.cascosDevolvidos : 0,
    cascosDevolvidosNaHora: comCascos && rascunho.cascosDevolvidosNaHora,
    sucataEntregue: comCascos ? rascunho.sucataEntregue : 0,
    observacao: null,
  };
}

// Pré-carga da edição: venda já gravada → rascunho do PDV. O vendedor original é mantido.
export function rascunhoDeVenda(
  venda: VendaDetalheResponse,
  produtos: ReadonlyMap<string, ProdutoResponse>,
): RascunhoVenda {
  return {
    clienteId: venda.clienteId,
    funcionarioId: venda.funcionarioId,
    enderecoEntregaId: venda.enderecoEntregaId,
    itens: venda.itens.map((i) => ({
      produto: produtos.get(i.produtoId) as ProdutoResponse,
      quantidade: i.quantidade,
      precoUnitario: i.precoUnitario,
      desconto:
        i.descontoTipo === null
          ? null
          : { tipo: i.descontoTipo, valor: i.descontoValor ?? 0, motivo: i.motivoDesconto ?? '' },
    })),
    pagamentos: venda.pagamentos.map((p) => ({ forma: p.forma, valor: p.valor })),
    cascosDevolvidos: venda.cascosDevolvidos ?? 0,
    cascosDevolvidosNaHora: false,
    sucataEntregue: venda.sucataEntregue ?? 0,
  };
}
