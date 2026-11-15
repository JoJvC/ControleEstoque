import { CreateEnderecoRequest } from '../../core/api/models/clientes';

/** Endereço ainda local (cadastro novo) ou espelho de um salvo (edição: chave = id). */
export interface RascunhoEndereco extends CreateEnderecoRequest {
  readonly chave: string;
}

export type DadosEndereco = CreateEnderecoRequest;

// Invariante: lista não vazia => exatamente um principal.

function comUmPrincipal(lista: readonly RascunhoEndereco[], chave: string) {
  return lista.map((e) => ({ ...e, principal: e.chave === chave }));
}

/** Regra 1 (primeiro vira principal) e 2 (marcar desmarca o anterior). */
export function adicionar(
  lista: readonly RascunhoEndereco[],
  dados: DadosEndereco,
  chave: string,
): RascunhoEndereco[] {
  const novo = { ...dados, chave, principal: dados.principal || lista.length === 0 };
  const resultado = [...lista, novo];
  return novo.principal ? comUmPrincipal(resultado, chave) : resultado;
}

/** Regra 4: editar com principal=false no principal não desmarca. */
export function editar(
  lista: readonly RascunhoEndereco[],
  chave: string,
  dados: DadosEndereco,
): RascunhoEndereco[] {
  const atual = lista.find((e) => e.chave === chave);
  if (!atual) {
    return [...lista];
  }
  const principal = dados.principal || atual.principal;
  const resultado = lista.map((e) => (e.chave === chave ? { ...dados, chave, principal } : e));
  return principal ? comUmPrincipal(resultado, chave) : resultado;
}

/** Regra 3: remover o principal promove o mais antigo (primeiro da lista) dos que sobram. */
export function remover(lista: readonly RascunhoEndereco[], chave: string): RascunhoEndereco[] {
  const removido = lista.find((e) => e.chave === chave);
  const resto = lista.filter((e) => e.chave !== chave);
  return removido?.principal && resto.length > 0 ? comUmPrincipal(resto, resto[0].chave) : resto;
}

export function marcarPrincipal(
  lista: readonly RascunhoEndereco[],
  chave: string,
): RascunhoEndereco[] {
  return lista.some((e) => e.chave === chave) ? comUmPrincipal(lista, chave) : [...lista];
}

export function dadosDe(e: DadosEndereco): DadosEndereco {
  return {
    logradouro: e.logradouro,
    numero: e.numero,
    bairro: e.bairro,
    complemento: e.complemento,
    referencia: e.referencia,
    principal: e.principal,
  };
}
