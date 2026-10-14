import { ToastService } from './toast-service';

describe('ToastService', () => {
  it('show adiciona toast com kind e detail', () => {
    const service = new ToastService();

    service.error('Falhou', 'Código de suporte: abc');
    service.success('Deu certo');

    const toasts = service.toasts();
    expect(toasts.length).toBe(2);
    expect(toasts[0].kind).toBe('error');
    expect(toasts[0].detail).toBe('Código de suporte: abc');
    expect(toasts[1].kind).toBe('success');
  });

  it('dismiss remove apenas o toast indicado', () => {
    const service = new ToastService();
    service.info('primeiro');
    service.info('segundo');

    service.dismiss(service.toasts()[0].id);

    expect(service.toasts().length).toBe(1);
    expect(service.toasts()[0].message).toBe('segundo');
  });
});
