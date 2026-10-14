import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { SheetService } from '../../core/overlay/sheet-service';
import { ToastService } from '../../core/toast/toast-service';
import { Avatar } from '../../ui/atoms/avatar';
import { Badge } from '../../ui/atoms/badge';
import { Button } from '../../ui/atoms/button';
import { Checkbox } from '../../ui/atoms/checkbox';
import { Divider } from '../../ui/atoms/divider';
import { Icon } from '../../ui/atoms/icon';
import { Select } from '../../ui/atoms/select';
import { Skeleton } from '../../ui/atoms/skeleton';
import { Spinner } from '../../ui/atoms/spinner';
import { TextInput } from '../../ui/atoms/text-input';
import { EmptyState } from '../../ui/molecules/empty-state';
import { FormField } from '../../ui/molecules/form-field';
import { ListItem } from '../../ui/molecules/list-item';
import { MoneyInput } from '../../ui/molecules/money-input';
import { QuantityStepper } from '../../ui/molecules/quantity-stepper';
import { SaldoChip } from '../../ui/molecules/saldo-chip';
import { SearchBox } from '../../ui/molecules/search-box';
import { AppHeader } from '../../ui/organisms/app-header';
import { DataList } from '../../ui/organisms/data-list';
import { ItemVendaCard } from '../../ui/organisms/item-venda-card';
import { PagamentoLista, PagamentoEdicao } from '../../ui/organisms/pagamento-lista';
import { PrecoPipe } from '../../ui/pipes/preco-pipe';

/** Vitrine do design system — rota /dev/ui, registrada apenas em dev mode. */
@Component({
  selector: 'ce-ui-showcase-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    Avatar,
    Badge,
    Button,
    Checkbox,
    Divider,
    Icon,
    Select,
    Skeleton,
    Spinner,
    TextInput,
    EmptyState,
    FormField,
    ListItem,
    MoneyInput,
    QuantityStepper,
    SaldoChip,
    SearchBox,
    AppHeader,
    DataList,
    ItemVendaCard,
    PagamentoLista,
    PrecoPipe,
  ],
  templateUrl: './ui-showcase-page.html',
  styleUrl: './ui-showcase-page.scss',
})
export class UiShowcasePage {
  private readonly toast = inject(ToastService);
  private readonly sheet = inject(SheetService);

  protected readonly texto = new FormControl('');
  protected readonly dinheiro = new FormControl<number | null>(12.5);
  protected readonly quantidade = new FormControl(2, { nonNullable: true });
  protected readonly marcado = new FormControl(true, { nonNullable: true });
  protected readonly selecionado = new FormControl<string | null>(null);

  protected readonly opcoes = [
    { value: '20l', label: 'Galão 20L' },
    { value: '10l', label: 'Galão 10L' },
  ];

  protected readonly itensDemo = ['Água Marca A 20L', 'Água Marca B 10L', 'Carvão 5kg'];

  protected readonly pagamentosDemo = signal<readonly PagamentoEdicao[]>([
    { forma: 'PIX', valor: 200 },
  ]);

  protected ultimaBusca = '';

  protected mostrarToast(tipo: 'success' | 'error' | 'info'): void {
    if (tipo === 'error') {
      this.toast.error('Erro no servidor.', 'Código de suporte: abc123');
    } else if (tipo === 'success') {
      this.toast.success('Venda registrada!');
    } else {
      this.toast.info('Estoque baixo em 2 produtos.');
    }
  }

  protected async confirmarDemo(): Promise<void> {
    const ok = await this.sheet.confirmar({
      titulo: 'Excluir produto?',
      mensagem: 'Essa ação não pode ser desfeita.',
      confirmarLabel: 'Excluir',
      perigo: true,
    });
    this.toast.info(ok ? 'Confirmado.' : 'Cancelado.');
  }

  protected aoBuscar(termo: string): void {
    this.ultimaBusca = termo;
    this.toast.info(`Busca: "${termo}"`);
  }
}
