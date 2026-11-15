using ControleEstoque.Shared.Results;

namespace ControleEstoque.Vendas.Domain;

public interface IVendaService
{
    Task<ResultadoVenda> CriarAsync(NovaVenda venda, CancellationToken cancellationToken);
    Task<ResultadoVenda> EditarAsync(Guid vendaId, NovaVenda venda, CancellationToken cancellationToken);
    Task<Venda> ObterAsync(Guid vendaId, CancellationToken cancellationToken);
    Task<IReadOnlyList<Venda>> ListarAsync(
        Guid? clienteId, DateOnly? inicio, DateOnly? fim, int page, int pageSize,
        CancellationToken cancellationToken);
    Task<ResultadoVenda> AdicionarPagamentoAsync(
        Guid vendaId, FormaPagamento forma, decimal valor, CancellationToken cancellationToken);
    Task<CupomFiscal> EmitirCupomAsync(Guid vendaId, CancellationToken cancellationToken);
}

public sealed class VendaService : IVendaService
{
    private readonly IVendaRepository vendas;
    private readonly IVendaLookup lookup;
    private readonly ICupomFiscalRepository cupons;

    public VendaService(IVendaRepository vendas, IVendaLookup lookup, ICupomFiscalRepository cupons)
    {
        this.vendas = vendas;
        this.lookup = lookup;
        this.cupons = cupons;
    }

    public async Task<ResultadoVenda> CriarAsync(NovaVenda venda, CancellationToken cancellationToken)
    {
        var gravacao = await MontarGravacaoAsync(Guid.NewGuid(), venda, cancellationToken);
        var gravado = await vendas.CriarAsync(gravacao, cancellationToken);
        return await ToResultadoAsync(gravacao, gravado, cancellationToken);
    }

    public async Task<ResultadoVenda> EditarAsync(
        Guid vendaId, NovaVenda venda, CancellationToken cancellationToken)
    {
        if (!await vendas.ExisteAsync(vendaId, cancellationToken))
        {
            throw new EntityNotFoundException("VENDA_NAO_ENCONTRADA", $"Venda {vendaId} não encontrada.");
        }

        // Decisão MVP: venda com cupom fiscal emitido não pode mais ser editada.
        if (await cupons.JaEmitidoAsync(vendaId, cancellationToken))
        {
            throw new BusinessRuleException(
                "VENDA_JA_FATURADA", "Venda com cupom fiscal emitido não pode ser editada.");
        }

        var gravacao = await MontarGravacaoAsync(vendaId, venda, cancellationToken);
        var gravado = await vendas.EditarAsync(gravacao, cancellationToken);
        return await ToResultadoAsync(gravacao, gravado, cancellationToken);
    }

    public async Task<Venda> ObterAsync(Guid vendaId, CancellationToken cancellationToken)
        => await vendas.GetAsync(vendaId, cancellationToken)
            ?? throw new EntityNotFoundException("VENDA_NAO_ENCONTRADA", $"Venda {vendaId} não encontrada.");

    public Task<IReadOnlyList<Venda>> ListarAsync(
        Guid? clienteId, DateOnly? inicio, DateOnly? fim, int page, int pageSize,
        CancellationToken cancellationToken)
    {
        Validacao.Periodo(inicio, fim);
        return vendas.ListAsync(clienteId, inicio, fim, Math.Max(1, page), Math.Clamp(pageSize, 1, 200),
            cancellationToken);
    }

    public async Task<ResultadoVenda> AdicionarPagamentoAsync(
        Guid vendaId, FormaPagamento forma, decimal valor, CancellationToken cancellationToken)
    {
        Validacao.EnumDefinido(forma, "Forma");
        if (valor <= 0)
        {
            throw new RequestValidationException("PAGAMENTO_INVALIDO", "Valor de pagamento deve ser positivo.");
        }

        var info = await vendas.GetInfoPagamentoAsync(vendaId, cancellationToken)
            ?? throw new EntityNotFoundException("VENDA_NAO_ENCONTRADA", $"Venda {vendaId} não encontrada.");

        if (info.TotalPago + valor > info.TotalLiquido)
        {
            throw new BusinessRuleException(
                "PAGAMENTO_EXCEDE_SALDO",
                $"Pagamento de {valor:F2} excede o saldo restante de {info.TotalLiquido - info.TotalPago:F2}.");
        }

        // A garantia é do repositório (trava da venda); os totais do resultado são os lidos sob a trava.
        var travado = await vendas.AddPagamentoAsync(vendaId, forma, valor, cancellationToken);
        var novoStatus = VendaCalculos.CalcularStatus(travado.TotalLiquido, travado.TotalPago + valor);

        var venda = await ObterAsync(vendaId, cancellationToken);
        var saldoCasco = await vendas.GetSaldoCascoClienteAsync(venda.ClienteId, cancellationToken);
        return new ResultadoVenda(
            venda.Id, venda.TotalBruto, venda.TotalDesconto, venda.TotalLiquido,
            travado.TotalPago + valor, travado.TotalLiquido - travado.TotalPago - valor, novoStatus, saldoCasco);
    }

    public async Task<CupomFiscal> EmitirCupomAsync(Guid vendaId, CancellationToken cancellationToken)
    {
        if (!await vendas.ExisteAsync(vendaId, cancellationToken))
        {
            throw new EntityNotFoundException("VENDA_NAO_ENCONTRADA", $"Venda {vendaId} não encontrada.");
        }

        if (await cupons.JaEmitidoAsync(vendaId, cancellationToken))
        {
            throw new ConflictException("CUPOM_JA_EMITIDO", "Cupom fiscal já emitido para esta venda.");
        }

        return await cupons.EmitirAsync(vendaId, cancellationToken);
    }

    /// <summary>Valida o comando, resolve lookups e monta o modelo de gravação com os efeitos da venda.</summary>
    private async Task<VendaGravacao> MontarGravacaoAsync(
        Guid vendaId, NovaVenda venda, CancellationToken cancellationToken)
    {
        Validacao.IdPreenchido(venda.ClienteId, "ClienteId");
        Validacao.IdPreenchido(venda.FuncionarioId, "FuncionarioId");
        foreach (var item in venda.Itens)
        {
            Validacao.IdPreenchido(item.ProdutoId, "ProdutoId");
            Validacao.IdPreenchido(item.MarcaId, "MarcaId");
        }

        foreach (var casco in venda.CascosDevolvidos.Concat(venda.SucataEntregue))
        {
            Validacao.IdPreenchido(casco.TipoCascoId, "TipoCascoId");
            if (casco.Quantidade <= 0)
            {
                throw new RequestValidationException(
                    "QUANTIDADE_INVALIDA", "Devoluções e entregas de casco devem ter quantidade positiva.");
            }
        }

        if (!await lookup.ClienteExisteAsync(venda.ClienteId, cancellationToken))
        {
            throw new EntityNotFoundException(
                "CLIENTE_NAO_ENCONTRADO", $"Cliente {venda.ClienteId} não encontrado.");
        }

        if (!await lookup.FuncionarioExisteAsync(venda.FuncionarioId, cancellationToken))
        {
            throw new EntityNotFoundException(
                "FUNCIONARIO_NAO_ENCONTRADO", $"Funcionário {venda.FuncionarioId} não encontrado.");
        }

        if (venda.EnderecoEntregaId is { } enderecoId
            && !await lookup.EnderecoPertenceAoClienteAsync(enderecoId, venda.ClienteId, cancellationToken))
        {
            throw new BusinessRuleException(
                "ENDERECO_NAO_PERTENCE_AO_CLIENTE", "Endereço de entrega não pertence ao cliente.");
        }

        var pares = venda.Itens.Select(i => (i.ProdutoId, i.MarcaId)).Distinct().ToList();
        var produtos = await lookup.GetProdutosAsync(pares, cancellationToken);
        foreach (var par in pares)
        {
            if (!produtos.ContainsKey(par))
            {
                throw new EntityNotFoundException(
                    "PRODUTO_MARCA_NAO_ENCONTRADO",
                    $"Produto {par.ProdutoId} com a marca {par.MarcaId} não encontrado.");
            }
        }

        // O casco da linha vem só da função pura (o específico da marca vence o genérico do produto).
        var cascoDoPar = pares.ToDictionary(
            par => par,
            par => RegrasCasco.Resolver(
                produtos[par].Tipo, produtos[par].TipoCascoProdutoId, produtos[par].TipoCascoMarcaId));
        foreach (var item in venda.Itens)
        {
            var produto = produtos[(item.ProdutoId, item.MarcaId)];
            if (item.PagouVasilhame && produto.Tipo == TipoProduto.DESCARTAVEL)
            {
                throw new BusinessRuleException(
                    "VASILHAME_EM_DESCARTAVEL", $"'{produto.Nome}' é descartável e não tem vasilhame.");
            }

            if (produto.Tipo == TipoProduto.RETORNAVEL && cascoDoPar[(item.ProdutoId, item.MarcaId)] is null)
            {
                throw new InvalidOperationException($"Produto retornável {produto.Nome} sem tipo de casco.");
            }
        }

        var tipos = await lookup.GetTiposCascoAsync(
            cascoDoPar.Values.OfType<Guid>().Distinct().ToList(), cancellationToken);
        var totais = VendaCalculos.Calcular(venda.Itens, venda.Pagamentos, item =>
        {
            var par = (item.ProdutoId, item.MarcaId);
            var tipoCascoId = cascoDoPar[par];
            return new ItemResolvido(
                produtos[par].ProdutoMarcaId, tipoCascoId, tipoCascoId is { } id ? tipos[id].PrecoVasilhame : 0m);
        });

        // Troca (padrão) empresta a quantidade no tipo da linha; pagou o vasilhame não gera empréstimo.
        var emprestimos = SomarPorTipo(totais.Itens
            .Where(i => i.TipoCascoId is not null && !i.PagouVasilhame)
            .Select(i => new CascoQuantidade(i.TipoCascoId!.Value, i.Quantidade)));

        // Devolução e sucata só valem para o tipo resolvido de alguma linha retornável da venda.
        var tiposDaVenda = cascoDoPar.Values.OfType<Guid>().ToHashSet();
        var devolvidos = SomarPorTipo(venda.CascosDevolvidos);
        var sucata = SomarPorTipo(venda.SucataEntregue);
        foreach (var casco in devolvidos.Concat(sucata))
        {
            if (!tiposDaVenda.Contains(casco.TipoCascoId))
            {
                throw new BusinessRuleException(
                    "TIPO_CASCO_FORA_DA_VENDA",
                    $"O tipo de casco {casco.TipoCascoId} não é de nenhum item retornável da venda.");
            }
        }

        foreach (var casco in sucata)
        {
            if (!tipos[casco.TipoCascoId].AceitaSucata)
            {
                throw new BusinessRuleException(
                    "SUCATA_NAO_ACEITA", $"O tipo de casco {casco.TipoCascoId} não aceita sucata.");
            }
        }

        return new VendaGravacao(
            vendaId, venda.ClienteId, venda.FuncionarioId, venda.EnderecoEntregaId, venda.Observacao,
            totais.TotalBruto, totais.TotalDesconto, totais.TotalLiquido, totais.Status,
            totais.Itens, venda.Pagamentos,
            emprestimos, devolvidos, sucata,
            totais.Faltante);
    }

    private static IReadOnlyList<CascoQuantidade> SomarPorTipo(IEnumerable<CascoQuantidade> cascos) =>
        cascos
            .GroupBy(c => c.TipoCascoId)
            .Select(g => new CascoQuantidade(g.Key, g.Sum(c => c.Quantidade)))
            .ToList();

    /// <summary>A checagem de saldo é do repositório (atômica, na transação); aqui só vira exceção.</summary>
    private async Task<ResultadoVenda> ToResultadoAsync(
        VendaGravacao gravacao, ResultadoGravacao gravado, CancellationToken cancellationToken)
    {
        if (gravado.Falta is { } falta)
        {
            // Falta.ProdutoId é o id da associação produto+marca.
            var item = gravacao.Itens.First(i => i.ProdutoMarcaId == falta.ProdutoId);
            var nome = (await lookup.GetProdutosAsync([(item.ProdutoId, item.MarcaId)], cancellationToken))
                .TryGetValue((item.ProdutoId, item.MarcaId), out var produto)
                    ? produto.Nome : falta.ProdutoId.ToString();
            throw new InsufficientStockException(
                $"Estoque de '{nome}' ({falta.Saldo}) insuficiente para vender {falta.Solicitado}.");
        }

        return new ResultadoVenda(
            gravacao.VendaId, gravacao.TotalBruto, gravacao.TotalDesconto, gravacao.TotalLiquido,
            gravacao.TotalLiquido - gravacao.DebitoFiado, gravacao.DebitoFiado, gravacao.Status,
            gravado.SaldoCascoPorTipo);
    }
}
