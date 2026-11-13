import { CargoResponse } from '../api/models/rh';

export function permissoesDoCargo(cargos: CargoResponse[], cargoId: string): string[] {
  return cargos.find((c) => c.id === cargoId)?.permissoes ?? [];
}
