import { ChangeDetectionStrategy, Component } from '@angular/core';

import { PagePlaceholder } from '../../ui/molecules/page-placeholder';

@Component({
  selector: 'ce-pdv-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PagePlaceholder],
  template: `<ce-page-placeholder titulo="Nova venda (PDV)" sprint="F5" />`,
})
export class PdvPage {}
