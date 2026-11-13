import { CargoResponse } from '../api/models/rh';
import { permissoesDoCargo } from './permissoes-do-cargo';

const CARGOS: CargoResponse[] = [
  { id: 'c1', nome: 'ADM', nativo: true, permissoes: ['*'] },
  { id: 'c2', nome: 'Vendedor', nativo: false, permissoes: ['vendas.registrar'] },
];

describe('permissoesDoCargo', () => {
  it('devolve as permissões do cargo encontrado', () => {
    expect(permissoesDoCargo(CARGOS, 'c2')).toEqual(['vendas.registrar']);
  });

  it('cargo ausente devolve []', () => {
    expect(permissoesDoCargo(CARGOS, 'x')).toEqual([]);
  });
});
