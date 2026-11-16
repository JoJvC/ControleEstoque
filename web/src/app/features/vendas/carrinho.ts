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
  ModoCreditoVasilhame,
  TipoDesconto,
  VasilhameRequest,
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
}

/** Vasilhame vendido, uma linha por tipo de casco (chave = tipoCascoId). */
export interface VasilhameCarrinho {
  readonly tipoCascoId: string;
  readonly quantidade: number;
  readonly precoUnitario: number;
  readonly modo: ModoCreditoVasilhame;
}

export const mesmoItem = (
  item: ItemCarrinho,
  produto: ProdutoResponse,
  marca: ProdutoMarcaResponse,
): boolean => item.produto.id === produto.id && item.marca.marcaId === marca.marcaId;

/** Linha nova no carrinho: preço sugerido = referência da marca. */
export function itemNovo(
  produto: ProdutoResponse,
  marca: ProdutoMarcaResponse,
  quantidade: number,
): ItemCarrinho {
  return { produto, marca, quantidade, precoUnitario: marca.precoReferencia, desconto: null };
}

/** Vasilhame novo: preço sugerido = `precoVasilhame` do tipo; o modo padrão é abater o crédito. */
export function vasilhameNovo(tipo: TipoCascoResponse, quantidade: number): VasilhameCarrinho {
  return {
    tipoCascoId: tipo.id,
    quantidade,
    precoUnitario: tipo.precoVasilhame,
    modo: 'ABATER_CREDITO',
  };
}

export function vasilhamesPorTipo(vasilhames: readonly VasilhameCarrinho[]): QuantidadesPorTipo {
  return Object.fromEntries(vasilhames.map((v) => [v.tipoCascoId, v.quantidade]));
}

/** Vasilhames cobertos pelo crédito de galão do tipo (`credito` = max(0, −saldo)); só em ABATER_CREDITO. */
export function abatidaDe(vasilhame: VasilhameCarrinho, credito: number): number {
  return vasilhame.modo === 'ABATER_CREDITO'
    ? Math.min(vasilhame.quantidade, Math.max(0, credito))
    : 0;
}

/** Espelho de VendaCalculos.CalcularVasilhame: (quantidade − abatida) × preço. */
export function totalVasilhameDe(vasilhame: VasilhameCarrinho, credito: number): number {
  const cobrada = vasilhame.quantidade - abatidaDe(vasilhame, credito);
  return Math.round(cobrada * vasilhame.precoUnitario * 100) / 100;
}

export function totalVasilhamesDe(
  vasilhames: readonly VasilhameCarrinho[],
  creditos: QuantidadesPorTipo,
): number {
  const centavos = vasilhames.reduce(
    (soma, v) => soma + Math.round(totalVasilhameDe(v, creditos[v.tipoCascoId] ?? 0) * 100),
    0,
  );
  return centavos / 100;
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
    marcaId: item.marca.marcaId,
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
  readonly vasilhames: readonly VasilhameCarrinho[];
  readonly pagamentos: readonly PagamentoEdicao[];
  readonly cascosDevolvidos: QuantidadesPorTipo;
  readonly cascosNaHora: boolean;
  readonly sucataEntregue: QuantidadesPorTipo;
  /** Desconto por unidade da sucata, por tipo (chave = tipoCascoId). */
  readonly sucataValores: QuantidadesPorTipo;
}

/** Rascunho da edição: o detalhe só traz o que o servidor abateu, não o crédito do cliente. */
export interface RascunhoEdicao extends RascunhoVenda {
  readonly creditoVasilhames: QuantidadesPorTipo;
}

// Dinheiro em reais com 2 casas: arredonda para não acumular erro de ponto flutuante.
const centavos = (valor: number): number => Math.round(valor * 100) / 100;

/** Como o backend: o bruto inclui os vasilhames cobrados e o desconto inclui o da sucata. */
export function totaisDe(
  itens: readonly ItemCarrinho[],
  vasilhames = 0,
  descontoSucata = 0,
): TotaisCarrinho {
  const bruto = centavos(itens.reduce((soma, i) => soma + brutoDe(i), 0) + vasilhames);
  const desconto = centavos(
    itens.reduce((soma, i) => soma + valorDescontoDe(i), 0) + descontoSucata,
  );
  return { bruto, desconto, liquido: centavos(bruto - desconto) };
}

export function totalPagoDe(pagamentos: readonly PagamentoEdicao[]): number {
  return centavos(pagamentos.reduce((soma, p) => soma + (p.valor ?? 0), 0));
}

export function fiadoDe(liquido: number, pagamentos: readonly PagamentoEdicao[]): number {
  return Math.max(0, centavos(liquido - totalPagoDe(pagamentos)));
}

export interface SituacaoPagamento {
  readonly tipo: 'fiado' | 'pago' | 'credito';
  readonly valor: number;
}

/** Pago < líquido: fiado; pago = líquido (> 0): pago; pago > líquido: a sobra vira crédito do cliente. */
export function situacaoPagamento(
  liquido: number,
  pagamentos: readonly PagamentoEdicao[],
): SituacaoPagamento {
  const pago = totalPagoDe(pagamentos);
  if (pago > liquido) {
    return { tipo: 'credito', valor: centavos(pago - liquido) };
  }
  if (pago < liquido) {
    return { tipo: 'fiado', valor: fiadoDe(liquido, pagamentos) };
  }
  return { tipo: 'pago', valor: 0 };
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

export function paraVasilhameRequest(vasilhame: VasilhameCarrinho): VasilhameRequest {
  return {
    tipoCascoId: vasilhame.tipoCascoId,
    quantidade: vasilhame.quantidade,
    precoUnitario: vasilhame.precoUnitario,
    modoCredito: vasilhame.modo,
  };
}

// Casco e sucata só vão para os tipos de casco do carrinho (cascosParaRequest).
export function paraCreateVendaRequest(
  rascunho: RascunhoVenda,
  tiposCasco: readonly TipoCascoResponse[],
): CreateVendaRequest {
  const tipos = tiposCascoDoCarrinho(
    rascunho.itens,
    tiposCasco,
    vasilhamesPorTipo(rascunho.vasilhames),
  );
  return {
    clienteId: rascunho.clienteId,
    funcionarioId: rascunho.funcionarioId,
    enderecoEntregaId: rascunho.enderecoEntregaId,
    itens: rascunho.itens.map(paraItemRequest),
    vasilhames: rascunho.vasilhames.filter((v) => v.quantidade > 0).map(paraVasilhameRequest),
    pagamentos: rascunho.pagamentos
      .filter((p) => p.valor !== null && p.valor > 0)
      .map((p) => ({ forma: p.forma as FormaPagamento, valor: p.valor as number })),
    ...cascosParaRequest(
      tipos,
      rascunho.cascosNaHora,
      rascunho.cascosDevolvidos,
      rascunho.sucataEntregue,
      rascunho.sucataValores,
    ),
    observacao: null,
  };
}

// Pré-carga da edição: venda já gravada → rascunho do PDV. O vendedor original é mantido.
export function rascunhoDeVenda(
  venda: VendaDetalheResponse,
  produtos: ReadonlyMap<string, ProdutoResponse>,
): RascunhoEdicao {
  const porTipo = (lista: readonly CascoPorTipoRequest[]): QuantidadesPorTipo =>
    Object.fromEntries(lista.map((c) => [c.tipoCascoId, c.quantidade]));
  const vasilhames = venda.vasilhames ?? [];
  const sucata = venda.sucataEntregue ?? [];
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
      };
    }),
    vasilhames: vasilhames.map((v) => ({
      tipoCascoId: v.tipoCascoId,
      quantidade: v.quantidade,
      precoUnitario: v.precoUnitario,
      modo: v.modo,
    })),
    // ponytail: sem o saldo na edição, o crédito conhecido é o que o servidor abateu; teto: prévia do
    // total subestima o abate se o operador aumenta a quantidade ou troca Comprar por Abater.
    creditoVasilhames: Object.fromEntries(
      vasilhames.map((v) => [v.tipoCascoId, v.quantidadeAbatida]),
    ),
    pagamentos: venda.pagamentos.map((p) => ({ forma: p.forma, valor: p.valor })),
    cascosDevolvidos: porTipo(venda.cascosDevolvidos ?? []),
    cascosNaHora: false,
    sucataEntregue: porTipo(sucata),
    sucataValores: Object.fromEntries(sucata.map((c) => [c.tipoCascoId, c.valorUnitario])),
  };
}

export interface UltimaVendaCarregada {
  readonly itens: readonly ItemCarrinho[];
  readonly vasilhames: readonly VasilhameCarrinho[];
  /** Itens e vasilhames da venda antiga cujo produto, marca ou tipo de casco não está mais no catálogo. */
  readonly pulados: number;
}

/**
 * Repetir última venda: itens e quantidades da venda antiga ao preço de referência de HOJE
 * (Regra 8.3: preço é sugestão). Os vasilhames vêm com tipo, quantidade e preço da venda antiga e o modo
 * padrão (abater o crédito). Desconto, pagamentos, cascos e sucata não são copiados.
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
      itens.push(itemNovo(produto, marca, i.quantidade));
    }
  }
  const vasilhames: VasilhameCarrinho[] = [];
  for (const v of venda.vasilhames ?? []) {
    if (tiposCasco.some((t) => t.id === v.tipoCascoId)) {
      vasilhames.push({
        tipoCascoId: v.tipoCascoId,
        quantidade: v.quantidade,
        precoUnitario: v.precoUnitario,
        modo: 'ABATER_CREDITO',
      });
    }
  }
  const pulados =
    venda.itens.length - itens.length + ((venda.vasilhames ?? []).length - vasilhames.length);
  return { itens, vasilhames, pulados };
}
