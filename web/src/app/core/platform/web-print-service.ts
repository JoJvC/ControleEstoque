import { DOCUMENT, Injectable, inject } from '@angular/core';

import { PrintService } from './print-service';

/**
 * Impl. web: iframe oculto + window.print — não navega nem abre popup.
 * App nativo trocará por plugin/share do Capacitor.
 */
@Injectable()
export class WebPrintService extends PrintService {
  private readonly document = inject(DOCUMENT);

  override printHtml(title: string, html: string): void {
    const iframe = this.document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    this.document.body.appendChild(iframe);

    const doc = iframe.contentDocument;
    if (doc === null) {
      iframe.remove();
      return;
    }

    doc.open();
    doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title}</title></head>` +
      `<body>${html}</body></html>`);
    doc.close();

    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    // remove após o diálogo de impressão (print é síncrono na maioria dos browsers)
    setTimeout(() => iframe.remove(), 60_000);
  }
}

export function providePrint() {
  return { provide: PrintService, useClass: WebPrintService };
}
