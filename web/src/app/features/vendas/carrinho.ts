import {
  ProdutoMarcaResponse,
  ProdutoResponse,
  TipoCascoResponse,
} from '../../core/api/models/estoque';
import {
  CascoPorTipoRequest,
  CreateVendaRequest,
  FormaPagamento,
  ItemVendaRequest,
  TipoDesconto,
  VendaDetalheResponse,
} from '../../core/api/models/vendas';
import { PagamentoEdicao } from '../../ui/organisms/pagamento-lista';
import { QuantidadesPorTipo, cascosParaRequest, tiposCascoDoCarrinho } from './cascos-por-tipo';

export interface DescontoCarrinho {
  readonly tipo: TipoDesconto;
  readonly valor: number;
  readonly motivo: string;
}

/** A identidade do item é produto+marca. */
export interface ItemCarrinho {
  readonly produto: ProdutoResponse;
  readonly marca: ProdutoMarcaResponse;
  readonly quantidade: number;
  readonly precoUnitario: number;
  readonly desconto: DescontoCarrinho | null;
  /** Cliente pagou o vasilhame (em vez de trocar ou emprestar o casco). */
  readonly pagouVasilhame: boolean;
  /** Preço do vasilhame do tipo de casco da marca; só entra no bruto com `pagouVasilhame`. */
  readonly precoVasilhame: number;
}

export const mesmoItem = (
  item: ItemCarrinho,
  produto: ProdutoResponse,
  marca: ProdutoMarcaResponse,
): boolean => item.produto.id === produto.id && item.marca.marcaId === marca.marcaId;

export function precoVasilhameDe(
  marca: ProdutoMarcaResponse,
  tiposCasco: readonly TipoCascoResponse[],
): number {
  return tiposCasco.find((t) => t.id === marca.tipoCascoResolvidoId)?.precoVasilhame ?? 0;
}

/** Linha nova no carrinho: troca/empréstimo por padrão, preço sugerido = referência da marca. */
export function itemNovo(
  produto: ProdutoResponse,
  marca: ProdutoMarcaResponse,
  quantidade: number,
  tiposCasco: readonly TipoCascoResponse[],
): ItemCarrinho {
  return {
    produto,
    marca,
    quantidade,
    precoUnitario: marca.precoReferencia,
    desconto: null,
    pagouVasilhame: false,
    precoVasilhame: precoVasilhameDe(marca, tiposCasco),
  };
}

// Espelho client-side de VendaCalculos (backend) — SÓ para feedback ao vivo;
// os totais oficiais vêm sempre do response do servidor (Regra 8.6).

export function brutoDe(item: ItemCarrinho): number {
  const vasilhame = item.pagouVasilhame ? item.quantidade * item.precoVasilhame : 0;
  return item.quantidade * item.precoUnitario + vasilhame;
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
    marcaId: item.marca.marcaId,
    quantidade: item.quantidade,
    precoUnitario: item.precoUnitario,
    desconto:
      item.desconto === null
        ? null
        : { tipo: item.desconto.tipo, valor: item.desconto.valor, motivo: item.desconto.motivo },
    pagouVasilhame: item.pagouVasilhame,
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
  readonly cascosDevolvidos: QuantidadesPorTipo;
  readonly cascosNaHora: boolean;
  readonly sucataEntregue: QuantidadesPorTipo;
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

// Feedback local do passo Cascos (Regra 8.1): não é saldo guardado, o servidor continua dono dele.
export function cascosNaRua(quantidadeDeAgua: number, devolvidos: number): number {
  return Math.max(0, quantidadeDeAgua - devolvidos);
}

/** Linha de feedback do casco no fechamento: o que fica na rua com o cliente ou quanto veio a mais. */
export function rotuloCascoNaRua(naRua: number, aMais: number, cliente: string | null): string {
  if (aMais > 0) {
    return `Devolveu ${aMais} a mais`;
  }
  const com = cliente ? ` com ${cliente}` : '';
  return naRua === 1 ? `Fica 1 casco na rua${com}` : `Ficam ${naRua} cascos na rua${com}`;
}

/**
 * Valor do atalho de pagamento para a linha `indice` (ou uma linha nova, se fora da lista):
 * restante = total − o que as outras linhas já pagam. "Tudo fiado" não tem valor: a página zera os pagamentos.
 */
export function valorDoAtalho(
  atalho: 'tudo' | 'metade',
  liquido: number,
  pagamentos: readonly PagamentoEdicao[],
  indice = pagamentos.length,
): number {
  const outras = pagamentos.filter((_, i) => i !== indice);
  const restante = Math.max(0, Math.round(liquido * 100) - Math.round(totalPagoDe(outras) * 100));
  return (atalho === 'tudo' ? restante : Math.floor(restante / 2)) / 100;
}

/** Pílula do produto: a categoria cadastrada (null = sem pílula). */
export function categoriaDoProduto(produto: ProdutoResponse): string | null {
  return produto.categoria || null;
}

export function categoriasDe(produtos: readonly ProdutoResponse[]): string[] {
  return [...new Set(produtos.map(categoriaDoProduto).filter((c): c is string => !!c))].sort(
    (a, b) => a.localeCompare(b, 'pt-BR'),
  );
}

/** `categoria` null = "Todas". */
export function filtrarPorCategoria<L extends { readonly produto: ProdutoResponse }>(
  linhas: readonly L[],
  categoria: string | null,
): readonly L[] {
  return categoria === null
    ? linhas
    : linhas.filter((l) => categoriaDoProduto(l.produto) === categoria);
}

// Casco e sucata só vão para os tipos de casco do carrinho (cascosParaRequest).
export function paraCreateVendaRequest(
  rascunho: RascunhoVenda,
  tiposCasco: readonly TipoCascoResponse[],
): CreateVendaRequest {
  const tipos = tiposCascoDoCarrinho(rascunho.itens, tiposCasco);
  return {
    clienteId: rascunho.clienteId,
    funcionarioId: rascunho.funcionarioId,
    enderecoEntregaId: rascunho.enderecoEntregaId,
    itens: rascunho.itens.map(paraItemRequest),
    pagamentos: rascunho.pagamentos
      .filter((p) => p.valor !== null && p.valor > 0)
      .map((p) => ({ forma: p.forma as FormaPagamento, valor: p.valor as number })),
    ...cascosParaRequest(
      tipos,
      rascunho.cascosNaHora,
      rascunho.cascosDevolvidos,
      rascunho.sucataEntregue,
    ),
    observacao: null,
  };
}

// Pré-carga da edição: venda já gravada → rascunho do PDV. O vendedor original é mantido.
export function rascunhoDeVenda(
  venda: VendaDetalheResponse,
  produtos: ReadonlyMap<string, ProdutoResponse>,
  tiposCasco: readonly TipoCascoResponse[],
): RascunhoVenda {
  const porTipo = (lista: readonly CascoPorTipoRequest[]): QuantidadesPorTipo =>
    Object.fromEntries(lista.map((c) => [c.tipoCascoId, c.quantidade]));
  return {
    clienteId: venda.clienteId,
    funcionarioId: venda.funcionarioId,
    enderecoEntregaId: venda.enderecoEntregaId,
    itens: venda.itens.map((i) => {
      const produto = produtos.get(i.produtoId) as ProdutoResponse;
      const marca = produto.marcas.find((m) => m.marcaId === i.marcaId);
      if (!marca) {
        throw new Error(`Marca ${i.marcaId} da venda não existe mais no produto ${produto.nome}.`);
      }
      return {
        produto,
        marca,
        quantidade: i.quantidade,
        precoUnitario: i.precoUnitario,
        desconto:
          i.descontoTipo === null
            ? null
            : { tipo: i.descontoTipo, valor: i.descontoValor ?? 0, motivo: i.motivoDesconto ?? '' },
        pagouVasilhame: i.pagouVasilhame,
        precoVasilhame: i.pagouVasilhame ? i.precoVasilhame : precoVasilhameDe(marca, tiposCasco),
      };
    }),
    pagamentos: venda.pagamentos.map((p) => ({ forma: p.forma, valor: p.valor })),
    cascosDevolvidos: porTipo(venda.cascosDevolvidos ?? []),
    cascosNaHora: false,
    sucataEntregue: porTipo(venda.sucataEntregue ?? []),
  };
}

export interface UltimaVendaCarregada {
  readonly itens: readonly ItemCarrinho[];
  /** Itens da venda antiga cujo produto ou marca não está mais no catálogo. */
  readonly pulados: number;
}

/**
 * Repetir última venda: itens e quantidades da venda antiga ao preço de referência de HOJE
 * (Regra 8.3: preço é sugestão). Desconto, pagamentos, cascos e sucata não são copiados.
 */
export function itensDaUltimaVenda(
  venda: VendaDetalheResponse,
  produtos: ReadonlyMap<string, ProdutoResponse>,
  tiposCasco: readonly TipoCascoResponse[],
): UltimaVendaCarregada {
  const itens: ItemCarrinho[] = [];
  for (const i of venda.itens) {
    const produto = produtos.get(i.produtoId);
    const marca = produto?.marcas.find((m) => m.marcaId === i.marcaId);
    if (produto && marca) {
      itens.push({
        ...itemNovo(produto, marca, i.quantidade, tiposCasco),
        pagouVasilhame: i.pagouVasilhame,
      });
    }
  }
  return { itens, pulados: venda.itens.length - itens.length };
}
