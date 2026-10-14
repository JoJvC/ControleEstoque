// Espelho manual de src/clientes/ControleEstoque.Clientes.Contracts — não inventar campos.

export interface CreateClienteRequest {
  nome: string;
  telefone: string | null;
  observacoes: string | null;
}

export interface CreateEnderecoRequest {
  logradouro: string;
  numero: string | null;
  bairro: string | null;
  complemento: string | null;
  referencia: string | null;
  principal: boolean;
}

export interface EnderecoResponse {
  id: string;
  logradouro: string;
  numero: string | null;
  bairro: string | null;
  complemento: string | null;
  referencia: string | null;
  principal: boolean;
}

export interface ClienteResponse {
  id: string;
  nome: string;
  telefone: string | null;
  observacoes: string | null;
  enderecos: EnderecoResponse[];
}

export interface SaldosResponse {
  saldoCascos: number;
  sucataEntregue: number;
  saldoFiado: number;
}

export interface DevolucaoCascosRequest {
  quantidade: number;
}

export interface DevolucaoCascosResponse {
  novoSaldoCascos: number;
}

export interface ConversaoCascosRequest {
  quantidade: number;
  valorUnitario: number;
}

export interface ConversaoCascosResponse {
  novoSaldoCascos: number;
  novoSaldoFiado: number;
}

export interface EntregaSucataRequest {
  quantidade: number;
  valorConversao: number | null;
}

export interface EntregaSucataResponse {
  totalSucataEntregue: number;
  novoSaldoFiado: number;
}
