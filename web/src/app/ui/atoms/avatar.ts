import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
  selector: 'ce-avatar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="avatar"
      [style.width.px]="tamanho()"
      [style.height.px]="tamanho()"
      [style.font-size.px]="tamanho() * 0.4"
      aria-hidden="true"
      >{{ iniciais() }}</span
    >
  `,
  styles: `
    :host {
      display: inline-flex;
    }

    .avatar {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      background: var(--ce-primary-soft);
      color: var(--ce-primary-strong);
      font-weight: 700;
      text-transform: uppercase;
    }
  `,
})
export class Avatar {
  readonly nome = input.required<string>();
  readonly tamanho = input(40);

  protected readonly iniciais = computed(() => {
    const partes = this.nome().trim().split(/\s+/);
    const primeira = partes[0]?.charAt(0) ?? '';
    const ultima = partes.length > 1 ? (partes.at(-1)?.charAt(0) ?? '') : '';
    return `${primeira}${ultima}`;
  });
}
