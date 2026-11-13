import { DOCUMENT } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { WebPrintService } from './web-print-service';

function criarDuble(comContentDocument: boolean) {
  const ordem: string[] = [];
  const contentDocument = comContentDocument
    ? {
        open: vi.fn(() => ordem.push('open')),
        write: vi.fn<(html: string) => void>(() => void ordem.push('write')),
        close: vi.fn(() => ordem.push('close')),
      }
    : null;
  const contentWindow = { focus: vi.fn(), print: vi.fn() };
  const iframe = {
    style: {} as Record<string, string>,
    remove: vi.fn(),
    contentDocument,
    contentWindow,
  };
  const docDuble = {
    createElement: vi.fn(() => iframe),
    body: { appendChild: vi.fn() },
  };
  TestBed.configureTestingModule({
    providers: [WebPrintService, { provide: DOCUMENT, useValue: docDuble }],
  });
  return { service: TestBed.inject(WebPrintService), docDuble, iframe, ordem };
}

describe('WebPrintService.printHtml', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('cria o iframe oculto e o anexa ao body', () => {
    const { service, docDuble, iframe } = criarDuble(true);
    service.printHtml('T', '<p>x</p>');
    expect(docDuble.createElement).toHaveBeenCalledWith('iframe');
    expect(iframe.style).toMatchObject({
      position: 'fixed',
      right: '0',
      bottom: '0',
      width: '0',
      height: '0',
      border: '0',
    });
    expect(docDuble.body.appendChild).toHaveBeenCalledWith(iframe);
  });

  it('escreve o HTML e chama print uma vez, de forma síncrona', () => {
    const { service, iframe, ordem } = criarDuble(true);
    service.printHtml('Meu título', '<p>corpo</p>');
    expect(ordem).toEqual(['open', 'write', 'close']);
    const escrito = iframe.contentDocument!.write.mock.calls[0][0];
    expect(escrito).toContain('<title>Meu título</title>');
    expect(escrito).toContain('<body><p>corpo</p></body>');
    expect(iframe.contentWindow.print).toHaveBeenCalledTimes(1);
  });

  it('remove o iframe somente após 60 s', () => {
    const { service, iframe } = criarDuble(true);
    service.printHtml('T', 'h');
    vi.advanceTimersByTime(59_999);
    expect(iframe.remove).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(iframe.remove).toHaveBeenCalledTimes(1);
  });

  it('retorna cedo e remove o iframe quando contentDocument é null', () => {
    const { service, iframe } = criarDuble(false);
    service.printHtml('T', 'h');
    expect(iframe.remove).toHaveBeenCalledTimes(1);
    expect(iframe.contentWindow.print).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
