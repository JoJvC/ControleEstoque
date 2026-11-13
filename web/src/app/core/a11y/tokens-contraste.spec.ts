import { razaoContraste } from './contraste';

// Hex copiados de web/src/styles/tokens.scss (linha entre parênteses).
// Mudou o token? Atualize aqui: o spec é a trava de contraste do design system.
const T = {
  primary: '#0369a1', // :7
  primaryStrong: '#075985', // :8
  primarySoft: '#e0f2fe', // :9
  success: '#15803d', // :10
  successSoft: '#dcfce7', // :11
  warning: '#b45309', // :12
  warningSoft: '#fef3c7', // :13
  danger: '#b91c1c', // :14
  dangerSoft: '#fee2e2', // :15
  bg: '#f1f5f9', // :18
  surface: '#ffffff', // :19
  surfaceMuted: '#f8fafc', // :20
  text: '#0f172a', // :21
  textMuted: '#475569', // :22
  textOnPrimary: '#ffffff', // :23
  focusRing: '#0369a1', // :25
};

const TEXTO = 4.5; // WCAG 1.4.3 (nenhum par abaixo é texto grande)
const NAO_TEXTUAL = 3; // WCAG 1.4.11

// [frente, fundo, limiar, onde ocorre]
const PARES: [keyof typeof T, keyof typeof T, number, string][] = [
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
];

describe('contraste dos tokens', () => {
  it.each(PARES)('%s sobre %s ≥ %s (%s)', (frente, fundo, limiar) => {
    expect(razaoContraste(T[frente], T[fundo])).toBeGreaterThanOrEqual(limiar);
  });
});
