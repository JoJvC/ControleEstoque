import { GalaoPerda, MotivoPerda, OcorrenciaPerdaRequest } from '../../core/api/models/pedidos';

/** O backend usa os funcionários do pedido como responsáveis (RESPONSAVEL_OBRIGATORIO sem eles). */
export const MENSAGEM_SEM_RESPONSAVEL = 'O pedido não tem funcionários para responder pela perda.';

/** Uma linha do passo de perdas; produto+marca valem para CHEIO e o tipo de casco para VAZIO. */
export interface Ocorrencia {
  readonly galao: GalaoPerda;
  readonly produtoId: string | null;
  readonly marcaId: string | null;
  readonly tipoCascoId: string | null;
  readonly quantidade: number;
  readonly motivo: MotivoPerda;
}

export const ocorrenciaNova = (): Ocorrencia => ({
  galao: 'CHEIO',
  produtoId: null,
  marcaId: null,
  tipoCascoId: null,
  quantidade: 1,
  motivo: 'QUEBRADO',
});

/** As mesmas validações do servidor (PedidoService.RegistrarPerdasAsync) para o Confirmar não ir à toa. */
export function ocorrenciaCompleta(o: Ocorrencia): boolean {
  if (!Number.isInteger(o.quantidade) || o.quantidade < 1) {
    return false;
  }
  return o.galao === 'CHEIO' ? Boolean(o.produtoId && o.marcaId) : Boolean(o.tipoCascoId);
}

/** Sem ocorrência não há o que validar; com ocorrência, o servidor usa os funcionários do pedido como responsáveis. */
export function perdasProntas(ocorrencias: readonly Ocorrencia[], funcionarios: number): boolean {
  return ocorrencias.length === 0 || (funcionarios > 0 && ocorrencias.every(ocorrenciaCompleta));
}

/** CHEIO não manda tipo de casco (o servidor resolve) e VAZIO não manda produto nem marca. */
export function paraOcorrenciaRequest(o: Ocorrencia): OcorrenciaPerdaRequest {
  const cheio = o.galao === 'CHEIO';
  return {
    galao: o.galao,
    produtoId: cheio ? o.produtoId : null,
    marcaId: cheio ? o.marcaId : null,
    tipoCascoId: cheio ? null : o.tipoCascoId,
    quantidade: o.quantidade,
    motivo: o.motivo,
  };
}
