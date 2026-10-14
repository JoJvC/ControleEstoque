import { Injectable, signal } from '@angular/core';

export type ToastKind = 'success' | 'error' | 'info';

export interface Toast {
  readonly id: number;
  readonly kind: ToastKind;
  readonly message: string;
  readonly detail?: string;
}

const AUTO_DISMISS_MS = 6000;

@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 1;
  private readonly items = signal<readonly Toast[]>([]);

  readonly toasts = this.items.asReadonly();

  success(message: string, detail?: string): void {
    this.show('success', message, detail);
  }

  error(message: string, detail?: string): void {
    this.show('error', message, detail);
  }

  info(message: string, detail?: string): void {
    this.show('info', message, detail);
  }

  dismiss(id: number): void {
    this.items.update((toasts) => toasts.filter((t) => t.id !== id));
  }

  private show(kind: ToastKind, message: string, detail?: string): void {
    const toast: Toast = { id: this.nextId++, kind, message, detail };
    this.items.update((toasts) => [...toasts, toast]);
    setTimeout(() => this.dismiss(toast.id), AUTO_DISMISS_MS);
  }
}
