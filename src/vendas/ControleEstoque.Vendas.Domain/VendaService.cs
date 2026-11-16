using ControleEstoque.Shared.Results;

namespace ControleEstoque.Vendas.Domain;

public interface IVendaService
{
    Task<ResultadoVenda> CriarAsync(NovaVenda venda, CancellationToken cancellationToken);
    Task<ResultadoVenda> EditarAsync(Guid vendaId, NovaVenda venda, CancellationToken cancellationToken);

    /// <summary>Cancela a venda; exige <c>vendas.cancelar</c> (ou <c>*</c>) e o caixa do dia da venda aberto.</summary>
    Task CancelarAsync(Guid vendaId, Guid funcionarioId, CancellationToken cancellationToken);
    Task<Venda> ObterAsync(Guid vendaId, CancellationToken cancellationToken);
    Task<IReadOnlyList<Venda>> ListarAsync(
        Guid? clienteId, DateOnly? inicio, DateOnly? fim, int page, int pageSize,
        CancellationToken cancellationToken);
    Task<ResultadoVenda> AdicionarPagamentoAsync(
        Guid vendaId, FormaPagamento forma, decimal valor, CancellationToken cancellationToken);
    Task<CupomFiscal> EmitirCupomAsync(Guid vendaId, CancellationToken cancellationToken);
    Task<UltimoPrecoVenda?> ObterUltimoPrecoAsync(
        Guid clienteId, Guid produtoId, Guid marcaId, CancellationToken cancellationToken);
}

public sealed class VendaService : IVendaService
{
    private readonly IVendaRepository vendas;
    private readonly IVendaLookup lookup;
    private readonly ICupomFiscalRepository cupons;
    private readonly IPermissaoFuncionarioLookup permissoes;
    private readonly TimeProvider relogio;

    public VendaService(
        IVendaRepository vendas, IVendaLookup lookup, ICupomFiscalRepository cupons,
        IPermissaoFuncionarioLookup permissoes, TimeProvider? relogio = null)
    {
        this.vendas = vendas;
        this.lookup = lookup;
        this.cupons = cupons;
        this.permissoes = permissoes;
        this.relogio = relogio ?? TimeProvider.System;
    }

    public async Task<ResultadoVenda> CriarAsync(NovaVenda venda, CancellationToken cancellationToken)
    {
        var gravacao = await MontarGravacaoAsync(Guid.NewGuid(), venda, cancellationToken);
        if (venda.CaixaId is { } caixaId)
        {
            Validacao.IdPreenchido(caixaId, "CaixaId");
            var caixa = await lookup.GetCaixaAsync(caixaId, cancellationToken)
                ?? throw new EntityNotFoundException("CAIXA_NAO_ENCONTRADO", $"Caixa {caixaId} não encontrado.");
            if (!caixa.Aberto)
            {
                throw new ConflictException("CAIXA_FECHADO", "Não é possível lançar venda em caixa fechado.");
            }

            // O repositório repete a checagem sob a trava do caixa.
            gravacao = gravacao with
            {
                CaixaId = caixaId,
                Instante = RelogioLancamento.InstanteDoLancamento(caixa.Data, relogio.GetUtcNow())
            };
        }

        var gravado = await vendas.CriarAsync(gravacao, cancellationToken);
        return await ToResultadoAsync(gravacao, gravado, cancellationToken);
    }

    public async Task<ResultadoVenda> EditarAsync(
        Guid vendaId, NovaVenda venda, CancellationToken cancellationToken)
    {
        var dataVenda = await vendas.GetDataAsync(vendaId, cancellationToken)
            ?? throw new EntityNotFoundException("VENDA_NAO_ENCONTRADA", $"Venda {vendaId} não encontrada.");

        // Decisão MVP: venda com cupom fiscal emitido não pode mais ser editada.
        if (await cupons.JaEmitidoAsync(vendaId, cancellationToken))
        {
            throw new BusinessRuleException(
                "VENDA_JA_FATURADA", "Venda com cupom fiscal emitido não pode ser editada.");
        }

        // Os efeitos reinseridos ficam com a data original da venda, não com a de hoje.
        var gravacao = await MontarGravacaoAsync(vendaId, venda, cancellationToken) with { Instante = dataVenda };
        var gravado = await vendas.EditarAsync(gravacao, cancellationToken);
        return await ToResultadoAsync(gravacao, gravado, cancellationToken);
    }

    public async Task CancelarAsync(Guid vendaId, Guid funcionarioId, CancellationToken cancellationToken)
    {
        await PermissoesVendas.ExigirCancelarAsync(permissoes, funcionarioId, cancellationToken);

        if (await vendas.GetDataAsync(vendaId, cancellationToken) is null)
        {
            throw new EntityNotFoundException("VENDA_NAO_ENCONTRADA", $"Venda {vendaId} não encontrada.");
        }

        // Mesma regra da edição: venda com cupom fiscal emitido não pode mais ser alterada.
        if (await cupons.JaEmitidoAsync(vendaId, cancellationToken))
        {
            throw new BusinessRuleException(
                "VENDA_JA_FATURADA", "Venda com cupom fiscal emitido não pode ser cancelada.");
        }

        // O caixa do dia da venda é conferido pelo repositório, sob a trava (CAIXA_FECHADO).
        await vendas.CancelarAsync(vendaId, funcionarioId, relogio.GetUtcNow(), cancellationToken);
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

        // Com saldo único, o crédito já abate o fiado no saldo do cliente: não há "pagar a venda com crédito".
        if (forma == FormaPagamento.CREDITO_CLIENTE)
        {
            throw new BusinessRuleException(
                "FORMA_NAO_PERMITIDA", "Crédito do cliente só pode ser usado ao registrar a venda.");
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
            venda.Id, venda.TotalBruto, venda.TotalDesconto, venda.DescontoSucata, venda.TotalLiquido,
            travado.TotalPago + valor, travado.TotalLiquido - travado.TotalPago - valor, 0m, novoStatus, saldoCasco);
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

    public Task<UltimoPrecoVenda?> ObterUltimoPrecoAsync(
        Guid clienteId, Guid produtoId, Guid marcaId, CancellationToken cancellationToken)
    {
        Validacao.IdPreenchido(clienteId, "ClienteId");
        Validacao.IdPreenchido(produtoId, "ProdutoId");
        Validacao.IdPreenchido(marcaId, "MarcaId");
        return vendas.GetUltimoPrecoAsync(clienteId, produtoId, marcaId, cancellationToken);
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

        foreach (var casco in venda.CascosDevolvidos)
        {
            Validacao.IdPreenchido(casco.TipoCascoId, "TipoCascoId");
            if (casco.Quantidade <= 0)
            {
                throw new RequestValidationException(
                    "QUANTIDADE_INVALIDA", "Devoluções de casco devem ter quantidade positiva.");
            }
        }

        foreach (var sucata in venda.SucataEntregue)
        {
            Validacao.IdPreenchido(sucata.TipoCascoId, "TipoCascoId");
        }

        VendaCalculos.DescontoSucata(venda.SucataEntregue); // SUCATA_INVALIDA antes de qualquer consulta

        foreach (var vasilhame in venda.Vasilhames)
        {
            Validacao.IdPreenchido(vasilhame.TipoCascoId, "TipoCascoId");
        }

        if (venda.Vasilhames.GroupBy(v => v.TipoCascoId).Any(g => g.Count() > 1))
        {
            throw new RequestValidationException(
                "TIPO_CASCO_DUPLICADO", "Cada tipo de casco aparece no máximo uma vez nos vasilhames.");
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
            if (produto.Tipo == TipoProduto.RETORNAVEL && cascoDoPar[(item.ProdutoId, item.MarcaId)] is null)
            {
                throw new InvalidOperationException($"Produto retornável {produto.Nome} sem tipo de casco.");
            }
        }

        // Tipos aceitos em devolução e sucata: o das linhas retornáveis e o dos vasilhames vendidos.
        var tiposDaVenda = cascoDoPar.Values.OfType<Guid>().Concat(venda.Vasilhames.Select(v => v.TipoCascoId))
            .ToHashSet();
        var tipos = await lookup.GetTiposCascoAsync(tiposDaVenda.ToList(), cancellationToken);
        if (venda.Vasilhames.FirstOrDefault(v => !tipos.ContainsKey(v.TipoCascoId)) is { } semTipo)
        {
            throw new EntityNotFoundException(
                "TIPO_CASCO_NAO_ENCONTRADO", $"Tipo de casco {semTipo.TipoCascoId} não encontrado.");
        }

        // Crédito de galão por tipo (na edição, sem os efeitos da própria venda) só para quem abate.
        var tiposAbate = venda.Vasilhames
            .Where(v => v.Modo == ModoCreditoVasilhame.ABATER_CREDITO).Select(v => v.TipoCascoId).ToList();
        var creditosCasco = tiposAbate.Count == 0
            ? new Dictionary<Guid, long>()
            : await lookup.GetCreditoCascoPorTipoAsync(venda.ClienteId, tiposAbate, vendaId, cancellationToken);
        var tiposConverter = venda.Vasilhames
            .Where(v => v.Modo == ModoCreditoVasilhame.CONVERTER_CASCO).Select(v => v.TipoCascoId).ToList();
        if (tiposConverter.Count > 0)
        {
            var devedores = await lookup.GetSaldoCascoPorTipoAsync(
                venda.ClienteId, tiposConverter, vendaId, cancellationToken);
            foreach (var v in venda.Vasilhames.Where(v => v.Modo == ModoCreditoVasilhame.CONVERTER_CASCO))
            {
                var saldo = devedores.GetValueOrDefault(v.TipoCascoId);
                if (v.Quantidade > saldo)
                {
                    throw new BusinessRuleException(
                        "CONVERSAO_MAIOR_QUE_SALDO",
                        $"Cliente deve {saldo} casco(s) do tipo {v.TipoCascoId}; não é possível converter {v.Quantidade}.");
                }
            }
        }

        var vasilhames = venda.Vasilhames
            .Select(v => VendaCalculos.CalcularVasilhame(v, creditosCasco.GetValueOrDefault(v.TipoCascoId)))
            .ToList();

        var totais = VendaCalculos.Calcular(
            venda.Itens, vasilhames, venda.SucataEntregue, venda.Pagamentos,
            item =>
            {
                var par = (item.ProdutoId, item.MarcaId);
                return new ItemResolvido(produtos[par].ProdutoMarcaId, cascoDoPar[par]);
            });

        var usoCredito = VendaCalculos.UsoCredito(venda.Pagamentos);
        if (usoCredito > 0)
        {
            VendaCalculos.ValidarUsoCredito(
                usoCredito, await lookup.GetCreditoDisponivelAsync(venda.ClienteId, vendaId, cancellationToken));
        }

        // G = galões cheios retornáveis do tipo, V = vasilhames vendidos: empresta max(0, G - V) e o excedente
        // max(0, V - G) sai dos vazios da loja.
        var cheios = SomarPorTipo(totais.Itens
            .Where(i => i.TipoCascoId is not null)
            .Select(i => new CascoQuantidade(i.TipoCascoId!.Value, i.Quantidade)));
        var emprestimos = new List<CascoQuantidade>();
        var vaziosSaidos = new List<CascoQuantidade>();
        foreach (var tipo in cheios.Select(c => c.TipoCascoId).Concat(vasilhames.Select(v => v.TipoCascoId)).Distinct())
        {
            var g = cheios.FirstOrDefault(c => c.TipoCascoId == tipo)?.Quantidade ?? 0;
            // CONVERTER_CASCO só baixa o saldo de casco: não conta como vasilhame saído dos vazios.
            var v = vasilhames.FirstOrDefault(
                x => x.TipoCascoId == tipo && x.Modo != ModoCreditoVasilhame.CONVERTER_CASCO)?.Quantidade ?? 0;
            if (g > v)
            {
                emprestimos.Add(new CascoQuantidade(tipo, g - v));
            }

            if (v > g)
            {
                vaziosSaidos.Add(new CascoQuantidade(tipo, v - g));
            }
        }

        // Devolução e sucata só valem para o tipo de alguma linha retornável ou vasilhame da venda.
        var devolvidos = SomarPorTipo(venda.CascosDevolvidos);
        foreach (var tipoCascoId in devolvidos.Select(c => c.TipoCascoId)
                     .Concat(venda.SucataEntregue.Select(s => s.TipoCascoId)))
        {
            if (!tiposDaVenda.Contains(tipoCascoId))
            {
                throw new BusinessRuleException(
                    "TIPO_CASCO_FORA_DA_VENDA",
                    $"O tipo de casco {tipoCascoId} não é de nenhum item retornável ou vasilhame da venda.");
            }
        }

        foreach (var sucata in venda.SucataEntregue)
        {
            if (!tipos[sucata.TipoCascoId].AceitaSucata)
            {
                throw new BusinessRuleException(
                    "SUCATA_NAO_ACEITA", $"O tipo de casco {sucata.TipoCascoId} não aceita sucata.");
            }
        }

        return new VendaGravacao(
            vendaId, venda.ClienteId, venda.FuncionarioId, venda.EnderecoEntregaId, venda.Observacao,
            totais.TotalBruto, totais.TotalDesconto, totais.DescontoSucata, totais.TotalLiquido, totais.Status,
            totais.Itens, vasilhames, venda.Pagamentos,
            emprestimos, devolvidos, vaziosSaidos,
            vasilhames.Where(v => v.Modo == ModoCreditoVasilhame.CONVERTER_CASCO)
                .Select(v => new CascoQuantidade(v.TipoCascoId, v.Quantidade)).ToList(),
            venda.SucataEntregue,
            totais.Faltante, totais.CreditoGerado, usoCredito);
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
            gravacao.VendaId, gravacao.TotalBruto, gravacao.TotalDesconto, gravacao.DescontoSucata,
            gravacao.TotalLiquido, gravacao.Pagamentos.Sum(p => p.Valor), gravacao.DebitoFiado,
            gravacao.CreditoGerado, gravacao.Status, gravado.SaldoCascoPorTipo);
    }
}
