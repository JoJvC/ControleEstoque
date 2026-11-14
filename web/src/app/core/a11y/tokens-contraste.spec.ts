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
    destaque: '#4cc9e8', // tokens.scss:26
    acaoTexto: '#08769c', // tokens.scss:27
    bordaCampo: '#c6dce4', // tokens.scss:28
    casco: '#0b6e63', // tokens.scss:29
    cascoSoft: '#ddf2ee', // tokens.scss:30
    sucata: '#5b6472', // tokens.scss:31
    sucataSoft: '#eceef1', // tokens.scss:32
    fiado: '#c2410c', // tokens.scss:33
    fiadoSoft: '#ffede3', // tokens.scss:34
    pago: '#15803d', // tokens.scss:35
    pagoSoft: '#e3f5ea', // tokens.scss:36
    agua: '#08769c', // tokens.scss:37
    aguaSoft: '#e3f3f8', // tokens.scss:38
    aguaNivel: '#4cc9e8', // tokens.scss:39
  },
  uva: {
    primary: '#6d28d9', // tokens.scss:82
    primaryStrong: '#2e1065', // tokens.scss:83
    primarySoft: '#ede9fe', // tokens.scss:84
    success: '#15803d', // tokens.scss:85
    successSoft: '#dcfce7', // tokens.scss:86
    warning: '#b45309', // tokens.scss:87
    warningSoft: '#fef3c7', // tokens.scss:88
    danger: '#b91c1c', // tokens.scss:89
    dangerSoft: '#fee2e2', // tokens.scss:90
    bg: '#f6f5fb', // tokens.scss:91
    surface: '#ffffff', // tokens.scss:92
    surfaceMuted: '#f6f5fb', // tokens.scss:93
    text: '#1e1537', // tokens.scss:94
    textMuted: '#5b5570', // tokens.scss:95
    textOnPrimary: '#ffffff', // tokens.scss:96
    border: '#e7e4f0', // tokens.scss:97
    focusRing: '#6d28d9', // tokens.scss:98
    topo: '#2e1065', // tokens.scss:99
    topoCartao: '#43198f', // tokens.scss:100
    destaque: '#c4b5fd', // tokens.scss:101
    acaoTexto: '#6d28d9', // tokens.scss:102
    bordaCampo: '#cfc9e0', // tokens.scss:103
    casco: '#0b6e63', // tokens.scss:104
    cascoSoft: '#ddf2ee', // tokens.scss:105
    sucata: '#5b6472', // tokens.scss:106
    sucataSoft: '#eceef1', // tokens.scss:107
    fiado: '#c2410c', // tokens.scss:108
    fiadoSoft: '#ffede3', // tokens.scss:109
    pago: '#15803d', // tokens.scss:110
    pagoSoft: '#e3f5ea', // tokens.scss:111
    agua: '#08769c', // tokens.scss:112
    aguaSoft: '#e3f3f8', // tokens.scss:113
    aguaNivel: '#4cc9e8', // tokens.scss:114
  },
  carvao: {
    primary: '#2f3338', // tokens.scss:118
    primaryStrong: '#1f2226', // tokens.scss:119
    primarySoft: '#ecedef', // tokens.scss:120
    success: '#15803d', // tokens.scss:121
    successSoft: '#dcfce7', // tokens.scss:122
    warning: '#b45309', // tokens.scss:123
    warningSoft: '#fef3c7', // tokens.scss:124
    danger: '#b91c1c', // tokens.scss:125
    dangerSoft: '#fee2e2', // tokens.scss:126
    bg: '#f4f4f2', // tokens.scss:127
    surface: '#ffffff', // tokens.scss:128
    surfaceMuted: '#f4f4f2', // tokens.scss:129
    text: '#1a1c1f', // tokens.scss:130
    textMuted: '#575c63', // tokens.scss:131
    textOnPrimary: '#ffffff', // tokens.scss:132
    border: '#e4e4e1', // tokens.scss:133
    focusRing: '#2f3338', // tokens.scss:134
    topo: '#1f2226', // tokens.scss:135
    topoCartao: '#33373d', // tokens.scss:136
    destaque: '#f5b942', // tokens.scss:137
    acaoTexto: '#2f3338', // tokens.scss:138
    bordaCampo: '#cacbc7', // tokens.scss:139
    casco: '#0b6e63', // tokens.scss:140
    cascoSoft: '#ddf2ee', // tokens.scss:141
    sucata: '#5b6472', // tokens.scss:142
    sucataSoft: '#eceef1', // tokens.scss:143
    fiado: '#c2410c', // tokens.scss:144
    fiadoSoft: '#ffede3', // tokens.scss:145
    pago: '#15803d', // tokens.scss:146
    pagoSoft: '#e3f5ea', // tokens.scss:147
    agua: '#08769c', // tokens.scss:148
    aguaSoft: '#e3f3f8', // tokens.scss:149
    aguaNivel: '#4cc9e8', // tokens.scss:150
  },
  noite: {
    primary: '#4cc9e8', // tokens.scss:154
    primaryStrong: '#7dd8ee', // tokens.scss:155
    primarySoft: '#0e2a3b', // tokens.scss:156
    success: '#4ade80', // tokens.scss:157
    successSoft: '#0f2e1c', // tokens.scss:158
    warning: '#fb923c', // tokens.scss:159
    warningSoft: '#3a1f10', // tokens.scss:160
    danger: '#f87171', // tokens.scss:161
    dangerSoft: '#3b1518', // tokens.scss:162
    bg: '#07141c', // tokens.scss:163
    surface: '#0e2230', // tokens.scss:164
    surfaceMuted: '#07141c', // tokens.scss:165
    text: '#e6f2f6', // tokens.scss:166
    textMuted: '#9db5c2', // tokens.scss:167
    textOnPrimary: '#03202c', // tokens.scss:168
    border: '#1d3a4c', // tokens.scss:169
    focusRing: '#4cc9e8', // tokens.scss:170
    topo: '#050e15', // tokens.scss:171
    topoCartao: '#0e2a3b', // tokens.scss:172
    destaque: '#4cc9e8', // tokens.scss:173
    acaoTexto: '#7dd8ee', // tokens.scss:174
    bordaCampo: '#2d4d61', // tokens.scss:175
    casco: '#4fd1be', // tokens.scss:176
    cascoSoft: '#0d3a35', // tokens.scss:177
    sucata: '#aab3bf', // tokens.scss:178
    sucataSoft: '#232c36', // tokens.scss:179
    fiado: '#fb923c', // tokens.scss:180
    fiadoSoft: '#3a1f10', // tokens.scss:181
    pago: '#4ade80', // tokens.scss:182
    pagoSoft: '#0f2e1c', // tokens.scss:183
    agua: '#4cc9e8', // tokens.scss:184
    aguaSoft: '#0e2a3b', // tokens.scss:185
    aguaNivel: '#4cc9e8', // tokens.scss:186
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
