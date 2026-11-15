import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { EstoqueApi } from '../../core/api/estoque-api';
import { TipoProduto } from '../../core/api/models/estoque';
import { ApiError } from '../../core/http/api-error';
import { MediaService } from '../../core/platform/media-service';
import { ToastService } from '../../core/toast/toast-service';
import { Button } from '../../ui/atoms/button';
import { Icon } from '../../ui/atoms/icon';
import { Select, SelectOpcao } from '../../ui/atoms/select';
import { TextInput } from '../../ui/atoms/text-input';
import { FormField } from '../../ui/molecules/form-field';
import { MoneyInput } from '../../ui/molecules/money-input';
import { AppHeader } from '../../ui/organisms/app-header';
import { BarraAcao } from '../../ui/organisms/barra-acao';
import { MarcasStore } from './marcas-store';
import {
  ErrosProduto,
  FormProduto,
  LinhaMarca,
  SEM_MARCA,
  aoTrocarTipo,
  cascoEfetivo,
  cascosDaMarca,
  cascosGenericos,
  formDe,
  marcaGenericaDe,
  marcaIdDaLinha,
  novaLinha,
  novoForm,
  opcoesDeMarca,
  temErros,
  validarProduto,
} from './produto-form-modelo';
import { ProdutosStore } from './produtos-store';
import { TiposCascoStore } from './tipos-casco-store';

const TIPOS: { value: TipoProduto; label: string }[] = [
  { value: 'RETORNAVEL', label: 'Retornável' },
  { value: 'DESCARTAVEL', label: 'Descartável' },
];

/** Valor da opção "sem casco específico" no select da linha (vira null). */
const USA_GENERICO = '__usa-generico__';

@Component({
  selector: 'ce-produto-form-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    AppHeader,
    BarraAcao,
    Button,
    Icon,
    Select,
    TextInput,
    FormField,
    MoneyInput,
  ],
  templateUrl: './produto-form-page.html',
  styleUrl: './produto-form-page.scss',
})
export class ProdutoFormPage {
  /** Route param (:id) — null em /produtos/novo. */
  readonly id = input<string | null, string | null | undefined>(null, {
    // withComponentInputBinding entrega undefined (não null) quando a rota não tem :id.
    transform: (v) => v ?? null,
  });

  protected readonly marcasStore = inject(MarcasStore);
  private readonly tiposCasco = inject(TiposCascoStore);
  private readonly produtosStore = inject(ProdutosStore);
  private readonly api = inject(EstoqueApi);
  private readonly media = inject(MediaService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  protected readonly tipos = TIPOS;
  protected readonly usaGenerico = USA_GENERICO;
  protected readonly form = signal<FormProduto>(novoForm());
  /** Erros de validação local; só aparecem depois da primeira tentativa de salvar. */
  protected readonly erros = signal<ErrosProduto | null>(null);
  protected readonly salvando = signal(false);
  protected readonly erroForm = signal<string | null>(null);

  protected readonly opcoesMarca = computed(() => opcoesDeMarca(this.marcasStore.marcas()));
  protected readonly genericaId = computed(
    () => marcaGenericaDe(this.marcasStore.marcas())?.id ?? null,
  );
  protected readonly cascosGenericos = computed(() =>
    this.opcoesDeCasco(cascosGenericos(this.tiposCasco.tipos())),
  );
  private readonly nomesDeCasco = computed(
    () => new Map(this.tiposCasco.tipos().map((t) => [t.id, t.nome])),
  );

  constructor() {
    this.produtosStore.reiniciar();
    this.marcasStore.carregar();
    void this.tiposCasco.carregar();
    queueMicrotask(() => this.carregarExistente());
  }

  private carregarExistente(): void {
    const id = this.id();
    if (id === null) {
      return;
    }
    this.api.obterProduto(id).subscribe({
      next: (produto) =>
        this.form.set(formDe(produto, (pmId) => this.api.urlFotoMarca(produto.id, pmId))),
      error: () => this.toast.error('Não foi possível carregar o produto.'),
    });
  }

  private opcoesDeCasco(tipos: { id: string; nome: string }[]): SelectOpcao[] {
    return tipos.map((t) => ({ value: t.id, label: t.nome }));
  }

  protected opcoesCascoDaLinha(linha: LinhaMarca): SelectOpcao[] {
    const especificos = cascosDaMarca(
      this.tiposCasco.tipos(),
      marcaIdDaLinha(linha, this.genericaId()),
    );
    return [
      { value: USA_GENERICO, label: 'Usa o casco genérico' },
      ...this.opcoesDeCasco(especificos),
    ];
  }

  /** Dica da linha: qual casco vale ('específico vence'). */
  protected dicaDeCasco(linha: LinhaMarca): string {
    const efetivo = cascoEfetivo(linha, this.form().tipoCascoId);
    const nome = efetivo === null ? null : this.nomesDeCasco().get(efetivo);
    return nome ? `Usa o casco ${nome}.` : 'Escolha o casco genérico do produto.';
  }

  protected escolherTipo(tipo: TipoProduto): void {
    this.form.update((f) => aoTrocarTipo(f, tipo));
  }

  protected definir(campo: 'nome' | 'categoria' | 'tamanho', valor: string | null): void {
    this.form.update((f) => ({ ...f, [campo]: valor ?? '' }));
  }

  protected definirCascoGenerico(id: string | null): void {
    this.form.update((f) => ({ ...f, tipoCascoId: id }));
  }

  protected adicionarMarca(): void {
    this.form.update((f) => ({ ...f, linhas: [...f.linhas, novaLinha()] }));
  }

  protected remover(chave: number): void {
    this.form.update((f) => ({ ...f, linhas: f.linhas.filter((l) => l.chave !== chave) }));
  }

  protected atualizarLinha(chave: number, parcial: Partial<LinhaMarca>): void {
    this.form.update((f) => ({
      ...f,
      linhas: f.linhas.map((l) => (l.chave === chave ? { ...l, ...parcial } : l)),
    }));
  }

  protected trocarMarca(linha: LinhaMarca, marcaId: string | null): void {
    // o casco específico é da marca anterior: não vale para a nova
    this.atualizarLinha(linha.chave, { marcaId, tipoCascoId: null });
  }

  protected definirCascoEspecifico(linha: LinhaMarca, valor: string | null): void {
    this.atualizarLinha(linha.chave, { tipoCascoId: valor === USA_GENERICO ? null : valor });
  }

  protected async escolherFoto(linha: LinhaMarca): Promise<void> {
    const arquivo = await this.media.pickImage();
    if (arquivo !== null) {
      this.atualizarLinha(linha.chave, { foto: arquivo, fotoSrc: this.media.previewUrl(arquivo) });
    }
  }

  protected semMarca(linha: LinhaMarca): boolean {
    return linha.marcaId === SEM_MARCA;
  }

  protected async salvar(): Promise<void> {
    this.erroForm.set(null);
    const erros = validarProduto(this.form());
    this.erros.set(erros);
    if (temErros(erros)) {
      this.erroForm.set('Corrija os campos destacados.');
      afterNextRender(() => this.irAoPrimeiroInvalido(), { injector: this.injector });
      return;
    }

    this.salvando.set(true);
    try {
      await this.produtosStore.salvar(this.form());
      this.toast.success(this.id() === null ? 'Produto cadastrado!' : 'Produto atualizado!');
      this.router.navigateByUrl('/produtos');
    } catch (erro: unknown) {
      this.erroForm.set(erro instanceof ApiError ? erro.userMessage : 'Erro ao salvar o produto.');
    } finally {
      this.salvando.set(false);
    }
  }

  /** Rola até o primeiro campo com erro (ordem do DOM) e o foca; a barra fixa não o cobre. */
  private irAoPrimeiroInvalido(): void {
    const erro = this.host.nativeElement.querySelector('.campo__erro, .marca .form__erro');
    const alvo =
      erro?.closest('label')?.querySelector<HTMLElement>('input, select') ??
      erro?.closest('.marca')?.querySelector<HTMLElement>('.marca__foto');
    alvo?.scrollIntoView({ block: 'center' });
    alvo?.focus({ preventScroll: true });
  }

  protected voltar(): void {
    this.router.navigateByUrl('/produtos');
  }
}
