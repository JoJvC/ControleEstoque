import { BottomNavItem } from '../../ui/organisms/bottom-nav';

/** Item da navegação; `naMais` marca os que a página Mais (celular) também lista. */
export interface NavItem extends BottomNavItem {
  readonly naMais?: boolean;
}

/**
 * Configuração única da navegação: o shell (barra de baixo / menu lateral) e a página Mais
 * filtram esta lista pela permissão da rota de destino (a mesma chave do permissaoGuard).
 */
export const NAV_ITENS: readonly NavItem[] = [
  { path: '/home', label: 'Hoje', icone: 'home', onde: 'ambos' },
  { path: '/clientes', label: 'Clientes', icone: 'usuario', onde: 'ambos' },
  {
    path: '/vendas/nova',
    label: 'Vender',
    icone: 'gota',
    onde: 'ambos',
    destaque: true,
    permissao: 'vendas.registrar', // vendas-routes.ts:12
  },
  { path: '/estoque', label: 'Estoque', icone: 'caixa', onde: 'ambos', naMais: true },
  { path: '/mais', label: 'Mais', icone: 'menu', onde: 'celular' },
  {
    path: '/vendas',
    label: 'Histórico de vendas',
    icone: 'cupom',
    onde: 'desktop',
    exato: true,
    naMais: true,
  },
  {
    path: '/financeiro/caixa',
    label: 'Caixa do dia',
    icone: 'dinheiro',
    onde: 'desktop',
    naMais: true,
  },
  { path: '/pedidos', label: 'Pedidos', icone: 'pacote', onde: 'desktop', naMais: true },
  { path: '/produtos', label: 'Produtos', icone: 'pacote', onde: 'desktop', naMais: true },
  { path: '/marcas', label: 'Marcas', icone: 'etiqueta', onde: 'desktop', naMais: true },
  { path: '/tipos-casco', label: 'Tipos de casco', icone: 'casco', onde: 'desktop', naMais: true },
  {
    path: '/mais/aparencia',
    label: 'Aparência',
    icone: 'paleta',
    onde: 'desktop',
    naMais: true,
  },
  {
    path: '/rh',
    label: 'Funcionários e cargos',
    icone: 'rh',
    onde: 'desktop',
    naMais: true,
    permissao: 'rh.gerir', // rh-routes.ts:12,17,22
  },
  {
    path: '/relatorios',
    label: 'Relatórios',
    icone: 'grafico',
    onde: 'desktop',
    naMais: true,
    permissao: 'relatorios.ver', // relatorios-routes.ts:8
  },
];
