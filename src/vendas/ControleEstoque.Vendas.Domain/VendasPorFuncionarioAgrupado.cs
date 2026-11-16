namespace ControleEstoque.Vendas.Domain;

/// <summary>
/// Atribuição das vendas do período aos funcionários. Balcão: credita vendas.funcionario_id (1 venda). Venda de
/// Pedido: credita a entrega inteira a cada funcionário do pedido (1 entrega); sem funcionários no pedido, a
/// entrega vai para vendas.funcionario_id. Os totais somam cada venda uma vez só.
/// </summary>
public static class VendasPorFuncionarioAgrupado
{
    public static RelatorioVendasPorFuncionario Montar(
        DateOnly? inicio, DateOnly? fim, IReadOnlyList<VendaParaRelatorio> vendas)
    {
        var porFuncionario = new Dictionary<Guid, Acumulado>();
        foreach (var venda in vendas)
        {
            var credito = !venda.DePedido ? [venda.Funcionario]
                : venda.FuncionariosPedido.Count > 0 ? venda.FuncionariosPedido.DistinctBy(f => f.Id).ToList()
                : [venda.Funcionario];
            foreach (var funcionario in credito)
            {
                if (!porFuncionario.TryGetValue(funcionario.Id, out var acumulado))
                {
                    acumulado = porFuncionario[funcionario.Id] = new Acumulado(funcionario.Nome);
                }

                acumulado.Somar(venda);
            }
        }

        var funcionarios = porFuncionario
            .Select(par => par.Value.Resumir(par.Key))
            .OrderByDescending(f => f.TotalLiquido)
            .ThenBy(f => f.Nome, StringComparer.CurrentCultureIgnoreCase)
            .ToList();
        var totais = new TotaisVendasPorFuncionario(
            vendas.LongCount(v => !v.DePedido), vendas.LongCount(v => v.DePedido), vendas.Sum(v => v.TotalLiquido));
        return new RelatorioVendasPorFuncionario(inicio, fim, totais, funcionarios);
    }

    // A tela mostra a marca 'Genérica' como 'sem marca' (ehMarcaGenerica no front): a ordem segue o que aparece.
    private static string RotuloMarca(string marcaNome) =>
        string.Equals(marcaNome.Trim(), "Genérica", StringComparison.CurrentCultureIgnoreCase)
        || string.Equals(marcaNome.Trim(), "Generica", StringComparison.CurrentCultureIgnoreCase)
            ? "sem marca"
            : marcaNome;

    private sealed class Acumulado(string nome)
    {
        private readonly Dictionary<(Guid, Guid), ItemVendaRelatorio> produtos = [];
        private readonly Dictionary<Guid, VasilhameVendaRelatorio> vasilhames = [];
        private long vendas;
        private long entregas;
        private decimal totalLiquido;
        private decimal descontoSucata;

        public void Somar(VendaParaRelatorio venda)
        {
            if (venda.DePedido)
            {
                entregas++;
            }
            else
            {
                vendas++;
            }

            totalLiquido += venda.TotalLiquido;
            descontoSucata += venda.DescontoSucata;
            foreach (var item in venda.Itens)
            {
                var chave = (item.ProdutoId, item.MarcaId);
                produtos[chave] = produtos.TryGetValue(chave, out var atual)
                    ? atual with { Quantidade = atual.Quantidade + item.Quantidade, Total = atual.Total + item.Total }
                    : item;
            }

            foreach (var vasilhame in venda.Vasilhames)
            {
                vasilhames[vasilhame.TipoCascoId] = vasilhames.TryGetValue(vasilhame.TipoCascoId, out var atual)
                    ? atual with { Quantidade = atual.Quantidade + vasilhame.Quantidade, Total = atual.Total + vasilhame.Total }
                    : vasilhame;
            }
        }

        public ResumoFuncionarioVendas Resumir(Guid id)
        {
            var linhas = produtos.Values
                .OrderBy(p => p.ProdutoNome, StringComparer.CurrentCultureIgnoreCase)
                .ThenBy(p => RotuloMarca(p.MarcaNome), StringComparer.CurrentCultureIgnoreCase)
                .Select(p => new LinhaRelatorioFuncionario(
                    "PRODUTO", p.ProdutoId, p.ProdutoNome, p.MarcaId, p.MarcaNome, null, null, p.Quantidade, p.Total))
                .Concat(vasilhames.Values
                    .OrderBy(v => v.TipoCascoNome, StringComparer.CurrentCultureIgnoreCase)
                    .Select(v => new LinhaRelatorioFuncionario(
                        "VASILHAME", null, null, null, null, v.TipoCascoId, v.TipoCascoNome, v.Quantidade, v.Total)))
                .ToList();
            return new ResumoFuncionarioVendas(id, nome, vendas, entregas, totalLiquido, descontoSucata, linhas);
        }
    }
}
