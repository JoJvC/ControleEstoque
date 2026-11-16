import { Signal, WritableSignal, computed } from '@angular/core';

import { SaldosResponse } from '../../core/api/models/clientes';
import { TipoCascoResponse } from '../../core/api/models/estoque';
import { VendaDetalheResponse } from '../../core/api/models/vendas';
import { PagamentoEdicao } from '../../ui/organisms/pagamento-lista';
import {
  ItemCarrinho,
  VasilhameCarrinho,
  abatidaDe,
  totaisDe,
  totalVasilhameDe,
  totalVasilhamesDe,
  valorDoAtalho,
  vasilhameNovo,
  vasilhamesPorTipo,
} from './carrinho';
import {
  QuantidadesPorTipo,
  descontoSucataDe,
  previaCascoDoTipo,
  quantidadeDevolvida,
  sucataExcede,
  tiposCascoDoCarrinho,
} from './cascos-por-tipo';
import { CascoTipoEstado, CobrarAcao, CobrarEstado, VasilhameEstado } from './cobrar-estado';
import { creditoNaEdicao, limitarPagamentos } from './pagamento-credito';

// Uma forma já escolhida, sem valor (protótipo): "Tudo fiado" a limpa e a venda sem valor vai toda para fiado.
export const PAGAMENTO_PADRAO: readonly PagamentoEdicao[] = [{ forma: 'DINHEIRO', valor: null }];

/** Os signals do rascunho: quem monta a cobrança (venda ou conclusão de pedido) é dono deles. */
export interface RascunhoCobranca {
  readonly itens: Signal<readonly ItemCarrinho[]>;
  readonly vasilhames: WritableSignal<readonly VasilhameCarrinho[]>;
  // Casco e sucata por tipo de casco (chave = tipoCascoId); com 'na hora' o devolvido vem do carrinho.
  readonly cascosDevolvidos: WritableSignal<QuantidadesPorTipo>;
  readonly cascosNaHora: WritableSignal<boolean>;
  readonly sucataEntregue: WritableSignal<QuantidadesPorTipo>;
  readonly sucataValores: WritableSignal<QuantidadesPorTipo>;
  readonly pagamentos: WritableSignal<readonly PagamentoEdicao[]>;
  readonly tiposCasco: Signal<readonly TipoCascoResponse[]>;
  readonly saldos: Signal<SaldosResponse | null>;
}

/** O que é próprio de cada modo (venda nova, edição, conclusão de pedido). */
export interface ModoCobranca {
  /** Edição: o saldo já inclui a venda original, então só o casco desta venda entra na prévia. */
  readonly edicao: () => boolean;
  /** Edição: crédito de galão por tipo conhecido pelo detalhe (o que o servidor abateu). */
  readonly creditoEdicao: () => QuantidadesPorTipo;
  readonly vendaCarregada: () => VendaDetalheResponse | null;
  readonly rotuloConfirmar: () => string;
  /** Cliente escolhido e, havendo mais de um endereço, o de entrega também. */
  readonly enderecoOk: () => boolean;
  readonly nomeDoCliente: () => string;
  readonly erro: () => string | null;
  readonly enviando: () => boolean;
}

/**
 * O CobrarEstado e as ações do painel de cobrança (cascos e pagamento), sem DI. Só o 'registrar'
 * fica com a página, porque cada modo grava de um jeito.
 */
export function criarCobranca(r: RascunhoCobranca, modo: ModoCobranca) {
  const carrinhoVazio = computed(() => r.itens().length === 0 && r.vasilhames().length === 0);

  // Feedback ao vivo (Regra 8.6): em venda nova com saldo carregado, o saldo do cliente por tipo entra
  // na conta; na edição o saldo já inclui a venda original, então só conta o casco desta venda.
  const saldoBaseDeCascos = computed(() =>
    modo.edicao() ? null : (r.saldos()?.cascosPorTipo ?? null),
  );
  const tiposDoCarrinho = computed(() =>
    tiposCascoDoCarrinho(r.itens(), r.tiposCasco(), vasilhamesPorTipo(r.vasilhames())),
  );
  // Crédito de galão por tipo = max(0, −saldo); na edição o saldo não é carregado.
  const creditosVasilhame = computed<QuantidadesPorTipo>(() => {
    const base = saldoBaseDeCascos();
    return base === null
      ? modo.creditoEdicao()
      : Object.fromEntries(base.map((c) => [c.tipoCascoId, Math.max(0, -c.saldo)]));
  });
  // Uma linha por tipo de casco do carrinho (retornáveis e vasilhames já lançados); sem lançamento, começa em 0.
  const vasilhamesEstado = computed<VasilhameEstado[]>(() => {
    const creditos = creditosVasilhame();
    const lancados = r.vasilhames();
    const ids = new Set([
      ...tiposDoCarrinho().map((t) => t.tipoCascoId),
      ...lancados.map((v) => v.tipoCascoId),
    ]);
    const linhas: VasilhameEstado[] = [];
    for (const tipo of r.tiposCasco().filter((t) => ids.has(t.id))) {
      const v = lancados.find((l) => l.tipoCascoId === tipo.id) ?? vasilhameNovo(tipo, 0);
      const credito = creditos[tipo.id] ?? 0;
      linhas.push({
        ...v,
        nome: tipo.nome,
        abatida: abatidaDe(v, credito),
        total: totalVasilhameDe(v, credito),
        escolhaModo: credito > 0 || v.modo === 'COMPRAR',
      });
    }
    return linhas;
  });
  const totalVasilhames = computed(() => totalVasilhamesDe(r.vasilhames(), creditosVasilhame()));
  const descontoSucata = computed(() =>
    descontoSucataDe(tiposDoCarrinho(), r.sucataEntregue(), r.sucataValores()),
  );
  const totais = computed(() => totaisDe(r.itens(), totalVasilhames(), descontoSucata()));
  const sucataPassaDoTotal = computed(() =>
    sucataExcede(descontoSucata(), totais().liquido + descontoSucata()),
  );
  const cascos = computed<CascoTipoEstado[]>(() => {
    const base = saldoBaseDeCascos();
    return tiposDoCarrinho().map((tipo) => {
      const { valor, travado } = quantidadeDevolvida(
        tipo,
        r.cascosNaHora(),
        r.cascosDevolvidos()[tipo.tipoCascoId] ?? 0,
      );
      const saldo = base?.find((c) => c.tipoCascoId === tipo.tipoCascoId)?.saldo ?? 0;
      // Na edição o saldo não é carregado: o abatido já está no saldo gravado, não entra na prévia.
      const abatidos =
        base === null
          ? 0
          : (vasilhamesEstado().find((v) => v.tipoCascoId === tipo.tipoCascoId)?.abatida ?? 0);
      const { naRua, aMais } = previaCascoDoTipo(saldo, tipo.vendidosEmTroca, valor, abatidos);
      return {
        ...tipo,
        devolvidos: valor,
        travado,
        sucata: r.sucataEntregue()[tipo.tipoCascoId] ?? 0,
        valorSucata: r.sucataValores()[tipo.tipoCascoId] ?? 0,
        naRua,
        aMais,
      };
    });
  });

  // Crédito para pagar a venda: o disponível do servidor; na edição, o que o servidor devolveria
  // com os lançamentos da própria venda estornados (usa o saldo, não o disponível, que já é ≥ 0).
  const creditoDisponivel = computed(() => {
    const saldos = r.saldos();
    if (saldos === null) {
      return null;
    }
    const original = modo.vendaCarregada();
    return original === null ? saldos.creditoDisponivel : creditoNaEdicao(saldos.saldo, original);
  });

  const podeRegistrar = computed(
    () => modo.enderecoOk() && !carrinhoVazio() && !sucataPassaDoTotal(),
  );

  const estado = computed<CobrarEstado>(() => ({
    itens: r.itens(),
    totais: totais(),
    vasilhames: vasilhamesEstado(),
    totalVasilhames: totalVasilhames(),
    descontoSucata: descontoSucata(),
    sucataExcede: sucataPassaDoTotal(),
    cascos: cascos(),
    cascosNaHora: r.cascosNaHora(),
    clienteNome: saldoBaseDeCascos() === null ? null : modo.nomeDoCliente(),
    pagamentos: r.pagamentos(),
    creditoDisponivel: creditoDisponivel(),
    nomeDoCliente: modo.nomeDoCliente(),
    erro: modo.erro(),
    enviando: modo.enviando(),
    podeRegistrar: podeRegistrar(),
    rotuloConfirmar: modo.rotuloConfirmar(),
  }));

  function alterarVasilhame(
    tipoCascoId: string,
    mudanca: Partial<Pick<VasilhameCarrinho, 'quantidade' | 'precoUnitario' | 'modo'>>,
  ): void {
    const quantidade = mudanca.quantidade;
    const tipo = r.tiposCasco().find((t) => t.id === tipoCascoId);
    const lancado = r.vasilhames().find((v) => v.tipoCascoId === tipoCascoId)?.quantidade ?? 0;
    if (lancado === 0 && tipo && quantidade && quantidade > 0) {
      r.vasilhames.update((atual) => [
        ...atual,
        { ...vasilhameNovo(tipo, quantidade), ...mudanca },
      ]);
      return;
    }
    r.vasilhames.update((atual) =>
      mudanca.quantidade !== undefined && mudanca.quantidade <= 0
        ? atual.filter((v) => v.tipoCascoId !== tipoCascoId)
        : atual.map((v) => (v.tipoCascoId === tipoCascoId ? { ...v, ...mudanca } : v)),
    );
  }

  function alternarNaHora(ligado: boolean): void {
    // Marcado, o devolvido de cada tipo é o vendido em troca (travado); ao desmarcar, o campo
    // fica editável a partir do valor que tinha.
    if (!ligado && r.cascosNaHora()) {
      r.cascosDevolvidos.set(
        Object.fromEntries(cascos().map((c) => [c.tipoCascoId, c.devolvidos])),
      );
    }
    r.cascosNaHora.set(ligado);
  }

  function aplicarAtalho({ indice, qual }: { indice: number; qual: 'tudo' | 'metade' }): void {
    const valor = valorDoAtalho(qual, totais().liquido, r.pagamentos(), indice);
    r.pagamentos.update((atual) =>
      limitarPagamentos(
        indice < atual.length
          ? atual.map((p, i) => (i === indice ? { ...p, valor } : p))
          : [...atual, { forma: 'DINHEIRO', valor }],
        creditoDisponivel(),
        totais().liquido,
      ),
    );
  }

  /** Toda ação do painel, menos 'registrar': gravar é da página. */
  function agir(acao: CobrarAcao): void {
    switch (acao.tipo) {
      case 'cascos':
        r.cascosDevolvidos.update((m) => ({ ...m, [acao.tipoCascoId]: acao.valor }));
        break;
      case 'naHora':
        alternarNaHora(acao.valor);
        break;
      case 'sucata':
        r.sucataEntregue.update((m) => ({ ...m, [acao.tipoCascoId]: acao.valor }));
        break;
      case 'sucataValor':
        r.sucataValores.update((m) => ({ ...m, [acao.tipoCascoId]: acao.valor }));
        break;
      case 'vasilhame':
        alterarVasilhame(acao.tipoCascoId, acao.mudanca);
        break;
      case 'pagamentos':
        r.pagamentos.set(limitarPagamentos(acao.valor, creditoDisponivel(), totais().liquido));
        break;
      case 'atalho':
        aplicarAtalho(acao);
        break;
      case 'tudoFiado':
        r.pagamentos.set([]);
        break;
      case 'registrar':
        break;
    }
  }

  return {
    carrinhoVazio,
    totais,
    sucataPassaDoTotal,
    creditoDisponivel,
    podeRegistrar,
    estado,
    alterarVasilhame,
    agir,
  };
}
