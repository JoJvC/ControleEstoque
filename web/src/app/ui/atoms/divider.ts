import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'ce-divider',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: ``,
  styles: `
    :host {
      display: block;
      height: 1px;
      background: var(--ce-border);
      margin-block: var(--ce-space-3);
    }
  `,
})
export class Divider {}
