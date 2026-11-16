using ControleEstoque.Shared.Results;

namespace ControleEstoque.Vendas.Domain;

public interface IPedidoService
{
    Task<Pedido> CriarAsync(NovoPedido pedido, CancellationToken cancellationToken);
    Task<Pedido> ObterAsync(Guid pedidoId, CancellationToken cancellationToken);
    Task<IReadOnlyList<PedidoResumo>> ListarAsync(
        string? status, int page, int pageSize, CancellationToken cancellationToken);

    /// <summary>Confirma ou troca os funcionários da entrega (pelo menos um) e reserva os itens.</summary>
    Task<Pedido> IniciarAsync(
        Guid pedidoId, Guid funcionarioId, IReadOnlyList<Guid> funcionariosIds, CancellationToken cancellationToken);

    /// <summary>Sem chave de permissão: nada foi cobrado. Libera a reserva.</summary>
    Task<Pedido> CancelarAsync(Guid pedidoId, Guid funcionarioId, CancellationToken cancellationToken);
}

public sealed class PedidoService : IPedidoService
{
    private readonly IPedidoRepository pedidos;
    private readonly IVendaLookup lookup;
    private readonly TimeProvider relogio;

    public PedidoService(IPedidoRepository pedidos, IVendaLookup lookup, TimeProvider? relogio = null)
    {
        this.pedidos = pedidos;
        this.lookup = lookup;
        this.relogio = relogio ?? TimeProvider.System;
    }

    public async Task<Pedido> CriarAsync(NovoPedido pedido, CancellationToken cancellationToken)
    {
        Validacao.IdPreenchido(pedido.ClienteId, "ClienteId");
        Validacao.IdPreenchido(pedido.FuncionarioId, "FuncionarioId");
        foreach (var item in pedido.Itens)
        {
            Validacao.IdPreenchido(item.ProdutoId, "ProdutoId");
            Validacao.IdPreenchido(item.MarcaId, "MarcaId");
        }

        // Quantidade, preço e desconto seguem os mesmos códigos dos itens da venda (ITENS_OBRIGATORIOS se vazio).
        VendaCalculos.Calcular(pedido.Itens, [], [], []);

        if (!await lookup.ClienteExisteAsync(pedido.ClienteId, cancellationToken))
        {
            throw new EntityNotFoundException(
                "CLIENTE_NAO_ENCONTRADO", $"Cliente {pedido.ClienteId} não encontrado.");
        }

        await ExigirFuncionarioAsync(pedido.FuncionarioId, cancellationToken);
        var funcionarios = await ExigirFuncionariosAsync(pedido.FuncionariosIds, cancellationToken);

        if (pedido.EnderecoEntregaId is { } enderecoId
            && !await lookup.EnderecoPertenceAoClienteAsync(enderecoId, pedido.ClienteId, cancellationToken))
        {
            throw new BusinessRuleException(
                "ENDERECO_NAO_PERTENCE_AO_CLIENTE", "Endereço de entrega não pertence ao cliente.");
        }

        var pares = pedido.Itens.Select(i => (i.ProdutoId, i.MarcaId)).Distinct().ToList();
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

        var gravacao = new PedidoGravacao(
            Guid.NewGuid(), pedido.ClienteId, pedido.EnderecoEntregaId, pedido.Observacao, pedido.FuncionarioId,
            relogio.GetUtcNow(),
            pedido.Itens.Select(i => new ItemPedido(
                i.ProdutoId, i.MarcaId, produtos[(i.ProdutoId, i.MarcaId)].ProdutoMarcaId,
                i.Quantidade, i.PrecoUnitario, i.Desconto)).ToList(),
            funcionarios);
        await pedidos.CriarAsync(gravacao, cancellationToken);
        return await ObterAsync(gravacao.PedidoId, cancellationToken);
    }

    public async Task<Pedido> ObterAsync(Guid pedidoId, CancellationToken cancellationToken)
        => await pedidos.GetAsync(pedidoId, cancellationToken) ?? throw NaoEncontrado(pedidoId);

    public Task<IReadOnlyList<PedidoResumo>> ListarAsync(
        string? status, int page, int pageSize, CancellationToken cancellationToken)
    {
        StatusPedido? filtro = null;
        if (status is not null)
        {
            if (!Enum.GetNames<StatusPedido>().Contains(status))
            {
                throw new RequestValidationException(
                    "VALOR_ENUM_INVALIDO", $"Valor '{status}' inválido para status.");
            }

            filtro = Enum.Parse<StatusPedido>(status);
        }

        return pedidos.ListAsync(filtro, Math.Max(1, page), Math.Clamp(pageSize, 1, 200), cancellationToken);
    }

    public async Task<Pedido> IniciarAsync(
        Guid pedidoId, Guid funcionarioId, IReadOnlyList<Guid> funcionariosIds, CancellationToken cancellationToken)
    {
        await ExigirFuncionarioAsync(funcionarioId, cancellationToken);
        if (funcionariosIds is not { Count: > 0 })
        {
            throw new BusinessRuleException(
                "FUNCIONARIOS_OBRIGATORIOS", "Informe ao menos um funcionário para iniciar a entrega.");
        }

        var funcionarios = await ExigirFuncionariosAsync(funcionariosIds, cancellationToken);
        var pedido = await ObterAsync(pedidoId, cancellationToken);
        if (!TransicoesPedido.PodeIniciar(pedido.Status))
        {
            throw StatusInvalido(pedido.Status, "iniciado");
        }

        // O repositório repete a checagem do status e confere o estoque sob as travas.
        if (await pedidos.IniciarAsync(pedidoId, funcionarios, relogio.GetUtcNow(), cancellationToken) is { } falta)
        {
            // Falta.ProdutoId é o id da associação produto+marca; Falta.Saldo, o disponível (saldo − reservado).
            var item = pedido.Itens.First(i => i.ProdutoMarcaId == falta.ProdutoId);
            var nome = (await lookup.GetProdutosAsync([(item.ProdutoId, item.MarcaId)], cancellationToken))
                .TryGetValue((item.ProdutoId, item.MarcaId), out var produto)
                    ? produto.Nome : falta.ProdutoId.ToString();
            throw new InsufficientStockException(
                $"Estoque de '{nome}' ({falta.Saldo}) insuficiente para reservar {falta.Solicitado}.");
        }

        return await ObterAsync(pedidoId, cancellationToken);
    }

    public async Task<Pedido> CancelarAsync(Guid pedidoId, Guid funcionarioId, CancellationToken cancellationToken)
    {
        await ExigirFuncionarioAsync(funcionarioId, cancellationToken);
        var pedido = await ObterAsync(pedidoId, cancellationToken);
        if (!TransicoesPedido.PodeCancelar(pedido.Status))
        {
            throw StatusInvalido(pedido.Status, "cancelado");
        }

        await pedidos.CancelarAsync(pedidoId, funcionarioId, relogio.GetUtcNow(), cancellationToken);
        return await ObterAsync(pedidoId, cancellationToken);
    }

    private async Task ExigirFuncionarioAsync(Guid funcionarioId, CancellationToken cancellationToken)
    {
        Validacao.IdPreenchido(funcionarioId, "FuncionarioId");
        if (!await lookup.FuncionarioExisteAsync(funcionarioId, cancellationToken))
        {
            throw new EntityNotFoundException(
                "FUNCIONARIO_NAO_ENCONTRADO", $"Funcionário {funcionarioId} não encontrado.");
        }
    }

    /// <summary>Ids repetidos contam uma vez; cada um precisa existir.</summary>
    private async Task<IReadOnlyList<Guid>> ExigirFuncionariosAsync(
        IReadOnlyList<Guid>? ids, CancellationToken cancellationToken)
    {
        var distintos = (ids ?? []).Distinct().ToList();
        foreach (var id in distintos)
        {
            await ExigirFuncionarioAsync(id, cancellationToken);
        }

        return distintos;
    }

    private static EntityNotFoundException NaoEncontrado(Guid pedidoId) =>
        new("PEDIDO_NAO_ENCONTRADO", $"Pedido {pedidoId} não encontrado.");

    private static ConflictException StatusInvalido(StatusPedido status, string acao) =>
        new("PEDIDO_STATUS_INVALIDO", $"Pedido {status} não pode ser {acao}.");
}
