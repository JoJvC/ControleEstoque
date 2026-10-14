/**
 * Único ponto do app que imprime (cupom fiscal).
 * Impl. web (window.print) chega na Sprint F5; impl. nativa futura via plugin/share.
 */
export abstract class PrintService {
  abstract printHtml(title: string, html: string): void;
}
