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
    primary: '#6d28d9', // tokens.scss:85
    primaryStrong: '#2e1065', // tokens.scss:86
    primarySoft: '#ede9fe', // tokens.scss:87
    success: '#15803d', // tokens.scss:88
    successSoft: '#dcfce7', // tokens.scss:89
    warning: '#b45309', // tokens.scss:90
    warningSoft: '#fef3c7', // tokens.scss:91
    danger: '#b91c1c', // tokens.scss:92
    dangerSoft: '#fee2e2', // tokens.scss:93
    bg: '#f6f5fb', // tokens.scss:94
    surface: '#ffffff', // tokens.scss:95
    surfaceMuted: '#f6f5fb', // tokens.scss:96
    text: '#1e1537', // tokens.scss:97
    textMuted: '#5b5570', // tokens.scss:98
    textOnPrimary: '#ffffff', // tokens.scss:99
    border: '#e7e4f0', // tokens.scss:100
    focusRing: '#6d28d9', // tokens.scss:101
    topo: '#2e1065', // tokens.scss:102
    topoCartao: '#43198f', // tokens.scss:103
    textoSobreTopo: '#ffffff', // tokens.scss:104
    destaque: '#c4b5fd', // tokens.scss:105
    acaoTexto: '#6d28d9', // tokens.scss:106
    bordaCampo: '#8a80a3', // tokens.scss:107
    casco: '#0b6e63', // tokens.scss:108
    cascoSoft: '#ddf2ee', // tokens.scss:109
    sucata: '#5b6472', // tokens.scss:110
    sucataSoft: '#eceef1', // tokens.scss:111
    fiado: '#c2410c', // tokens.scss:112
    fiadoSoft: '#ffede3', // tokens.scss:113
    pago: '#15803d', // tokens.scss:114
    pagoSoft: '#e3f5ea', // tokens.scss:115
    agua: '#08769c', // tokens.scss:116
    aguaSoft: '#e3f3f8', // tokens.scss:117
    aguaNivel: '#4cc9e8', // tokens.scss:118
  },
  carvao: {
    primary: '#2f3338', // tokens.scss:122
    primaryStrong: '#1f2226', // tokens.scss:123
    primarySoft: '#ecedef', // tokens.scss:124
    success: '#15803d', // tokens.scss:125
    successSoft: '#dcfce7', // tokens.scss:126
    warning: '#b45309', // tokens.scss:127
    warningSoft: '#fef3c7', // tokens.scss:128
    danger: '#b91c1c', // tokens.scss:129
    dangerSoft: '#fee2e2', // tokens.scss:130
    bg: '#f4f4f2', // tokens.scss:131
    surface: '#ffffff', // tokens.scss:132
    surfaceMuted: '#f4f4f2', // tokens.scss:133
    text: '#1a1c1f', // tokens.scss:134
    textMuted: '#575c63', // tokens.scss:135
    textOnPrimary: '#ffffff', // tokens.scss:136
    border: '#e4e4e1', // tokens.scss:137
    focusRing: '#2f3338', // tokens.scss:138
    topo: '#1f2226', // tokens.scss:139
    topoCartao: '#33373d', // tokens.scss:140
    textoSobreTopo: '#ffffff', // tokens.scss:141
    destaque: '#f5b942', // tokens.scss:142
    acaoTexto: '#2f3338', // tokens.scss:143
    bordaCampo: '#868782', // tokens.scss:144
    casco: '#0b6e63', // tokens.scss:145
    cascoSoft: '#ddf2ee', // tokens.scss:146
    sucata: '#5b6472', // tokens.scss:147
    sucataSoft: '#eceef1', // tokens.scss:148
    fiado: '#c2410c', // tokens.scss:149
    fiadoSoft: '#ffede3', // tokens.scss:150
    pago: '#15803d', // tokens.scss:151
    pagoSoft: '#e3f5ea', // tokens.scss:152
    agua: '#08769c', // tokens.scss:153
    aguaSoft: '#e3f3f8', // tokens.scss:154
    aguaNivel: '#4cc9e8', // tokens.scss:155
  },
  noite: {
    primary: '#4cc9e8', // tokens.scss:159
    primaryStrong: '#7dd8ee', // tokens.scss:160
    primarySoft: '#0e2a3b', // tokens.scss:161
    success: '#4ade80', // tokens.scss:162
    successSoft: '#0f2e1c', // tokens.scss:163
    warning: '#fb923c', // tokens.scss:164
    warningSoft: '#3a1f10', // tokens.scss:165
    danger: '#f87171', // tokens.scss:166
    dangerSoft: '#3b1518', // tokens.scss:167
    bg: '#07141c', // tokens.scss:168
    surface: '#0e2230', // tokens.scss:169
    surfaceMuted: '#07141c', // tokens.scss:170
    text: '#e6f2f6', // tokens.scss:171
    textMuted: '#9db5c2', // tokens.scss:172
    textOnPrimary: '#03202c', // tokens.scss:173
    border: '#1d3a4c', // tokens.scss:174
    focusRing: '#4cc9e8', // tokens.scss:175
    topo: '#050e15', // tokens.scss:176
    topoCartao: '#0e2a3b', // tokens.scss:177
    textoSobreTopo: '#e6f2f6', // tokens.scss:178
    destaque: '#4cc9e8', // tokens.scss:179
    acaoTexto: '#7dd8ee', // tokens.scss:180
    bordaCampo: '#5a7b90', // tokens.scss:181
    casco: '#4fd1be', // tokens.scss:182
    cascoSoft: '#0d3a35', // tokens.scss:183
    sucata: '#aab3bf', // tokens.scss:184
    sucataSoft: '#232c36', // tokens.scss:185
    fiado: '#fb923c', // tokens.scss:186
    fiadoSoft: '#3a1f10', // tokens.scss:187
    pago: '#4ade80', // tokens.scss:188
    pagoSoft: '#0f2e1c', // tokens.scss:189
    agua: '#4cc9e8', // tokens.scss:190
    aguaSoft: '#0e2a3b', // tokens.scss:191
    aguaNivel: '#4cc9e8', // tokens.scss:192
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
