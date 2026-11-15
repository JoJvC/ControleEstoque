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
import { CePermissao } from '../../core/permissions/ce-permissao';
import { Button } from '../../ui/atoms/button';
import { Checkbox } from '../../ui/atoms/checkbox';
import { Select, SelectOpcao } from '../../ui/atoms/select';
import { TextInput } from '../../ui/atoms/text-input';
import { FormField } from '../../ui/molecules/form-field';
import { MoneyInput } from '../../ui/molecules/money-input';

/** Diária 0 é válida (dono/ADM sem diária); vazia (null) e negativa não. */
export function diariaValida(v: number | null): boolean {
  return v !== null && v >= 0;
}

/** Formulário de funcionário, compartilhado pela criação (lista) e pela edição. */
@Component({
  selector: 'ce-funcionario-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    CePermissao,
    Button,
    Checkbox,
    Select,
    TextInput,
    FormField,
    MoneyInput,
  ],
  template: `
    <form [formGroup]="form" (ngSubmit)="enviar()">
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
        <ce-money-input formControlName="valorDiaria" />
      </ce-form-field>
      <ce-checkbox formControlName="semDiaria">Sem diária</ce-checkbox>
      <ce-checkbox formControlName="ativo">Ativo</ce-checkbox>
      @if (erroCargos()) {
        <p class="erro" role="alert">Não foi possível carregar os cargos.</p>
      }
      @if (erro(); as msg) {
        <p class="erro" role="alert">{{ msg }}</p>
      }
      <div class="acoes">
        <ce-button
          *cePermissao="'rh.gerir'"
          tipo="submit"
          [disabled]="!valido()"
          [loading]="salvando()"
        >
          Salvar
        </ce-button>
        <ng-content />
      </div>
    </form>
  `,
  styles: `
    form {
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-4);
    }

    .acoes {
      display: flex;
      gap: var(--ce-space-3);
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
  readonly salvando = input(false);
  readonly erro = input<string | null>(null);
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

  protected readonly valido = signal(false);

  constructor() {
    this.api
      .listarCargos()
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (l) => this.cargos.set(l.map((c) => ({ value: c.id, label: c.nome }))),
        error: () => this.erroCargos.set(true),
      });

    // 'Sem diária' é o único caminho para o 0: o ce-money-input emite null ao digitar só zeros
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

  protected enviar(): void {
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
