import { firstValueFrom } from 'rxjs';

import { ClientesApi } from '../../core/api/clientes-api';
import {
  ClienteResponse,
  CreateClienteRequest,
  EnderecoResponse,
} from '../../core/api/models/clientes';
import { RascunhoEndereco, dadosDe } from './enderecos-regras';

export type ApiEnderecos = Pick<ClientesApi, 'criar' | 'adicionarEndereco'>;

export interface ResultadoEnderecos {
  salvos: EnderecoResponse[];
  falhos: RascunhoEndereco[];
}

/** POST de cada rascunho em sequência; uma falha não interrompe os demais. */
export async function enviarEnderecos(
  api: Pick<ClientesApi, 'adicionarEndereco'>,
  clienteId: string,
  rascunhos: readonly RascunhoEndereco[],
): Promise<ResultadoEnderecos> {
  const resultado: ResultadoEnderecos = { salvos: [], falhos: [] };
  for (const rascunho of rascunhos) {
    try {
      resultado.salvos.push(
        await firstValueFrom(api.adicionarEndereco(clienteId, dadosDe(rascunho))),
      );
    } catch {
      resultado.falhos.push(rascunho);
    }
  }
  return resultado;
}

/** Cria o cliente e depois os endereços. Se criar o cliente falhar, o erro sobe e nada é postado. */
export async function salvarClienteComEnderecos(
  api: ApiEnderecos,
  request: CreateClienteRequest,
  rascunhos: readonly RascunhoEndereco[],
): Promise<ResultadoEnderecos & { cliente: ClienteResponse }> {
  const cliente = await firstValueFrom(api.criar(request));
  return { cliente, ...(await enviarEnderecos(api, cliente.id, rascunhos)) };
}
