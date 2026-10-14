import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { ToastOutlet } from './core/toast/toast-outlet';

@Component({
  selector: 'ce-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, ToastOutlet],
  template: `
    <router-outlet />
    <ce-toast-outlet />
  `,
})
export class App {}
