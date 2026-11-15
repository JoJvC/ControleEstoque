import { resolverTema } from '../theme/theme-store';
import { razaoContraste } from './contraste';

// Hex copiados de web/src/styles/tokens.scss (linha entre parênteses), uma paleta por tema.
// Mudou o token? Atualize aqui: o spec é a trava de contraste do design system.
// Oceano é o bloco `:root, [data-tema="oceano"]`.
const TEMAS = {
  oceano: {
    primary: '#08769c', // tokens.scss:7
    primaryStrong: '#062a3f', // tokens.scss:8
    primarySoft: '#e3f3f8', // tokens.scss:9
    success: '#15803d', // tokens.scss:10
    successSoft: '#dcfce7', // tokens.scss:11
    warning: '#b45309', // tokens.scss:12
    warningSoft: '#fef3c7', // tokens.scss:13
    danger: '#b91c1c', // tokens.scss:14
    dangerSoft: '#fee2e2', // tokens.scss:15
    bg: '#f2f8fa', // tokens.scss:16
    surface: '#ffffff', // tokens.scss:17
    surfaceMuted: '#f2f8fa', // tokens.scss:18
    text: '#0b2533', // tokens.scss:19
    textMuted: '#4b6170', // tokens.scss:20
    textOnPrimary: '#ffffff', // tokens.scss:21
    border: '#e1ecf0', // tokens.scss:22
    focusRing: '#08769c', // tokens.scss:23
    topo: '#062a3f', // tokens.scss:24
    topoCartao: '#0e3a55', // tokens.scss:25
    textoSobreTopo: '#ffffff', // tokens.scss:26
    destaque: '#4cc9e8', // tokens.scss:27
    acaoTexto: '#08769c', // tokens.scss:28
    bordaCampo: '#7a909d', // tokens.scss:29
    casco: '#0b6e63', // tokens.scss:30
    cascoSoft: '#ddf2ee', // tokens.scss:31
    sucata: '#5b6472', // tokens.scss:32
    sucataSoft: '#eceef1', // tokens.scss:33
    fiado: '#c2410c', // tokens.scss:34
    fiadoSoft: '#ffede3', // tokens.scss:35
    pago: '#15803d', // tokens.scss:36
    pagoSoft: '#e3f5ea', // tokens.scss:37
    agua: '#08769c', // tokens.scss:38
    aguaSoft: '#e3f3f8', // tokens.scss:39
    aguaNivel: '#4cc9e8', // tokens.scss:40
  },
  uva: {
    primary: '#6d28d9', // tokens.scss:86
    primaryStrong: '#2e1065', // tokens.scss:87
    primarySoft: '#ede9fe', // tokens.scss:88
    success: '#15803d', // tokens.scss:89
    successSoft: '#dcfce7', // tokens.scss:90
    warning: '#b45309', // tokens.scss:91
    warningSoft: '#fef3c7', // tokens.scss:92
    danger: '#b91c1c', // tokens.scss:93
    dangerSoft: '#fee2e2', // tokens.scss:94
    bg: '#f6f5fb', // tokens.scss:95
    surface: '#ffffff', // tokens.scss:96
    surfaceMuted: '#f6f5fb', // tokens.scss:97
    text: '#1e1537', // tokens.scss:98
    textMuted: '#5b5570', // tokens.scss:99
    textOnPrimary: '#ffffff', // tokens.scss:100
    border: '#e7e4f0', // tokens.scss:101
    focusRing: '#6d28d9', // tokens.scss:102
    topo: '#2e1065', // tokens.scss:103
    topoCartao: '#43198f', // tokens.scss:104
    textoSobreTopo: '#ffffff', // tokens.scss:105
    destaque: '#c4b5fd', // tokens.scss:106
    acaoTexto: '#6d28d9', // tokens.scss:107
    bordaCampo: '#8a80a3', // tokens.scss:108
    casco: '#0b6e63', // tokens.scss:109
    cascoSoft: '#ddf2ee', // tokens.scss:110
    sucata: '#5b6472', // tokens.scss:111
    sucataSoft: '#eceef1', // tokens.scss:112
    fiado: '#c2410c', // tokens.scss:113
    fiadoSoft: '#ffede3', // tokens.scss:114
    pago: '#15803d', // tokens.scss:115
    pagoSoft: '#e3f5ea', // tokens.scss:116
    agua: '#08769c', // tokens.scss:117
    aguaSoft: '#e3f3f8', // tokens.scss:118
    aguaNivel: '#4cc9e8', // tokens.scss:119
  },
  carvao: {
    primary: '#2f3338', // tokens.scss:124
    primaryStrong: '#1f2226', // tokens.scss:125
    primarySoft: '#ecedef', // tokens.scss:126
    success: '#15803d', // tokens.scss:127
    successSoft: '#dcfce7', // tokens.scss:128
    warning: '#b45309', // tokens.scss:129
    warningSoft: '#fef3c7', // tokens.scss:130
    danger: '#b91c1c', // tokens.scss:131
    dangerSoft: '#fee2e2', // tokens.scss:132
    bg: '#f4f4f2', // tokens.scss:133
    surface: '#ffffff', // tokens.scss:134
    surfaceMuted: '#f4f4f2', // tokens.scss:135
    text: '#1a1c1f', // tokens.scss:136
    textMuted: '#575c63', // tokens.scss:137
    textOnPrimary: '#ffffff', // tokens.scss:138
    border: '#e4e4e1', // tokens.scss:139
    focusRing: '#2f3338', // tokens.scss:140
    topo: '#1f2226', // tokens.scss:141
    topoCartao: '#33373d', // tokens.scss:142
    textoSobreTopo: '#ffffff', // tokens.scss:143
    destaque: '#f5b942', // tokens.scss:144
    acaoTexto: '#2f3338', // tokens.scss:145
    bordaCampo: '#868782', // tokens.scss:146
    casco: '#0b6e63', // tokens.scss:147
    cascoSoft: '#ddf2ee', // tokens.scss:148
    sucata: '#5b6472', // tokens.scss:149
    sucataSoft: '#eceef1', // tokens.scss:150
    fiado: '#c2410c', // tokens.scss:151
    fiadoSoft: '#ffede3', // tokens.scss:152
    pago: '#15803d', // tokens.scss:153
    pagoSoft: '#e3f5ea', // tokens.scss:154
    agua: '#08769c', // tokens.scss:155
    aguaSoft: '#e3f3f8', // tokens.scss:156
    aguaNivel: '#4cc9e8', // tokens.scss:157
  },
  noite: {
    primary: '#4cc9e8', // tokens.scss:162
    primaryStrong: '#7dd8ee', // tokens.scss:163
    primarySoft: '#0e2a3b', // tokens.scss:164
    success: '#4ade80', // tokens.scss:165
    successSoft: '#0f2e1c', // tokens.scss:166
    warning: '#fb923c', // tokens.scss:167
    warningSoft: '#3a1f10', // tokens.scss:168
    danger: '#f87171', // tokens.scss:169
    dangerSoft: '#3b1518', // tokens.scss:170
    bg: '#07141c', // tokens.scss:171
    surface: '#0e2230', // tokens.scss:172
    surfaceMuted: '#07141c', // tokens.scss:173
    text: '#e6f2f6', // tokens.scss:174
    textMuted: '#9db5c2', // tokens.scss:175
    textOnPrimary: '#03202c', // tokens.scss:176
    border: '#1d3a4c', // tokens.scss:177
    focusRing: '#4cc9e8', // tokens.scss:178
    topo: '#050e15', // tokens.scss:179
    topoCartao: '#0e2a3b', // tokens.scss:180
    textoSobreTopo: '#e6f2f6', // tokens.scss:181
    destaque: '#4cc9e8', // tokens.scss:182
    acaoTexto: '#7dd8ee', // tokens.scss:183
    bordaCampo: '#5a7b90', // tokens.scss:184
    casco: '#4fd1be', // tokens.scss:185
    cascoSoft: '#0d3a35', // tokens.scss:186
    sucata: '#aab3bf', // tokens.scss:187
    sucataSoft: '#232c36', // tokens.scss:188
    fiado: '#fb923c', // tokens.scss:189
    fiadoSoft: '#3a1f10', // tokens.scss:190
    pago: '#4ade80', // tokens.scss:191
    pagoSoft: '#0f2e1c', // tokens.scss:192
    agua: '#4cc9e8', // tokens.scss:193
    aguaSoft: '#0e2a3b', // tokens.scss:194
    aguaNivel: '#4cc9e8', // tokens.scss:195
  },
};

type Paleta = (typeof TEMAS)['oceano'];
type Chave = keyof Paleta;

const TEXTO = 4.5; // WCAG 1.4.3
const NAO_TEXTUAL = 3; // WCAG 1.4.11 (também texto ≥ 24 px, §3 de DESIGN.md)

// [frente, fundo, limiar, onde ocorre]
const PARES: [Chave, Chave, number, string][] = [
  ['text', 'bg', TEXTO, 'texto base sobre o fundo'],
  ['text', 'surface', TEXTO, 'texto em cards/sheets'],
  ['text', 'surfaceMuted', TEXTO, 'linhas alternadas'],
  ['textMuted', 'bg', TEXTO, 'metadados sobre o fundo'],
  ['textMuted', 'surface', TEXTO, 'metadados em cards'],
  ['textMuted', 'surfaceMuted', TEXTO, 'campos desabilitados (money-input, stepper)'],
  [
    'textOnPrimary',
    'primary',
    TEXTO,
    'button.ts:56-57, shell-layout.scss:22-23, bottom-nav.ts:74-75',
  ],
  ['textOnPrimary', 'primaryStrong', TEXTO, 'estado pressed/hover do primário'],
  ['primary', 'surface', TEXTO, 'button ghost (button.ts:62), stepper, links'],
  ['primary', 'bg', TEXTO, 'link cliente-detalhe-page.scss:7 sobre o fundo'],
  ['primaryStrong', 'primarySoft', TEXTO, 'badge, avatar, chips (badge.ts:26-27)'],
  ['danger', 'surface', TEXTO, 'mensagens de erro (form-field.ts:44)'],
  ['danger', 'dangerSoft', TEXTO, 'badge.ts:41-42'],
  ['success', 'surface', TEXTO, 'saldo-chip.ts:49'],
  ['success', 'successSoft', TEXTO, 'badge.ts:31-32'],
  ['warning', 'surface', TEXTO, 'saldo-chip.ts:53, item-venda-card.ts:82'],
  ['warning', 'warningSoft', TEXTO, 'badge.ts:36-37, caixa-page.ts:135-136'],
  ['textOnPrimary', 'danger', TEXTO, 'button danger (button.ts:67-68), toast-outlet.ts:64-65'],
  ['textOnPrimary', 'success', TEXTO, 'toast-outlet.ts:69-70'],
  // anel de foco: outline desenhado sobre o fundo do pai (reset.scss:60-62, offset 2px)
  ['focusRing', 'bg', NAO_TEXTUAL, 'anel de foco sobre o fundo da aplicação'],
  ['focusRing', 'surface', NAO_TEXTUAL, 'anel de foco sobre cards/sheets'],
  ['casco', 'bg', TEXTO, 'cor de função casco sobre bg'],
  ['casco', 'surface', TEXTO, 'cor de função casco sobre surface'],
  ['sucata', 'bg', TEXTO, 'cor de função sucata sobre bg'],
  ['sucata', 'surface', TEXTO, 'cor de função sucata sobre surface'],
  ['fiado', 'bg', TEXTO, 'cor de função fiado sobre bg'],
  ['fiado', 'surface', TEXTO, 'cor de função fiado sobre surface'],
  ['pago', 'bg', TEXTO, 'cor de função pago sobre bg'],
  ['pago', 'surface', TEXTO, 'cor de função pago sobre surface'],
  ['agua', 'bg', TEXTO, 'cor de função agua sobre bg'],
  ['agua', 'surface', TEXTO, 'cor de função agua sobre surface'],
  // campos (text-input, select, money-input, stepper)
  ['bordaCampo', 'surface', NAO_TEXTUAL, 'borda de campo sobre cartão'],
  ['bordaCampo', 'bg', NAO_TEXTUAL, 'borda de campo sobre o fundo'],
  // chips de função (chip.ts): texto --ce-text sobre o fundo suave; cor de função na borda/ícone
  ['text', 'cascoSoft', TEXTO, 'chip casco, texto'],
  ['text', 'sucataSoft', TEXTO, 'chip sucata, texto'],
  ['text', 'fiadoSoft', TEXTO, 'chip fiado, texto'],
  ['text', 'pagoSoft', TEXTO, 'chip pago, texto'],
  ['casco', 'cascoSoft', NAO_TEXTUAL, 'chip casco, borda/ícone'],
  ['sucata', 'sucataSoft', NAO_TEXTUAL, 'chip sucata, borda/ícone'],
  ['fiado', 'fiadoSoft', NAO_TEXTUAL, 'chip fiado, borda/ícone'],
  ['pago', 'pagoSoft', NAO_TEXTUAL, 'chip pago, borda/ícone'],
  // topo e menu lateral (shell-layout.scss, bottom-nav.ts, app-header.ts)
  ['textoSobreTopo', 'topo', TEXTO, 'cabeçalho do shell, menu lateral e topo com onda'],
  ['textoSobreTopo', 'topoCartao', TEXTO, 'item ativo do menu lateral'],
  // destaque de Vender: celular = círculo primary sobre surface; desktop = círculo destaque sobre topo
  ['primary', 'surface', NAO_TEXTUAL, 'Vender no celular: círculo sobre a barra'],
  ['topo', 'destaque', TEXTO, 'Vender no desktop: ícone sobre o círculo'],
  ['destaque', 'topo', NAO_TEXTUAL, 'Vender no desktop: círculo sobre o menu lateral'],
  // Caixa e Relatórios no design Depósito
  [
    'text',
    'surface',
    TEXTO,
    'valor do cartão de total (caixa-page.ts:.total dd, relatorio.scss:.total dd)',
  ],
  [
    'textMuted',
    'surface',
    TEXTO,
    'rótulo do cartão e cabeçalho da tabela (caixa-page.ts:.total dt, relatorio.scss:th)',
  ],
  [
    'text',
    'warningSoft',
    TEXTO,
    'texto do cartão Caixa fechado e do bloco de alerta 409 (caixa-page.ts:.alerta)',
  ],
  [
    'warning',
    'warningSoft',
    TEXTO,
    'título do alerta (caixa-page.ts:.alerta__titulo, despesa-sheet.ts:.alerta__titulo)',
  ],
];

const NOMES = Object.keys(TEMAS) as (keyof typeof TEMAS)[];
const CASOS = NOMES.flatMap((tema) => PARES.map((p) => [tema, ...p] as const));

describe('contraste dos tokens', () => {
  it.each(CASOS)('[%s] %s sobre %s ≥ %s (%s)', (tema, frente, fundo, limiar) => {
    const p: Paleta = TEMAS[tema];
    expect(razaoContraste(p[frente], p[fundo])).toBeGreaterThanOrEqual(limiar);
  });

  it('as 4 paletas têm as mesmas chaves', () => {
    const base = Object.keys(TEMAS.oceano).sort();
    for (const t of NOMES) expect(Object.keys(TEMAS[t]).sort()).toEqual(base);
  });
});

// RH no design Depósito: pares das telas de funcionários, edição com conta-corrente e cargos
// [frente, fundo, limiar, onde ocorre]
const PARES_RH: [Chave, Chave, number, string][] = [
  ['text', 'bg', TEXTO, 'título (ce-app-header sem onda) sobre o fundo da página'],
  ['textoSobreTopo', 'topo', TEXTO, 'ce-app-header com onda (app-header.ts:.topo--onda)'],
  ['text', 'surface', TEXTO, 'nome na linha, valores do extrato e título de cartão'],
  ['textMuted', 'surface', TEXTO, 'cargo · diária, observação do lançamento, carregando'],
  ['textMuted', 'bg', TEXTO, 'texto de apoio sobre o fundo da página'],
  [
    'textOnPrimary',
    'primary',
    TEXTO,
    'ce-button primário na ce-barra-acao (Novo funcionário/cargo, Salvar)',
  ],
  [
    'primary',
    'surface',
    TEXTO,
    'ce-button ghost (Cancelar, Lançar vale/pagamento) sobre a ce-barra-acao e cartões',
  ],
  ['acaoTexto', 'surface', TEXTO, 'rótulo Editar na linha de cargo (cargos-page.ts:.editar)'],
  ['success', 'successSoft', TEXTO, 'ce-badge Ativo (badge.ts:31-32)'],
  ['textMuted', 'surfaceMuted', TEXTO, 'ce-badge Inativo (badge.ts:46-47)'],
  ['primaryStrong', 'primarySoft', TEXTO, 'ce-badge nativo (badge.ts:26-27)'],
  ['warning', 'surface', TEXTO, 'ce-saldo-chip com saldo a pagar (saldo-chip.ts:53)'],
  ['success', 'surface', TEXTO, 'ce-saldo-chip com saldo zerado (saldo-chip.ts:49)'],
  ['danger', 'surface', TEXTO, 'p.erro e role=alert (borda e texto em --ce-danger)'],
  [
    'bordaCampo',
    'surface',
    NAO_TEXTUAL,
    'borda de campo (nome, telefone, valor, observação) sobre cartão',
  ],
  ['bordaCampo', 'bg', NAO_TEXTUAL, 'borda de campo sobre o fundo da página'],
  ['focusRing', 'surface', NAO_TEXTUAL, 'anel de foco em linhas, botões e campos sobre cartão'],
  ['focusRing', 'bg', NAO_TEXTUAL, 'anel de foco sobre o fundo da página'],
];

describe('RH no design Depósito', () => {
  const casosRh = NOMES.flatMap((tema) => PARES_RH.map((p) => [tema, ...p] as const));

  it.each(casosRh)('[%s] %s sobre %s ≥ %s (%s)', (tema, frente, fundo, limiar) => {
    const p: Paleta = TEMAS[tema];
    expect(razaoContraste(p[frente], p[fundo])).toBeGreaterThanOrEqual(limiar);
  });

  it.each([
    [false, 'oceano'],
    [true, 'noite'],
  ] as const)(
    'Automático com prefereEscuro=%s resolve %s e os pares passam',
    (escuro, esperado) => {
      const tema = resolverTema('automatico', escuro);
      expect(tema).toBe(esperado);
      const p: Paleta = TEMAS[tema];
      for (const [frente, fundo, limiar] of PARES_RH) {
        expect(razaoContraste(p[frente], p[fundo]), `${frente}/${fundo}`).toBeGreaterThanOrEqual(
          limiar,
        );
      }
    },
  );
});

// Cadastros, seleção de operador e telas restantes no design Depósito
// [frente, fundo, limiar, onde ocorre]
const PARES_TELAS: [Chave, Chave, number, string][] = [
  [
    'text',
    'surface',
    TEXTO,
    'nome no item do operador, linhas e cartões (select-operator-page.scss:.operador__item)',
  ],
  [
    'textMuted',
    'surface',
    TEXTO,
    'cargo do operador, estoque e preço nos cards (select-operator-page.scss:.operador__cargo)',
  ],
  [
    'textMuted',
    'bg',
    TEXTO,
    'cabeçalho do operador e texto de apoio sobre o fundo (select-operator-page.scss:.operador__header)',
  ],
  [
    'textOnPrimary',
    'primary',
    TEXTO,
    'Tentar novamente (select-operator-page.scss:.operador__retry) e ação da prévia (aparencia-page.scss:.aparencia__previa-acao)',
  ],
  [
    'focusRing',
    'surface',
    NAO_TEXTUAL,
    'anel de foco no item do operador (select-operator-page.scss:.operador__item:focus-visible)',
  ],
  [
    'focusRing',
    'bg',
    NAO_TEXTUAL,
    'anel de foco sobre o fundo da página (Tentar novamente, formulários)',
  ],
  [
    'danger',
    'surface',
    TEXTO,
    'ce-saldo-chip com saldo negativo (saldo-chip.ts:56-58, funcionario-page.ts:78)',
  ],
  [
    'text',
    'surface',
    TEXTO,
    'ce-saldo-chip com saldo zerado (saldo-chip.ts:60-62, funcionario-page.ts:78)',
  ],
  [
    'warning',
    'surface',
    TEXTO,
    'ce-saldo-chip com saldo a pagar positivo (saldo-chip.ts:52-54, funcionario-page.ts:78)',
  ],
  [
    'textMuted',
    'surfaceMuted',
    TEXTO,
    'totais do PDV e da venda (pdv-page.ts:.totais, item-venda-sheet.ts:.totais)',
  ],
  [
    'text',
    'surfaceMuted',
    TEXTO,
    'valores dos totais (pagamento-lista.ts, item-venda-sheet.ts:.totais)',
  ],
  ['text', 'sucataSoft', TEXTO, 'aviso de sucata no PDV (pdv-page.ts:.sucata__aviso)'],
  [
    'primaryStrong',
    'primarySoft',
    TEXTO,
    'aviso das sheets de sucata e baixa de casco (entregar-sucata-sheet.ts:.aviso, baixa-casco-sheet.ts:.aviso)',
  ],
  ['surface', 'text', TEXTO, 'toast (toast-outlet.ts: fundo --ce-text, texto --ce-surface)'],
  [
    'textOnPrimary',
    'primary',
    TEXTO,
    'ce-button primário na ce-barra-acao dos formulários (produto, marca, cliente)',
  ],
  ['bordaCampo', 'surface', NAO_TEXTUAL, 'borda de campo nos formulários de cadastro e nas sheets'],
  ['bordaCampo', 'bg', NAO_TEXTUAL, 'borda de campo sobre o fundo da página'],
  ['danger', 'surface', TEXTO, 'p.erro/role=alert dos formulários e sheets'],
];

describe('Cadastros, seleção de operador e telas restantes no design Depósito', () => {
  const casos = NOMES.flatMap((tema) => PARES_TELAS.map((p) => [tema, ...p] as const));

  it.each(casos)('[%s] %s sobre %s ≥ %s (%s)', (tema, frente, fundo, limiar) => {
    const p: Paleta = TEMAS[tema];
    expect(razaoContraste(p[frente], p[fundo])).toBeGreaterThanOrEqual(limiar);
  });

  it.each([
    [false, 'oceano'],
    [true, 'noite'],
  ] as const)(
    'Automático com prefereEscuro=%s resolve %s e os pares passam',
    (escuro, esperado) => {
      const tema = resolverTema('automatico', escuro);
      expect(tema).toBe(esperado);
      const p: Paleta = TEMAS[tema];
      for (const [frente, fundo, limiar] of PARES_TELAS) {
        expect(razaoContraste(p[frente], p[fundo]), `${frente}/${fundo}`).toBeGreaterThanOrEqual(
          limiar,
        );
      }
    },
  );
});
