/**
 * Apoio de spec: o que a página mostra do padrão de página (DESIGN.md §5), sem asserir nada.
 * `raiz` limita a leitura a um `ce-app-header` quando a tela tem mais de um (lista + detalhe).
 */
export interface PadraoPagina {
  cabecalhos: number;
  voltar: boolean;
  /** Texto dos botões dentro do contêiner de ações do cabeçalho. */
  acoes: string[];
  barras: number;
  cancelar: number;
}

// exceção da busca do critério por 'ce-barra-acao': este helper de teste procura o seletor antigo
const BARRA_ACAO = 'ce-barra-acao';

export function lerPadraoPagina(el: HTMLElement, raiz?: HTMLElement | null): PadraoPagina {
  const cab = raiz ?? el.querySelector<HTMLElement>('ce-app-header');
  const texto = (b: Element) => (b.textContent ?? '').replace(/\s+/g, ' ').trim();
  return {
    cabecalhos: el.querySelectorAll('ce-app-header').length,
    voltar: !!cab?.querySelector('button[aria-label="Voltar"]'),
    acoes: Array.from(cab?.querySelectorAll('.cabecalho__acoes button') ?? []).map(texto),
    barras: el.querySelectorAll(BARRA_ACAO).length,
    cancelar: Array.from(el.querySelectorAll('button')).filter((b) => texto(b) === 'Cancelar')
      .length,
  };
}

/**
 * Reenvia o formulário como o Enter faria: evento `submit` direto (passa pelo `(ngSubmit)` mesmo
 * com o submitter desabilitado) e clique no submitter oculto. Devolve o submitter.
 */
export function reenviarForm(el: HTMLElement): HTMLButtonElement {
  const form = el.querySelector('form')!;
  const submitter = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  form.dispatchEvent(new Event('submit', { cancelable: true }));
  submitter.click();
  return submitter;
}
