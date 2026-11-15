import { MarcaResponse, TipoCascoResponse } from '../../core/api/models/estoque';
import { marcaResp, produtoResp } from '../../core/api/testing';
import {
  FormProduto,
  SEM_MARCA,
  aoTrocarTipo,
  cascoEfetivo,
  cascosDaMarca,
  cascosGenericos,
  formDe,
  linhaAlterada,
  marcaGenericaDe,
  montarMarca,
  montarProduto,
  novaLinha,
  novoForm,
  opcoesDeMarca,
  temErros,
  validarProduto,
} from './produto-form-modelo';

const form = (p: Partial<FormProduto> = {}): FormProduto => ({
  id: null,
  tipo: 'RETORNAVEL',
  nome: 'Água 20L',
  categoria: '',
  tamanho: '',
  tipoCascoId: 'c-gen',
  linhas: [novaLinha({ marcaId: 'm1', preco: 12, minimo: '5' })],
  ...p,
});

const casco = (id: string, marcaId: string | null): TipoCascoResponse => ({
  id,
  nome: id,
  marcaId,
  marca: null,
  precoVasilhame: 10,
  aceitaSucata: false,
});

const marca = (id: string, nome: string): MarcaResponse => ({ id, nome });

describe('validarProduto', () => {
  it('formulário completo não tem erros', () => {
    expect(temErros(validarProduto(form()))).toBe(false);
  });

  it('nome obrigatório', () => {
    expect(validarProduto(form({ nome: '  ' })).nome).toBeDefined();
  });

  it('Retornável exige casco genérico; Descartável ignora', () => {
    expect(validarProduto(form({ tipoCascoId: null })).casco).toBeDefined();
    expect(validarProduto(form({ tipo: 'DESCARTAVEL', tipoCascoId: null })).casco).toBeUndefined();
  });

  it('linha exige marca, preço válido e mínimo inteiro >= 0', () => {
    const e = validarProduto(
      form({ linhas: [novaLinha({ marcaId: null, preco: null, minimo: '' })] }),
    ).linhas[0];
    expect(e.marca).toBeDefined();
    expect(e.preco).toBeDefined();
    expect(e.minimo).toBeDefined();
    for (const minimo of ['-1', '1.5', 'a']) {
      const l = validarProduto(form({ linhas: [novaLinha({ marcaId: 'm1', preco: 1, minimo })] }));
      expect(l.linhas[0].minimo).toBeDefined();
    }
    const zero = validarProduto(
      form({ linhas: [novaLinha({ marcaId: 'm1', preco: 0, minimo: '0' })] }),
    );
    expect(temErros(zero)).toBe(false);
  });

  it('"Sem marca" conta como marca escolhida', () => {
    const e = validarProduto(
      form({ linhas: [novaLinha({ marcaId: SEM_MARCA, preco: 1, minimo: '0' })] }),
    );
    expect(temErros(e)).toBe(false);
  });

  it('marca repetida é erro, inclusive duas linhas "Sem marca"', () => {
    for (const id of ['m1', SEM_MARCA]) {
      const linha = () => novaLinha({ marcaId: id, preco: 1, minimo: '0' });
      const e = validarProduto(form({ linhas: [linha(), linha()] })).linhas;
      expect(e[0].marca).toBeUndefined();
      expect(e[1].marca).toBe('Marca repetida.');
    }
  });

  it('foto: só .jpg/.jpeg/.png de 1 byte a 5 MB', () => {
    const com = (foto: File) =>
      validarProduto(form({ linhas: [novaLinha({ marcaId: 'm1', preco: 1, minimo: '0', foto })] }))
        .linhas[0].foto;
    expect(com(new File(['x'], 'a.PNG'))).toBeUndefined();
    expect(com(new File(['x'], 'a.jpeg'))).toBeUndefined();
    expect(com(new File(['x'], 'a.gif'))).toBeDefined();
    expect(com(new File([], 'a.png'))).toBeDefined();
    expect(com(new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'a.png'))).toBeDefined();
    expect(com(new File([new Uint8Array(5 * 1024 * 1024)], 'a.png'))).toBeUndefined();
  });
});

describe('montarProduto / montarMarca', () => {
  it('Retornável leva o casco genérico e apara textos', () => {
    expect(montarProduto(form({ nome: ' Água ', tamanho: ' 20L ' }))).toEqual({
      tipo: 'RETORNAVEL',
      nome: 'Água',
      categoria: null,
      tamanho: '20L',
      tipoCascoId: 'c-gen',
    });
  });

  it('Descartável sai com tipoCascoId nulo no produto e na marca', () => {
    const f = form({ tipo: 'DESCARTAVEL' });
    expect(montarProduto(f).tipoCascoId).toBeNull();
    const l = novaLinha({ marcaId: 'm1', preco: 3, minimo: '2', tipoCascoId: 'c-esp' });
    expect(montarMarca(l, 'DESCARTAVEL')).toEqual({
      marcaId: 'm1',
      precoReferencia: 3,
      estoqueMinimo: 2,
      tipoCascoId: null,
    });
    expect(montarMarca(l, 'RETORNAVEL').tipoCascoId).toBe('c-esp');
  });

  it('linha "Sem marca" usa o id da Genérica', () => {
    const l = novaLinha({ marcaId: SEM_MARCA, preco: 1, minimo: '0' });
    expect(montarMarca(l, 'DESCARTAVEL', 'g1').marcaId).toBe('g1');
    expect(() => montarMarca(l, 'DESCARTAVEL')).toThrow();
  });
});

describe('cascos', () => {
  const tipos = [casco('gen', null), casco('esp1', 'm1'), casco('esp2', 'm2')];

  it('cascosGenericos e cascosDaMarca filtram por marcaId', () => {
    expect(cascosGenericos(tipos).map((t) => t.id)).toEqual(['gen']);
    expect(cascosDaMarca(tipos, 'm1').map((t) => t.id)).toEqual(['esp1']);
    expect(cascosDaMarca(tipos, null)).toEqual([]);
  });

  it('cascoEfetivo: específico vence o genérico', () => {
    expect(cascoEfetivo({ tipoCascoId: 'esp1' }, 'gen')).toBe('esp1');
    expect(cascoEfetivo({ tipoCascoId: null }, 'gen')).toBe('gen');
    expect(cascoEfetivo({ tipoCascoId: null }, null)).toBeNull();
  });
});

describe('Sem marca', () => {
  it('opcoesDeMarca: "Sem marca" primeiro e sem a Genérica', () => {
    const o = opcoesDeMarca([
      marca('m1', 'Indaiá'),
      marca('g', 'Genérica'),
      marca('m2', 'Crystal'),
    ]);
    expect(o.map((x) => x.label)).toEqual(['Sem marca', 'Indaiá', 'Crystal']);
    expect(o[0].value).toBe(SEM_MARCA);
  });

  it('marcaGenericaDe acha as variantes e devolve null sem ela', () => {
    for (const nome of ['Genérica', 'generica', 'GENÉRICA', ' Genérica ']) {
      expect(marcaGenericaDe([marca('m1', 'Indaiá'), marca('g', nome)])?.id).toBe('g');
    }
    expect(marcaGenericaDe([marca('m1', 'Indaiá')])).toBeNull();
  });

  it('aoTrocarTipo: novo Descartável sem linhas ganha a linha "Sem marca" com mínimo 0', () => {
    const f = aoTrocarTipo(form({ linhas: [] }), 'DESCARTAVEL');
    expect(f.linhas).toHaveLength(1);
    expect(f.linhas[0]).toMatchObject({ marcaId: SEM_MARCA, preco: null, minimo: '0' });
  });

  it('aoTrocarTipo: com linhas, na edição ou voltando a Retornável, nada muda', () => {
    const com = form();
    expect(aoTrocarTipo(com, 'DESCARTAVEL').linhas).toBe(com.linhas);
    const edicao = form({ id: 'p1', linhas: [] });
    expect(aoTrocarTipo(edicao, 'DESCARTAVEL').linhas).toEqual([]);
    const volta = aoTrocarTipo(aoTrocarTipo(form({ linhas: [] }), 'DESCARTAVEL'), 'RETORNAVEL');
    expect(volta.linhas).toHaveLength(1);
  });

  it('novoForm abre Descartável com a linha "Sem marca"', () => {
    const f = novoForm();
    expect(f.tipo).toBe('DESCARTAVEL');
    expect(f.linhas.map((l) => l.marcaId)).toEqual([SEM_MARCA]);
  });

  it('linha nova, inclusive a "Sem marca" inicial, começa com estoque mínimo 0', () => {
    expect(novaLinha().minimo).toBe('0');
    expect(novoForm().linhas[0].minimo).toBe('0');
    expect(validarProduto(novoForm()).linhas[0].minimo).toBeUndefined();
  });
});

describe('formDe / linhaAlterada', () => {
  const produto = produtoResp({
    id: 'p1',
    tipoCascoId: 'gen',
    marcas: [
      marcaResp({ id: 'pm1', marcaId: 'm1', precoReferencia: 12, estoqueMinimo: 5, fotoUrl: '/f' }),
      marcaResp({ id: 'pm2', marcaId: 'g', marcaNome: 'GENÉRICA' }),
    ],
  });

  it('pré-preenche; a Genérica abre como "Sem marca"; foto vira URL da associação', () => {
    const f = formDe(produto, (id) => `/foto/${id}`);
    expect(f.id).toBe('p1');
    expect(f.linhas.map((l) => l.marcaId)).toEqual(['m1', SEM_MARCA]);
    expect(f.linhas[0]).toMatchObject({
      preco: 12,
      minimo: '5',
      produtoMarcaId: 'pm1',
      fotoSrc: '/foto/pm1',
    });
    expect(f.linhas[1].fotoSrc).toBeNull();
  });

  it('linhaAlterada: só quando um valor muda; linha nova sempre', () => {
    const l = formDe(produto, () => '').linhas[0];
    expect(linhaAlterada(l, 'RETORNAVEL')).toBe(false);
    expect(linhaAlterada({ ...l, preco: 13 }, 'RETORNAVEL')).toBe(true);
    expect(linhaAlterada({ ...l, tipoCascoId: 'esp' }, 'RETORNAVEL')).toBe(true);
    expect(linhaAlterada(novaLinha(), 'RETORNAVEL')).toBe(true);
  });

  it('linhaAlterada: em Descartável, casco específico salvo conta como alterado (sai nulo)', () => {
    const f = formDe(
      produtoResp({ id: 'p1', marcas: [marcaResp({ id: 'pm1', tipoCascoId: 'esp' })] }),
      () => '',
    );
    const desc = aoTrocarTipo(f, 'DESCARTAVEL');
    expect(linhaAlterada(desc.linhas[0], desc.tipo)).toBe(true);
    expect(linhaAlterada(formDe(produto, () => '').linhas[0], 'DESCARTAVEL')).toBe(false);
  });
});
