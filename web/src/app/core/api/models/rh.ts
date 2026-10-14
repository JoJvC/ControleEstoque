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
