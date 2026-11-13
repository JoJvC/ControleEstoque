/** Curinga do cargo ADM (seed em infra/postgres/init.sql). */
export const PERMISSAO_TODAS = '*';

export interface PermissaoCatalogo {
  readonly chave: string;
  readonly rotulo: string;
}

/**
 * Catálogo de permissões granulares (padrão `dominio.acao`, plano §9).
 * O backend não valida contra lista fixa: o catálogo é só do front.
 * Permissão nova entra aqui; o editor de cargos (F8b) lê desta lista.
 */
export const PERMISSOES: readonly PermissaoCatalogo[] = [
  { chave: 'vendas.registrar', rotulo: 'Registrar vendas' },
  { chave: 'vendas.editar', rotulo: 'Editar vendas' },
  { chave: 'caixa.fechar', rotulo: 'Fechar o caixa' },
  { chave: 'estoque.editar', rotulo: 'Editar estoque' },
  { chave: 'relatorios.ver', rotulo: 'Ver relatórios' },
  { chave: 'clientes.cadastrar', rotulo: 'Cadastrar clientes' },
  { chave: 'rh.gerir', rotulo: 'Gerir funcionários e cargos' },
];
