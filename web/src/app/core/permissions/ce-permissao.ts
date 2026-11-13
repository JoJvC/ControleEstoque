import {
  Directive,
  TemplateRef,
  ViewContainerRef,
  computed,
  effect,
  inject,
  input,
  untracked,
} from '@angular/core';

import { PermissionService } from './permission-service';

/** Renderiza o conteúdo só se o operador tem a permissão: `*cePermissao="'vendas.registrar'"`. */
@Directive({ selector: '[cePermissao]' })
export class CePermissao {
  private readonly permissions = inject(PermissionService);
  private readonly template = inject(TemplateRef);
  private readonly container = inject(ViewContainerRef);

  readonly cePermissao = input.required<string>();

  /** Computed: o effect só dispara quando o booleano muda, não a cada troca do operador. */
  private readonly permitido = computed(() => this.permissions.has(this.cePermissao()));

  constructor() {
    effect(() => {
      const permitido = this.permitido();
      untracked(() => {
        this.container.clear();
        if (permitido) this.container.createEmbeddedView(this.template);
      });
    });
  }
}
