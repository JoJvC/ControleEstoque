import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { EstoqueApi } from '../../core/api/estoque-api';
import { CreateProdutoRequest, TipoProduto } from '../../core/api/models/estoque';
import { ApiError } from '../../core/http/api-error';
import { MediaService } from '../../core/platform/media-service';
import { ToastService } from '../../core/toast/toast-service';
import { Button } from '../../ui/atoms/button';
import { Icon } from '../../ui/atoms/icon';
import { Select } from '../../ui/atoms/select';
import { TextInput } from '../../ui/atoms/text-input';
import { FormField } from '../../ui/molecules/form-field';
import { MoneyInput } from '../../ui/molecules/money-input';
import { QuantityStepper } from '../../ui/molecules/quantity-stepper';
import { AppHeader } from '../../ui/organisms/app-header';
import { MarcasStore } from './marcas-store';
import { ProdutosStore } from './produtos-store';

/** Tipos criáveis pela tela — CASCO e SUCATA são produtos estruturais (seed do banco). */
const TIPOS_CRIAVEIS: { value: TipoProduto; label: string }[] = [
  { value: 'AGUA', label: 'Água (empresta casco)' },
  { value: 'GALAO_COMPLETO', label: 'Galão completo (casco + água)' },
  { value: 'DESCARTAVEL', label: 'Descartável / outros' },
];

@Component({
  selector: 'ce-produto-form-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    AppHeader,
    Button,
    Icon,
    Select,
    TextInput,
    FormField,
    MoneyInput,
    QuantityStepper,
  ],
  templateUrl: './produto-form-page.html',
  styleUrl: './produto-form-page.scss',
})
export class ProdutoFormPage {
  /** Route param (:id) — null em /produtos/novo. */
  readonly id = input<string | null>(null);

  protected readonly marcasStore = inject(MarcasStore);
  private readonly produtosStore = inject(ProdutosStore);
  private readonly api = inject(EstoqueApi);
  private readonly media = inject(MediaService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly tipos = TIPOS_CRIAVEIS;

  protected readonly nome = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required],
  });
  protected readonly tipo = new FormControl<TipoProduto | null>(null, Validators.required);
  protected readonly marcaId = new FormControl<string | null>(null);
  protected readonly categoria = new FormControl('', { nonNullable: true });
  protected readonly tamanho = new FormControl('', { nonNullable: true });
  protected readonly precoReferencia = new FormControl<number | null>(null);
  protected readonly estoqueMinimo = new FormControl(0, { nonNullable: true });

  protected readonly salvando = signal(false);
  protected readonly erroForm = signal<string | null>(null);
  protected readonly foto = signal<File | null>(null);
  protected readonly fotoPreview = signal<string | null>(null);
  protected readonly tipoSelecionado = signal<TipoProduto | null>(null);

  protected readonly marcaObrigatoria = computed(() => {
    const tipo = this.tipoSelecionado();
    return tipo === 'AGUA' || tipo === 'GALAO_COMPLETO';
  });

  protected readonly marcasOpcoes = computed(() =>
    this.marcasStore.marcas().map((m) => ({ value: m.id, label: m.nome })),
  );

  constructor() {
    this.marcasStore.carregar();
    this.tipo.valueChanges.subscribe((tipo) => this.tipoSelecionado.set(tipo));
    queueMicrotask(() => this.carregarExistente());
  }

  private carregarExistente(): void {
    const id = this.id();
    if (id === null) {
      return;
    }
    this.api.obterProduto(id).subscribe({
      next: (produto) => {
        this.nome.setValue(produto.nome);
        this.tipo.setValue(produto.tipo);
        this.marcaId.setValue(produto.marcaId);
        this.categoria.setValue(produto.categoria ?? '');
        this.tamanho.setValue(produto.tamanho ?? '');
        this.precoReferencia.setValue(produto.precoReferencia);
        this.estoqueMinimo.setValue(produto.estoqueMinimo);
        if (produto.fotoUrl) {
          this.fotoPreview.set(this.api.urlFoto(produto.id));
        }
      },
      error: () => this.toast.error('Não foi possível carregar o produto.'),
    });
  }

  protected async escolherFoto(): Promise<void> {
    const arquivo = await this.media.pickImage();
    if (arquivo !== null) {
      this.foto.set(arquivo);
      this.fotoPreview.set(this.media.previewUrl(arquivo));
    }
  }

  protected async salvar(): Promise<void> {
    this.erroForm.set(null);
    if (this.nome.invalid || this.tipo.value === null) {
      this.erroForm.set('Preencha nome e tipo do produto.');
      return;
    }
    if (this.marcaObrigatoria() && this.marcaId.value === null) {
      this.erroForm.set('Marca é obrigatória para água e galão completo.');
      return;
    }

    const request: CreateProdutoRequest = {
      tipo: this.tipo.value,
      nome: this.nome.value.trim(),
      marcaId: this.marcaId.value,
      categoria: this.categoria.value.trim() || null,
      tamanho: this.tamanho.value.trim() || null,
      precoReferencia: this.precoReferencia.value ?? 0,
      estoqueMinimo: this.estoqueMinimo.value,
    };

    this.salvando.set(true);
    try {
      await this.produtosStore.salvar(request, this.id(), this.foto());
      this.toast.success(this.id() === null ? 'Produto cadastrado!' : 'Produto atualizado!');
      this.router.navigateByUrl('/produtos');
    } catch (erro: unknown) {
      this.erroForm.set(erro instanceof ApiError ? erro.userMessage : 'Erro ao salvar o produto.');
    } finally {
      this.salvando.set(false);
    }
  }

  protected voltar(): void {
    this.router.navigateByUrl('/produtos');
  }
}
