import { TipoCascoResponse } from '../../core/api/models/estoque';
import { marcaResp, produtoResp } from '../../core/api/testing';
import { textoDoTrilho } from '../../ui/organisms/passo-a-passo';
import { vasilhameNovo } from './carrinho';
import { ROTULO_PASSO, passosDaVenda, podeAvancarPasso } from './passos-venda';
import { itemCarrinho } from './testing';

const TIPO: TipoCascoResponse = {
  id: 't-1',
  nome: 'Casco 20L',
  marcaId: null,
  marca: null,
  precoVasilhame: 30,
  aceitaSucata: true,
};

const retornavel = (tipoCascoResolvidoId: string | null) =>
  itemCarrinho({
    produto: produtoResp({
      tipo: 'RETORNAVEL',
      marcas: [marcaResp({ tipoCascoResolvidoId })],
    }),
  });
const descartavel = itemCarrinho({ produto: produtoResp({ tipo: 'DESCARTAVEL' }) });

describe('passosDaVenda', () => {
  it('só descartáveis: itens e pagamento (2 passos)', () => {
    expect(passosDaVenda([descartavel], [])).toEqual(['itens', 'pagamento']);
  });

  it('retornável com tipo de casco resolvido: 3 passos', () => {
    expect(passosDaVenda([retornavel('t-1')], [])).toEqual(['itens', 'cascos', 'pagamento']);
  });

  it('só com vasilhame comprado: 3 passos', () => {
    expect(passosDaVenda([], [vasilhameNovo(TIPO, 1)])).toEqual(['itens', 'cascos', 'pagamento']);
  });

  it('retornável sem tipo de casco resolvido: 2 passos', () => {
    expect(passosDaVenda([retornavel(null)], [])).toEqual(['itens', 'pagamento']);
  });

  it('o trilho conta só os passos ativos', () => {
    const rotulos = (passos: ReturnType<typeof passosDaVenda>) =>
      passos.map((p) => ROTULO_PASSO[p]);
    const tres = rotulos(passosDaVenda([retornavel('t-1')], []));
    expect(textoDoTrilho(tres, 0)).toBe('1 de 3 · Cliente e produtos');
    expect(textoDoTrilho(tres, 1)).toBe('2 de 3 · Cascos');
    const dois = rotulos(passosDaVenda([descartavel], []));
    expect(textoDoTrilho(dois, 0)).toBe('1 de 2 · Cliente e produtos');
    expect(textoDoTrilho(dois, 1)).toBe('2 de 2 · Pagamento');
  });
});

describe('podeAvancarPasso', () => {
  const ok = { carrinhoVazio: false, enderecoOk: true, sucataExcede: false };

  it('falso com carrinho vazio ou sem cliente/endereço; sucata acima do total só bloqueia cascos e pagamento', () => {
    expect(podeAvancarPasso('itens', ok)).toBe(true);
    expect(podeAvancarPasso('itens', { ...ok, carrinhoVazio: true })).toBe(false);
    expect(podeAvancarPasso('itens', { ...ok, enderecoOk: false })).toBe(false);
    // do passo 1 sempre dá para ir ao passo 2 corrigir a sucata
    expect(podeAvancarPasso('itens', { ...ok, sucataExcede: true })).toBe(true);
    expect(podeAvancarPasso('pagamento', { ...ok, sucataExcede: true })).toBe(false);
    expect(podeAvancarPasso('pagamento', ok)).toBe(true);
  });

  it('o passo de cascos só bloqueia com sucata acima do total (o aviso aparece ali)', () => {
    expect(podeAvancarPasso('cascos', ok)).toBe(true);
    expect(podeAvancarPasso('cascos', { ...ok, sucataExcede: true })).toBe(false);
  });
});
