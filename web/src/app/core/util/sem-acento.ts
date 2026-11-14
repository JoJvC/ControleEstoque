/** Minúsculas e sem marcas de acento (NFD): base das buscas e do mapa categoria → ícone. */
export const semAcento = (texto: string): string =>
  texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
