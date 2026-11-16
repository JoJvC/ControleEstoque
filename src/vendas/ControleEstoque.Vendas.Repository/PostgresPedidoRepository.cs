using ControleEstoque.Shared.Results;
using ControleEstoque.Vendas.Domain;
using Npgsql;
using NpgsqlTypes;

namespace ControleEstoque.Vendas.Repository;

public sealed class PostgresPedidoRepository : IPedidoRepository
{
    private readonly NpgsqlDataSource dataSource;

    public PostgresPedidoRepository(NpgsqlDataSource dataSource) => this.dataSource = dataSource;

    public async Task CriarAsync(PedidoGravacao gravacao, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);

        await using (var command = new NpgsqlCommand(Sql.InsertPedido, connection, transaction))
        {
            command.Parameters.AddWithValue("id", gravacao.PedidoId);
            command.Parameters.AddWithValue("clienteId", gravacao.ClienteId);
            command.Parameters.Add(new NpgsqlParameter("enderecoId", NpgsqlDbType.Uuid)
            {
                Value = (object?)gravacao.EnderecoEntregaId ?? DBNull.Value
            });
            command.Parameters.Add(new NpgsqlParameter("observacao", NpgsqlDbType.Text)
            {
                Value = (object?)gravacao.Observacao ?? DBNull.Value
            });
            command.Parameters.AddWithValue("criadoPor", gravacao.CriadoPor);
            command.Parameters.AddWithValue("criadoEm", gravacao.CriadoEm);
            await command.ExecuteNonQueryAsync(cancellationToken);
        }

        foreach (var item in gravacao.Itens)
        {
            await using var command = new NpgsqlCommand(Sql.InsertItem, connection, transaction);
            command.Parameters.AddWithValue("pedidoId", gravacao.PedidoId);
            command.Parameters.AddWithValue("produtoMarcaId", item.ProdutoMarcaId);
            command.Parameters.AddWithValue("quantidade", item.Quantidade);
            command.Parameters.AddWithValue("precoUnitario", item.PrecoUnitario);
            command.Parameters.Add(new NpgsqlParameter("descontoTipo", NpgsqlDbType.Text)
            {
                Value = (object?)item.Desconto?.Tipo.ToString() ?? DBNull.Value
            });
            command.Parameters.Add(new NpgsqlParameter("descontoValor", NpgsqlDbType.Numeric)
            {
                Value = (object?)item.Desconto?.Valor ?? DBNull.Value
            });
            command.Parameters.Add(new NpgsqlParameter("motivoDesconto", NpgsqlDbType.Text)
            {
                Value = (object?)item.Desconto?.Motivo ?? DBNull.Value
            });
            await command.ExecuteNonQueryAsync(cancellationToken);
        }

        await GravarFuncionariosAsync(connection, transaction, gravacao.PedidoId, gravacao.FuncionariosIds, cancellationToken);
        await transaction.CommitAsync(cancellationToken);
    }

    public async Task<Pedido?> GetAsync(Guid pedidoId, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);

        Pedido pedido;
        await using (var command = new NpgsqlCommand(Sql.GetPedido, connection))
        {
            command.Parameters.AddWithValue("id", pedidoId);
            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            if (!await reader.ReadAsync(cancellationToken))
            {
                return null;
            }

            pedido = new Pedido(
                reader.GetGuid(0), reader.GetGuid(1), reader.IsDBNull(2) ? null : reader.GetGuid(2),
                Enum.Parse<StatusPedido>(reader.GetString(3)), reader.IsDBNull(4) ? null : reader.GetString(4),
                reader.GetGuid(5), reader.GetFieldValue<DateTimeOffset>(6),
                reader.IsDBNull(7) ? null : reader.GetFieldValue<DateTimeOffset>(7),
                reader.IsDBNull(8) ? null : reader.GetFieldValue<DateTimeOffset>(8),
                reader.IsDBNull(9) ? null : reader.GetGuid(9), [], [],
                reader.IsDBNull(10) ? null : reader.GetGuid(10));
        }

        var itens = new List<ItemPedido>();
        await using (var command = new NpgsqlCommand(Sql.GetItens, connection))
        {
            command.Parameters.AddWithValue("id", pedidoId);
            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            while (await reader.ReadAsync(cancellationToken))
            {
                Desconto? desconto = reader.IsDBNull(5)
                    ? null
                    : new Desconto(Enum.Parse<TipoDesconto>(reader.GetString(5)), reader.GetDecimal(6), reader.GetString(7));
                itens.Add(new ItemPedido(
                    reader.GetGuid(0), reader.GetGuid(1), reader.GetGuid(2), reader.GetInt32(3), reader.GetDecimal(4),
                    desconto));
            }
        }

        var funcionarios = new List<FuncionarioPedido>();
        await using (var command = new NpgsqlCommand(Sql.GetFuncionarios, connection))
        {
            command.Parameters.AddWithValue("id", pedidoId);
            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            while (await reader.ReadAsync(cancellationToken))
            {
                funcionarios.Add(new FuncionarioPedido(reader.GetGuid(0), reader.GetString(1)));
            }
        }

        var perdas = new List<PerdaPedido>();
        await using (var command = new NpgsqlCommand(Sql.GetPerdas, connection))
        {
            command.Parameters.AddWithValue("id", pedidoId);
            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            while (await reader.ReadAsync(cancellationToken))
            {
                var cheio = !reader.IsDBNull(0);
                perdas.Add(new PerdaPedido(
                    cheio ? GalaoPerda.CHEIO : GalaoPerda.VAZIO, cheio ? reader.GetGuid(0) : null,
                    cheio ? reader.GetGuid(1) : null, reader.GetGuid(2), reader.GetInt32(3),
                    Enum.Parse<MotivoPerda>(reader.GetString(4)), reader.GetFieldValue<DateTimeOffset>(5)));
            }
        }

        return pedido with { Itens = itens, Funcionarios = funcionarios, Perdas = perdas };
    }

    public async Task<IReadOnlyList<PedidoResumo>> ListAsync(
        StatusPedido? status, int page, int pageSize, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(Sql.Listar, connection);
        command.Parameters.Add(new NpgsqlParameter("status", NpgsqlDbType.Text)
        {
            Value = (object?)status?.ToString() ?? DBNull.Value
        });
        command.Parameters.AddWithValue("limite", pageSize);
        command.Parameters.AddWithValue("deslocamento", (page - 1) * pageSize);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        var lista = new List<PedidoResumo>();
        while (await reader.ReadAsync(cancellationToken))
        {
            lista.Add(new PedidoResumo(
                reader.GetGuid(0), reader.GetGuid(1), reader.IsDBNull(2) ? null : reader.GetGuid(2),
                Enum.Parse<StatusPedido>(reader.GetString(3)), reader.IsDBNull(4) ? null : reader.GetString(4),
                reader.GetFieldValue<DateTimeOffset>(5),
                reader.IsDBNull(6) ? null : reader.GetFieldValue<DateTimeOffset>(6),
                reader.IsDBNull(7) ? null : reader.GetFieldValue<DateTimeOffset>(7)));
        }

        return lista;
    }

    public async Task<SaldoInsuficiente?> IniciarAsync(
        Guid pedidoId, IReadOnlyList<Guid> funcionariosIds, DateTimeOffset iniciadoEm,
        CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);

        // Ordem das travas: pedido, produto+marca dos itens.
        var status = await TravarPedidoAsync(connection, transaction, pedidoId, cancellationToken);
        if (!TransicoesPedido.PodeIniciar(status))
        {
            throw new ConflictException("PEDIDO_STATUS_INVALIDO", $"Pedido {status} não pode ser iniciado.");
        }

        var saidas = await QuantidadesPorProdutoMarcaAsync(connection, transaction, pedidoId, cancellationToken);

        if (await ChecagemEstoque.ChecarAsync(connection, transaction, saidas, cancellationToken) is { } falta)
        {
            return falta; // sem Commit: o Dispose da transação faz rollback.
        }

        await using (var command = new NpgsqlCommand(Sql.ApagarFuncionarios, connection, transaction))
        {
            command.Parameters.AddWithValue("id", pedidoId);
            await command.ExecuteNonQueryAsync(cancellationToken);
        }

        await GravarFuncionariosAsync(connection, transaction, pedidoId, funcionariosIds, cancellationToken);

        await using (var command = new NpgsqlCommand(Sql.Iniciar, connection, transaction))
        {
            command.Parameters.AddWithValue("id", pedidoId);
            command.Parameters.AddWithValue("iniciadoEm", iniciadoEm);
            await command.ExecuteNonQueryAsync(cancellationToken);
        }

        await transaction.CommitAsync(cancellationToken);
        return null;
    }

    public async Task CancelarAsync(
        Guid pedidoId, Guid funcionarioId, DateTimeOffset canceladoEm, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);

        var status = await TravarPedidoAsync(connection, transaction, pedidoId, cancellationToken);
        if (!TransicoesPedido.PodeCancelar(status))
        {
            throw new ConflictException("PEDIDO_STATUS_INVALIDO", $"Pedido {status} não pode ser cancelado.");
        }

        await using (var command = new NpgsqlCommand(Sql.Cancelar, connection, transaction))
        {
            command.Parameters.AddWithValue("id", pedidoId);
            command.Parameters.AddWithValue("canceladoEm", canceladoEm);
            command.Parameters.AddWithValue("canceladoPor", funcionarioId);
            await command.ExecuteNonQueryAsync(cancellationToken);
        }

        await transaction.CommitAsync(cancellationToken);
    }

    public async Task<SaldoInsuficiente?> RegistrarPerdasAsync(
        Guid pedidoId, Guid funcionarioId, IReadOnlyList<PerdaGravacao> perdas, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);

        // Ordem das travas: pedido, produto+marca dos cheios, tipo de casco dos vazios.
        var status = await TravarPedidoAsync(connection, transaction, pedidoId, cancellationToken);
        if (status != StatusPedido.CONCLUIDO)
        {
            throw new ConflictException("PEDIDO_STATUS_INVALIDO", $"Pedido {status} não pode receber perdas.");
        }

        var responsaveis = new List<Guid>();
        await using (var command = new NpgsqlCommand(Sql.GetResponsaveis, connection, transaction))
        {
            command.Parameters.AddWithValue("id", pedidoId);
            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            while (await reader.ReadAsync(cancellationToken))
            {
                responsaveis.Add(reader.GetGuid(0));
            }
        }

        if (responsaveis.Count == 0)
        {
            throw new BusinessRuleException(
                "RESPONSAVEL_OBRIGATORIO", "O pedido não tem funcionários para responder pela perda.");
        }

        var cheios = perdas.Where(p => p.Galao == GalaoPerda.CHEIO).GroupBy(p => p.ProdutoMarcaId!.Value)
            .ToDictionary(g => g.Key, g => g.Sum(p => (long)p.Quantidade));
        if (cheios.Count > 0
            && await ChecagemEstoque.ChecarSaldoFisicoAsync(connection, transaction, cheios, cancellationToken)
                is { } faltaCheio)
        {
            return faltaCheio; // sem Commit: o Dispose da transação faz rollback.
        }

        var vazios = perdas.Where(p => p.Galao == GalaoPerda.VAZIO).GroupBy(p => p.TipoCascoId)
            .ToDictionary(g => g.Key, g => g.Sum(p => (long)p.Quantidade));
        if (vazios.Count > 0 && await ChecarVaziosAsync(connection, transaction, vazios, cancellationToken)
                is { } faltaVazio)
        {
            return faltaVazio;
        }

        foreach (var perda in perdas)
        {
            await using (var command = new NpgsqlCommand(Sql.InsertBaixa, connection, transaction))
            {
                command.Parameters.AddWithValue("id", perda.Id);
                command.Parameters.AddWithValue("tipoCascoId", perda.TipoCascoId);
                command.Parameters.AddWithValue("quantidade", perda.Quantidade);
                command.Parameters.AddWithValue("motivo", perda.Motivo.ToString());
                command.Parameters.AddWithValue("criadoPor", funcionarioId);
                command.Parameters.AddWithValue("pedidoId", pedidoId);
                command.Parameters.Add(new NpgsqlParameter("produtoMarcaId", NpgsqlDbType.Uuid)
                {
                    Value = (object?)perda.ProdutoMarcaId ?? DBNull.Value
                });
                await command.ExecuteNonQueryAsync(cancellationToken);
            }

            foreach (var responsavel in responsaveis)
            {
                await using var command = new NpgsqlCommand(Sql.InsertResponsavelBaixa, connection, transaction);
                command.Parameters.AddWithValue("baixaId", perda.Id);
                command.Parameters.AddWithValue("funcionarioId", responsavel);
                await command.ExecuteNonQueryAsync(cancellationToken);
            }

            foreach (var movimento in perda.Movimentos)
            {
                await using var command = new NpgsqlCommand(
                    movimento.Destino == DestinoMovimento.PRODUTO ? Sql.InsertMovimento : Sql.InsertMovimentoCasco,
                    connection, transaction);
                command.Parameters.AddWithValue("tipo", movimento.Tipo.ToString());
                command.Parameters.AddWithValue("quantidade", movimento.Quantidade);
                command.Parameters.AddWithValue("baixaCascoId", perda.Id);
                command.Parameters.AddWithValue("criadoPor", funcionarioId);
                if (movimento.Destino == DestinoMovimento.PRODUTO)
                {
                    command.Parameters.AddWithValue("produtoMarcaId", perda.ProdutoMarcaId!.Value);
                }
                else
                {
                    command.Parameters.AddWithValue("tipoCascoId", perda.TipoCascoId);
                    command.Parameters.AddWithValue("situacao", movimento.Situacao!.Value.ToString());
                }

                await command.ExecuteNonQueryAsync(cancellationToken);
            }
        }

        await transaction.CommitAsync(cancellationToken);
        return null;
    }

    /// <summary>Mesma regra do Estoque (trava o tipo, lê o saldo por situação), escrita aqui: sem referência ao Estoque.</summary>
    private static async Task<SaldoInsuficiente?> ChecarVaziosAsync(
        NpgsqlConnection connection, NpgsqlTransaction transaction, IReadOnlyDictionary<Guid, long> saidas,
        CancellationToken cancellationToken)
    {
        var ids = saidas.Keys.Order().ToArray();
        await using (var command = new NpgsqlCommand(Sql.TravaTiposCasco, connection, transaction))
        {
            command.Parameters.AddWithValue("ids", ids);
            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            while (await reader.ReadAsync(cancellationToken))
            {
            }
        }

        var saldos = new Dictionary<Guid, long>();
        await using (var command = new NpgsqlCommand(Sql.GetSaldosVazio, connection, transaction))
        {
            command.Parameters.AddWithValue("ids", ids);
            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            while (await reader.ReadAsync(cancellationToken))
            {
                saldos[reader.GetGuid(0)] = reader.GetInt64(1);
            }
        }

        foreach (var (tipoCascoId, saida) in saidas)
        {
            if (saldos.GetValueOrDefault(tipoCascoId) < saida)
            {
                return new SaldoInsuficiente(tipoCascoId, saldos.GetValueOrDefault(tipoCascoId), saida);
            }
        }

        return null;
    }

    /// <summary>Soma de pedido_itens.quantidade do pedido por associação produto+marca (a reserva dele).</summary>
    internal static async Task<Dictionary<Guid, long>> QuantidadesPorProdutoMarcaAsync(
        NpgsqlConnection connection, NpgsqlTransaction transaction, Guid pedidoId,
        CancellationToken cancellationToken)
    {
        var quantidades = new Dictionary<Guid, long>();
        await using var command = new NpgsqlCommand(Sql.QuantidadesPorProdutoMarca, connection, transaction);
        command.Parameters.AddWithValue("id", pedidoId);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            quantidades[reader.GetGuid(0)] = reader.GetInt64(1);
        }

        return quantidades;
    }

    internal static async Task<StatusPedido> TravarPedidoAsync(
        NpgsqlConnection connection, NpgsqlTransaction transaction, Guid pedidoId,
        CancellationToken cancellationToken)
    {
        await using var command = new NpgsqlCommand(Sql.TravaPedido, connection, transaction);
        command.Parameters.AddWithValue("id", pedidoId);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        if (!await reader.ReadAsync(cancellationToken))
        {
            throw new EntityNotFoundException("PEDIDO_NAO_ENCONTRADO", $"Pedido {pedidoId} não encontrado.");
        }

        return Enum.Parse<StatusPedido>(reader.GetString(0));
    }

    private static async Task GravarFuncionariosAsync(
        NpgsqlConnection connection, NpgsqlTransaction transaction, Guid pedidoId, IReadOnlyList<Guid> funcionariosIds,
        CancellationToken cancellationToken)
    {
        foreach (var funcionarioId in funcionariosIds)
        {
            await using var command = new NpgsqlCommand(Sql.InsertFuncionario, connection, transaction);
            command.Parameters.AddWithValue("pedidoId", pedidoId);
            command.Parameters.AddWithValue("funcionarioId", funcionarioId);
            await command.ExecuteNonQueryAsync(cancellationToken);
        }
    }

    private static class Sql
    {
        public const string InsertPedido = """
            INSERT INTO pedidos (id, cliente_id, endereco_entrega_id, observacao, created_by, created_at)
            VALUES (@id, @clienteId, @enderecoId, @observacao, @criadoPor, @criadoEm)
            """;

        public const string InsertItem = """
            INSERT INTO pedido_itens (pedido_id, produto_marca_id, quantidade, preco_unitario,
                                      desconto_tipo, desconto_valor, motivo_desconto)
            VALUES (@pedidoId, @produtoMarcaId, @quantidade, @precoUnitario,
                    @descontoTipo::tipo_desconto, @descontoValor, @motivoDesconto)
            """;

        public const string InsertFuncionario =
            "INSERT INTO pedido_funcionarios (pedido_id, funcionario_id) VALUES (@pedidoId, @funcionarioId)";

        public const string ApagarFuncionarios = "DELETE FROM pedido_funcionarios WHERE pedido_id = @id";

        public const string GetPedido = """
            SELECT id, cliente_id, endereco_entrega_id, status::text, observacao, created_by, created_at,
                   iniciado_em, cancelado_em, cancelado_por, venda_id
            FROM pedidos
            WHERE id = @id
            """;

        public const string GetItens = """
            SELECT pm.produto_id, pm.marca_id, i.produto_marca_id, i.quantidade, i.preco_unitario,
                   i.desconto_tipo::text, i.desconto_valor, i.motivo_desconto
            FROM pedido_itens i
            JOIN produto_marcas pm ON pm.id = i.produto_marca_id
            WHERE i.pedido_id = @id
            ORDER BY i.id
            """;

        public const string GetFuncionarios = """
            SELECT f.id, f.nome
            FROM pedido_funcionarios pf
            JOIN funcionarios f ON f.id = pf.funcionario_id
            WHERE pf.pedido_id = @id
            ORDER BY f.nome, f.id
            """;

        public const string Listar = """
            SELECT id, cliente_id, endereco_entrega_id, status::text, observacao, created_at, iniciado_em, cancelado_em
            FROM pedidos
            WHERE @status::text IS NULL OR status = @status::status_pedido
            ORDER BY created_at DESC, id
            LIMIT @limite OFFSET @deslocamento
            """;

        public const string TravaPedido = "SELECT status::text FROM pedidos WHERE id = @id FOR UPDATE";

        public const string QuantidadesPorProdutoMarca = """
            SELECT produto_marca_id, SUM(quantidade)::bigint
            FROM pedido_itens
            WHERE pedido_id = @id
            GROUP BY produto_marca_id
            """;

        public const string GetResponsaveis = "SELECT funcionario_id FROM pedido_funcionarios WHERE pedido_id = @id";

        public const string TravaTiposCasco =
            "SELECT id FROM tipos_casco WHERE id = ANY(@ids) ORDER BY id FOR NO KEY UPDATE";

        public const string GetSaldosVazio = """
            SELECT tipo_casco_id, COALESCE(SUM(quantidade), 0)::bigint
            FROM movimentos_estoque_casco
            WHERE tipo_casco_id = ANY(@ids) AND situacao = 'VAZIO' AND deleted_at IS NULL
            GROUP BY tipo_casco_id
            """;

        public const string InsertBaixa = """
            INSERT INTO baixas_casco (id, tipo_casco_id, quantidade, motivo, created_by, pedido_id, produto_marca_id)
            VALUES (@id, @tipoCascoId, @quantidade, @motivo, @criadoPor, @pedidoId, @produtoMarcaId)
            """;

        public const string InsertResponsavelBaixa = """
            INSERT INTO baixa_casco_responsaveis (baixa_id, funcionario_id) VALUES (@baixaId, @funcionarioId)
            """;

        public const string InsertMovimento = """
            INSERT INTO movimentos_estoque (produto_marca_id, tipo, quantidade, baixa_casco_id, created_by)
            VALUES (@produtoMarcaId, @tipo::tipo_movimento_estoque, @quantidade, @baixaCascoId, @criadoPor)
            """;

        public const string InsertMovimentoCasco = """
            INSERT INTO movimentos_estoque_casco (tipo_casco_id, situacao, tipo, quantidade, baixa_casco_id, created_by)
            VALUES (@tipoCascoId, @situacao::situacao_casco, @tipo::tipo_movimento_estoque, @quantidade,
                    @baixaCascoId, @criadoPor)
            """;

        public const string GetPerdas = """
            SELECT pm.produto_id, pm.marca_id, b.tipo_casco_id, b.quantidade, b.motivo, b.created_at
            FROM baixas_casco b
            LEFT JOIN produto_marcas pm ON pm.id = b.produto_marca_id
            WHERE b.pedido_id = @id AND b.deleted_at IS NULL
            ORDER BY b.created_at, b.id
            """;

        public const string Iniciar = """
            UPDATE pedidos SET status = 'EM_ANDAMENTO', iniciado_em = @iniciadoEm WHERE id = @id
            """;

        public const string Cancelar = """
            UPDATE pedidos SET status = 'CANCELADO', cancelado_em = @canceladoEm, cancelado_por = @canceladoPor
            WHERE id = @id
            """;
    }
}
