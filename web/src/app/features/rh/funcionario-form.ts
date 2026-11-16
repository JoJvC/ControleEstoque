import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';

import { CreateFuncionarioRequest, FuncionarioResponse } from '../../core/api/models/rh';
import { RhApi } from '../../core/api/rh-api';
import { Checkbox } from '../../ui/atoms/checkbox';
import { Select, SelectOpcao } from '../../ui/atoms/select';
import { TextInput } from '../../ui/atoms/text-input';
import { FormField } from '../../ui/molecules/form-field';
import { MoneyInput } from '../../ui/molecules/money-input';

/** Diária 0 é válida (dono/ADM sem diária); vazia (null) e negativa não. */
export function diariaValida(v: number | null): boolean {
  return v !== null && v >= 0;
}

/**
 * Formulário de funcionário, compartilhado pela criação (lista) e pela edição.
 * Sem botão próprio: o Salvar mora no cabeçalho da página, que chama `enviar()`.
 */
@Component({
  selector: 'ce-funcionario-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, Checkbox, Select, TextInput, FormField, MoneyInput],
  template: `
    <form [formGroup]="form" (ngSubmit)="enviar()">
      <button
        type="submit"
        hidden
        aria-hidden="true"
        tabindex="-1"
        [disabled]="salvando()"
      ></button>
      <ce-form-field rotulo="Nome" [obrigatorio]="true">
        <ce-input formControlName="nome" />
      </ce-form-field>
      <ce-form-field rotulo="Telefone">
        <ce-input formControlName="telefone" tipo="tel" />
      </ce-form-field>
      <ce-form-field rotulo="Cargo" [obrigatorio]="true">
        <ce-select formControlName="cargoId" [opcoes]="cargos()" placeholder="Selecione" />
      </ce-form-field>
      <ce-form-field rotulo="Valor da diária" [obrigatorio]="true">
        <ce-money-input formControlName="valorDiaria" [zeroComoValor]="true" />
      </ce-form-field>
      <ce-checkbox formControlName="semDiaria">Sem diária</ce-checkbox>
      <ce-checkbox formControlName="ativo">Ativo</ce-checkbox>
      @if (erroCargos()) {
        <p class="erro" role="alert">Não foi possível carregar os cargos.</p>
      }
      @if (erro(); as msg) {
        <p class="erro" role="alert">{{ msg }}</p>
      }
    </form>
  `,
  styles: `
    form {
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-4);
    }

    .erro {
      margin: 0;
      padding: var(--ce-space-3);
      border: 1px solid var(--ce-danger);
      border-radius: var(--ce-radius-controle);
      color: var(--ce-danger);
    }
  `,
})
export class FuncionarioForm {
  private readonly api = inject(RhApi);

  /** Funcionário a editar; null/ausente é criação. */
  readonly inicial = input<FuncionarioResponse | null>(null);
  readonly erro = input<string | null>(null);
  /** Envio em andamento: desabilita o submitter oculto (Enter repetido). */
  readonly salvando = input(false);
  readonly salvar = output<CreateFuncionarioRequest>();

  protected readonly cargos = signal<SelectOpcao[]>([]);
  protected readonly erroCargos = signal(false);

  protected readonly form = new FormGroup({
    nome: new FormControl('', { nonNullable: true }),
    telefone: new FormControl('', { nonNullable: true }),
    cargoId: new FormControl<string | null>(null),
    valorDiaria: new FormControl<number | null>(null),
    semDiaria: new FormControl(false, { nonNullable: true }),
    ativo: new FormControl(true, { nonNullable: true }),
  });

  readonly valido = signal(false);

  constructor() {
    this.api
      .listarCargos()
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (l) => this.cargos.set(l.map((c) => ({ value: c.id, label: c.nome }))),
        error: () => this.erroCargos.set(true),
      });

    // Diária 0 vem de 'Sem diária' ou de digitar 0 (zeroComoValor); campo vazio continua null e inválido
    this.form.controls.semDiaria.valueChanges.pipe(takeUntilDestroyed()).subscribe((marcado) => {
      const diaria = this.form.controls.valorDiaria;
      if (marcado) {
        diaria.setValue(0);
        diaria.disable();
      } else {
        diaria.enable();
        diaria.setValue(null);
      }
    });
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.atualizarValido());

    effect(() => {
      const f = this.inicial();
      untracked(() => this.preencher(f));
    });
  }

  enviar(): void {
    if (!this.valido()) {
      return;
    }
    // getRawValue inclui a diária desabilitada ('Sem diária' → 0)
    const v = this.form.getRawValue();
    this.salvar.emit({
      nome: v.nome.trim(),
      telefone: v.telefone.trim() || null,
      cargoId: v.cargoId!,
      valorDiaria: v.valorDiaria!,
      ativo: v.ativo,
    });
  }

  private preencher(f: FuncionarioResponse | null): void {
    const semDiaria = f !== null && f.valorDiaria === 0;
    this.form.controls.valorDiaria.enable({ emitEvent: false });
    this.form.reset(
      {
        nome: f?.nome ?? '',
        telefone: f?.telefone ?? '',
        cargoId: f?.cargoId ?? null,
        valorDiaria: f?.valorDiaria ?? null,
        semDiaria,
        ativo: f?.ativo ?? true,
      },
      { emitEvent: false },
    );
    if (semDiaria) {
      this.form.controls.valorDiaria.disable({ emitEvent: false });
    }
    this.atualizarValido();
  }

  private atualizarValido(): void {
    const v = this.form.getRawValue();
    this.valido.set(v.nome.trim() !== '' && !!v.cargoId && diariaValida(v.valorDiaria));
  }
}
