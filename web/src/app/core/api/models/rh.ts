// Espelho manual de src/rh/ControleEstoque.RH.Contracts/RHContracts.cs — não inventar campos.

export interface CargoResponse {
  id: string;
  nome: string;
  nativo: boolean;
  permissoes: string[];
}

export interface FuncionarioResponse {
  id: string;
  nome: string;
  telefone: string | null;
  cargoId: string;
  cargo: string | null;
  valorDiaria: number;
  ativo: boolean;
}

export interface CreateCargoRequest {
  nome: string;
  permissoes?: string[];
}

export interface CreateFuncionarioRequest {
  nome: string;
  telefone: string | null;
  cargoId: string;
  valorDiaria: number;
  ativo: boolean;
}

export type TipoLancamentoFuncionario = 'DIARIA' | 'VALE' | 'PAGAMENTO';

export interface LancamentoResponse {
  id: string;
  tipo: TipoLancamentoFuncionario;
  valor: number;
  data: string;
  observacao: string | null;
}

export interface ExtratoResponse {
  funcionarioId: string;
  saldoAPagar: number;
  lancamentos: LancamentoResponse[];
}

export interface LancamentoContaRequest {
  valor: number;
  observacao: string | null;
}

export interface SaldoContaResponse {
  saldoAPagar: number;
}
