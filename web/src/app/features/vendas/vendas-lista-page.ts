import { ChangeDetectionStrategy, Component } from '@angular/core';

import { PagePlaceholder } from '../../ui/molecules/page-placeholder';

@Component({
  selector: 'ce-vendas-lista-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PagePlaceholder],
  template: `<ce-page-placeholder titulo="Vendas" sprint="F5" />`,
})
export class VendasListaPage {}
