import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { EstoqueApi } from '../../core/api/estoque-api';
import { ProdutoResponse, TipoProduto } from '../../core/api/models/estoque';
import { Button } from '../../ui/atoms/button';
import { Icon } from '../../ui/atoms/icon';
import { Select } from '../../ui/atoms/select';
import { SearchBox } from '../../ui/molecules/search-box';
import { AppHeader } from '../../ui/organisms/app-header';
import { DataList } from '../../ui/organisms/data-list';
import { ProdutoCard } from '../../ui/organisms/produto-card';
import { FormsModule } from '@angular/forms';
import { ProdutosStore } from './produtos-store';

const TIPO_LABEL: Record<TipoProduto, string> = {
  AGUA: 'Água',
  GALAO_COMPLETO: 'Galão completo',
  CASCO: 'Casco',
  SUCATA: 'Sucata',
  DESCARTAVEL: 'Descartável',
};

@Component({
  selector: 'ce-produtos-lista-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AppHeader, Button, Icon, Select, SearchBox, DataList, ProdutoCard, FormsModule],
  template: `
    <ce-app-header titulo="Produtos" [mostrarVoltar]="true" (voltar)="voltarParaMais()">
      <ce-button variante="ghost" (click)="novo()"
        ><ce-icon nome="mais" [tamanho]="18" /> Novo</ce-button
      >
    </ce-app-header>

    <div class="filtros">
      <ce-search-box placeholder="Buscar produto…" (buscar)="busca.set($event)" />
      <ce-select
        [opcoes]="tiposOpcoes"
        placeholder="Todos os tipos"
        [ngModel]="tipoFiltro()"
        (ngModelChange)="tipoFiltro.set($event)"
      />
    </div>

    <div class="conteudo">
      <ce-data-list
        [itens]="produtosFiltrados()"
        [status]="store.status()"
        vazioTitulo="Nenhum produto"
        vazioDescricao="Cadastre o primeiro produto da loja."
        (recarregar)="store.carregar()"
      >
        <ng-template let-produto>
          <ce-produto-card
            [nome]="produto.nome"
            [detalhe]="detalheDe(produto)"
            [precoReferencia]="produto.precoReferencia"
            [fotoSrc]="produto.fotoUrl ? api.urlFoto(produto.id) : null"
            (click)="editar(produto)"
          />
        </ng-template>
      </ce-data-list>
    </div>
  `,
  styles: `
    .filtros {
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-3);
      padding-inline: var(--ce-space-4);
    }

    .conteudo {
      padding: var(--ce-space-4);
    }
  `,
})
export class ProdutosListaPage {
  protected readonly store = inject(ProdutosStore);
  protected readonly api = inject(EstoqueApi);
  private readonly router = inject(Router);

  protected readonly busca = signal('');
  protected readonly tipoFiltro = signal<string | null>(null);

  protected readonly tiposOpcoes = (Object.keys(TIPO_LABEL) as TipoProduto[]).map((tipo) => ({
    value: tipo,
    label: TIPO_LABEL[tipo],
  }));

  protected readonly produtosFiltrados = computed(() => {
    const termo = this.busca().toLowerCase();
    const tipo = this.tipoFiltro();
    return this.store
      .produtos()
      .filter((p) => (tipo ? p.tipo === tipo : true))
      .filter((p) =>
        termo
          ? `${p.nome} ${p.marca ?? ''} ${p.categoria ?? ''}`.toLowerCase().includes(termo)
          : true,
      );
  });

  constructor() {
    this.store.carregar();
  }

  protected detalheDe(produto: ProdutoResponse): string {
    return [TIPO_LABEL[produto.tipo], produto.marca, produto.tamanho, produto.categoria]
      .filter((parte): parte is string => !!parte)
      .join(' · ');
  }

  protected novo(): void {
    this.router.navigateByUrl('/produtos/novo');
  }

  protected editar(produto: ProdutoResponse): void {
    this.router.navigateByUrl(`/produtos/${produto.id}/editar`);
  }

  protected voltarParaMais(): void {
    this.router.navigateByUrl('/mais');
  }
}
