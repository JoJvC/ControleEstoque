import { PagamentoEdicao } from '../../ui/organisms/pagamento-lista';
import { ItemCarrinho, TotaisCarrinho, VasilhameCarrinho } from './carrinho';
import { TipoCascoDoCarrinho } from './cascos-por-tipo';

/** Um tipo de casco do carrinho, com o que já foi lançado e o feedback de casco na rua. */
export interface CascoTipoEstado extends TipoCascoDoCarrinho {
  /** Valor efetivo: com 'na hora' é o vendido em troca; senão o digitado. */
  readonly devolvidos: number;
  readonly travado: boolean;
  readonly sucata: number;
  /** Desconto por unidade da sucata, em reais. */
  readonly valorSucata: number;
  readonly naRua: number;
  readonly aMais: number;
}

/** Uma linha do quadro 'Vasilhames comprados agora'. */
export interface VasilhameEstado extends VasilhameCarrinho {
  readonly nome: string;
  /** Vasilhames cobertos pelo crédito de galão e total cobrado da linha. */
  readonly abatida: number;
  readonly total: number;
  /** Só tipos com crédito (ou já em Comprar) mostram a escolha Abater/Comprar. */
  readonly escolhaModo: boolean;
}

/** Tudo o que o painel mostra; a página é dona do estado (rascunho, regras e API). */
export interface CobrarEstado {
  readonly itens: readonly ItemCarrinho[];
  /** Bruto com os vasilhames cobrados; desconto com o da sucata. */
  readonly totais: TotaisCarrinho;
  readonly vasilhames: readonly VasilhameEstado[];
  readonly totalVasilhames: number;
  readonly descontoSucata: number;
  /** O desconto da sucata passa do total da venda: o servidor recusaria. */
  readonly sucataExcede: boolean;
  /** Só os tipos de casco das linhas retornáveis do carrinho. */
  readonly cascos: readonly CascoTipoEstado[];
  readonly cascosNaHora: boolean;
  /** Primeiro nome do cliente; null quando o número de casco só conta o que vai nesta venda. */
  readonly clienteNome: string | null;
  readonly pagamentos: readonly PagamentoEdicao[];
  /** Crédito do cliente da venda; null sem cliente ou sem saldos carregados. */
  readonly creditoDisponivel: number | null;
  /** Nome do cliente da venda: a sobra do pagamento vira crédito dele. */
  readonly nomeDoCliente: string;
  readonly erro: string | null;
  readonly enviando: boolean;
  readonly podeRegistrar: boolean;
  readonly rotuloConfirmar: string;
}

export type CobrarAcao =
  | { readonly tipo: 'cascos'; readonly tipoCascoId: string; readonly valor: number }
  | { readonly tipo: 'naHora'; readonly valor: boolean }
  | { readonly tipo: 'sucata'; readonly tipoCascoId: string; readonly valor: number }
  | { readonly tipo: 'sucataValor'; readonly tipoCascoId: string; readonly valor: number }
  | {
      readonly tipo: 'vasilhame';
      readonly tipoCascoId: string;
      readonly mudanca: Partial<Pick<VasilhameCarrinho, 'quantidade' | 'precoUnitario' | 'modo'>>;
    }
  | { readonly tipo: 'pagamentos'; readonly valor: readonly PagamentoEdicao[] }
  | { readonly tipo: 'atalho'; readonly indice: number; readonly qual: 'tudo' | 'metade' }
  | { readonly tipo: 'tudoFiado' }
  | { readonly tipo: 'registrar' };
