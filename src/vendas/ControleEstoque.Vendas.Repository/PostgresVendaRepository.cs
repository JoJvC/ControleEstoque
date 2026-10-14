using ControleEstoque.Vendas.Domain;
using Npgsql;
using NpgsqlTypes;

namespace ControleEstoque.Vendas.Repository;

public sealed class PostgresVendaRepository : IVendaRepository
{
    private readonly NpgsqlDataSource dataSource;

    public PostgresVendaRepository(NpgsqlDataSource dataSource) => this.dataSource = dataSource;

    public async Task<long> CriarAsync(VendaGravacao gravacao, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);

        await using (var command = new NpgsqlCommand(Sql.InsertVenda, connection, transaction))
        {
            AddVendaParameters(command, gravacao);
            await command.ExecuteNonQueryAsync(cancellationToken);
        }

        await InserirEfeitosAsync(connection, transaction, gravacao, cancellationToken);

        var saldo = await GetSaldoCascoAsync(connection, transaction, gravacao.ClienteId, cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return saldo;
    }

    public async Task<long> EditarAsync(VendaGravacao gravacao, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);

        await using (var command = new NpgsqlCommand(Sql.UpdateVenda, connection, transaction))
        {
            AddVendaParameters(command, gravacao);
            await command.ExecuteNonQueryAsync(cancellationToken);
        }

        // Replay: apaga (soft) TODOS os efeitos vinculados à venda e reinsere.
        // Como os saldos são views sobre os ledgers, eles se autocorrigem.
        await using (var command = new NpgsqlCommand(Sql.SoftDeleteEfeitos, connection, transaction))
        {
            command.Parameters.AddWithValue("vendaId", gravacao.VendaId);
            await command.ExecuteNonQueryAsync(cancellationToken);
        }

        await InserirEfeitosAsync(connection, transaction, gravacao, cancellationToken);

        var saldo = await GetSaldoCascoAsync(connection, transaction, gravacao.ClienteId, cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return saldo;
    }

    public async Task<bool> ExisteAsync(Guid vendaId, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(Sql.Existe, connection);
        command.Parameters.AddWithValue("vendaId", vendaId);
        return (bool?)await command.ExecuteScalarAsync(cancellationToken) == true;
    }

    public async Task<Venda?> GetAsync(Guid vendaId, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);

        Venda? venda;
        await using (var command = new NpgsqlCommand(Sql.GetVenda, connection))
        {
            command.Parameters.AddWithValue("vendaId", vendaId);
            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            if (!await reader.ReadAsync(cancellationToken))
            {
                return null;
            }

            venda = MapVenda(reader);
        }

        var itens = new List<ItemCalculado>();
        await using (var command = new NpgsqlCommand(Sql.GetItens, connection))
        {
            command.Parameters.AddWithValue("vendaId", vendaId);
            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            while (await reader.ReadAsync(cancellationToken))
            {
                itens.Add(MapItem(reader));
            }
        }

        var pagamentos = new List<PagamentoVenda>();
        await using (var command = new NpgsqlCommand(Sql.GetPagamentos, connection))
        {
            command.Parameters.AddWithValue("vendaId", vendaId);
            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            while (await reader.ReadAsync(cancellationToken))
            {
                pagamentos.Add(new PagamentoVenda(
                    Enum.Parse<FormaPagamento>(reader.GetString(0)), reader.GetDecimal(1)));
            }
        }

        return venda with { Itens = itens, Pagamentos = pagamentos };
    }

    public async Task<IReadOnlyList<Venda>> ListAsync(
        Guid? clienteId, DateOnly? inicio, DateOnly? fim, int page, int pageSize,
        CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(Sql.List, connection);
        command.Parameters.Add(new NpgsqlParameter("clienteId", NpgsqlDbType.Uuid)
        {
            Value = (object?)clienteId ?? DBNull.Value
        });
        command.Parameters.Add(new NpgsqlParameter("inicio", NpgsqlDbType.Date)
        {
            Value = (object?)inicio ?? DBNull.Value
        });
        command.Parameters.Add(new NpgsqlParameter("fim", NpgsqlDbType.Date)
        {
            Value = (object?)fim ?? DBNull.Value
        });
        command.Parameters.AddWithValue("offset", (page - 1) * pageSize);
        command.Parameters.AddWithValue("limit", pageSize);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        var results = new List<Venda>();
        while (await reader.ReadAsync(cancellationToken))
        {
            results.Add(MapVenda(reader));
        }

        return results;
    }

    public async Task<InfoPagamentoVenda?> GetInfoPagamentoAsync(
        Guid vendaId, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(Sql.GetInfoPagamento, connection);
        command.Parameters.AddWithValue("vendaId", vendaId);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        if (!await reader.ReadAsync(cancellationToken))
        {
            return null;
        }

        return new InfoPagamentoVenda(
            reader.GetDecimal(0),
            reader.GetDecimal(1),
            reader.GetDecimal(2),
            Enum.Parse<StatusPagamento>(reader.GetString(3)));
    }

    public async Task AddPagamentoAsync(
        Guid vendaId, FormaPagamento forma, decimal valor, decimal abatimentoFiado,
        StatusPagamento novoStatus, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);

        await using (var command = new NpgsqlCommand(Sql.InsertPagamento, connection, transaction))
        {
            command.Parameters.AddWithValue("vendaId", vendaId);
            command.Parameters.AddWithValue("forma", forma.ToString());
            command.Parameters.AddWithValue("valor", valor);
            await command.ExecuteNonQueryAsync(cancellationToken);
        }

        await using (var command = new NpgsqlCommand(Sql.UpdateStatus, connection, transaction))
        {
            command.Parameters.AddWithValue("vendaId", vendaId);
            command.Parameters.AddWithValue("status", novoStatus.ToString());
            await command.ExecuteNonQueryAsync(cancellationToken);
        }

        if (abatimentoFiado > 0)
        {
            await using var command = new NpgsqlCommand(Sql.InsertAbatimentoFiado, connection, transaction);
            command.Parameters.AddWithValue("vendaId", vendaId);
            command.Parameters.AddWithValue("valor", abatimentoFiado);
            await command.ExecuteNonQueryAsync(cancellationToken);
        }

        await transaction.CommitAsync(cancellationToken);
    }

    public async Task<long> GetSaldoCascoClienteAsync(Guid clienteId, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        return await GetSaldoCascoAsync(connection, null, clienteId, cancellationToken);
    }

    // ---- privados -----------------------------------------------------------

    private static async Task InserirEfeitosAsync(
        NpgsqlConnection connection, NpgsqlTransaction transaction, VendaGravacao gravacao,
        CancellationToken cancellationToken)
    {
        foreach (var item in gravacao.Itens)
        {
            await using (var command = new NpgsqlCommand(Sql.InsertItem, connection, transaction))
            {
                command.Parameters.AddWithValue("vendaId", gravacao.VendaId);
                command.Parameters.AddWithValue("produtoId", item.ProdutoId);
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
                command.Parameters.AddWithValue("totalItem", item.TotalItem);
                await command.ExecuteNonQueryAsync(cancellationToken);
            }

            await using (var command = new NpgsqlCommand(Sql.InsertMovimentoEstoque, connection, transaction))
            {
                command.Parameters.AddWithValue("produtoId", item.ProdutoId);
                command.Parameters.AddWithValue("tipo", "SAIDA_VENDA");
                command.Parameters.AddWithValue("quantidade", -item.Quantidade);
                command.Parameters.AddWithValue("vendaId", gravacao.VendaId);
                await command.ExecuteNonQueryAsync(cancellationToken);
            }
        }

        // Água vendida = casco NORMAL emprestado (regra crítica 1).
        if (gravacao.CascosEmprestados > 0)
        {
            await InserirMovimentoCascoAsync(
                connection, transaction, gravacao, "EMPRESTIMO", gravacao.CascosEmprestados, cancellationToken);
        }

        if (gravacao.CascosDevolvidos > 0)
        {
            await InserirMovimentoCascoAsync(
                connection, transaction, gravacao, "DEVOLUCAO", gravacao.CascosDevolvidos, cancellationToken);

            await using var command = new NpgsqlCommand(Sql.InsertMovimentoEstoque, connection, transaction);
            command.Parameters.AddWithValue("produtoId", gravacao.CascoProdutoId!.Value);
            command.Parameters.AddWithValue("tipo", "DEVOLUCAO_CLIENTE");
            command.Parameters.AddWithValue("quantidade", gravacao.CascosDevolvidos);
            command.Parameters.AddWithValue("vendaId", gravacao.VendaId);
            await command.ExecuteNonQueryAsync(cancellationToken);
        }

        // Sucata entregue: registro do cliente + estoque. Não toca o ledger de casco.
        if (gravacao.SucataEntregue > 0)
        {
            await using (var command = new NpgsqlCommand(Sql.InsertEntregaSucata, connection, transaction))
            {
                command.Parameters.AddWithValue("clienteId", gravacao.ClienteId);
                command.Parameters.AddWithValue("vendaId", gravacao.VendaId);
                command.Parameters.AddWithValue("quantidade", gravacao.SucataEntregue);
                await command.ExecuteNonQueryAsync(cancellationToken);
            }

            await using (var command = new NpgsqlCommand(Sql.InsertMovimentoEstoque, connection, transaction))
            {
                command.Parameters.AddWithValue("produtoId", gravacao.SucataProdutoId!.Value);
                command.Parameters.AddWithValue("tipo", "ENTRADA_SUCATA");
                command.Parameters.AddWithValue("quantidade", gravacao.SucataEntregue);
                command.Parameters.AddWithValue("vendaId", gravacao.VendaId);
                await command.ExecuteNonQueryAsync(cancellationToken);
            }
        }

        foreach (var pagamento in gravacao.Pagamentos)
        {
            await using var command = new NpgsqlCommand(Sql.InsertPagamento, connection, transaction);
            command.Parameters.AddWithValue("vendaId", gravacao.VendaId);
            command.Parameters.AddWithValue("forma", pagamento.Forma.ToString());
            command.Parameters.AddWithValue("valor", pagamento.Valor);
            await command.ExecuteNonQueryAsync(cancellationToken);
        }

        // A parte não paga da venda vira débito de fiado (regra crítica 2).
        if (gravacao.DebitoFiado > 0)
        {
            await using var command = new NpgsqlCommand(Sql.InsertDebitoFiado, connection, transaction);
            command.Parameters.AddWithValue("clienteId", gravacao.ClienteId);
            command.Parameters.AddWithValue("vendaId", gravacao.VendaId);
            command.Parameters.AddWithValue("valor", gravacao.DebitoFiado);
            await command.ExecuteNonQueryAsync(cancellationToken);
        }
    }

    private static async Task InserirMovimentoCascoAsync(
        NpgsqlConnection connection, NpgsqlTransaction transaction, VendaGravacao gravacao,
        string tipo, int quantidade, CancellationToken cancellationToken)
    {
        await using var command = new NpgsqlCommand(Sql.InsertMovimentoCasco, connection, transaction);
        command.Parameters.AddWithValue("clienteId", gravacao.ClienteId);
        command.Parameters.AddWithValue("vendaId", gravacao.VendaId);
        command.Parameters.AddWithValue("tipo", tipo);
        command.Parameters.AddWithValue("quantidade", quantidade);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    private static async Task<long> GetSaldoCascoAsync(
        NpgsqlConnection connection, NpgsqlTransaction? transaction, Guid clienteId,
        CancellationToken cancellationToken)
    {
        await using var command = new NpgsqlCommand(Sql.GetSaldoCasco, connection, transaction);
        command.Parameters.AddWithValue("clienteId", clienteId);
        return (long?)await command.ExecuteScalarAsync(cancellationToken) ?? 0;
    }

    private static void AddVendaParameters(NpgsqlCommand command, VendaGravacao gravacao)
    {
        command.Parameters.AddWithValue("id", gravacao.VendaId);
        command.Parameters.AddWithValue("clienteId", gravacao.ClienteId);
        command.Parameters.AddWithValue("funcionarioId", gravacao.FuncionarioId);
        command.Parameters.Add(new NpgsqlParameter("enderecoEntregaId", NpgsqlDbType.Uuid)
        {
            Value = (object?)gravacao.EnderecoEntregaId ?? DBNull.Value
        });
        command.Parameters.AddWithValue("totalBruto", gravacao.TotalBruto);
        command.Parameters.AddWithValue("totalDesconto", gravacao.TotalDesconto);
        command.Parameters.AddWithValue("totalLiquido", gravacao.TotalLiquido);
        command.Parameters.AddWithValue("status", gravacao.Status.ToString());
        command.Parameters.Add(new NpgsqlParameter("observacao", NpgsqlDbType.Text)
        {
            Value = (object?)gravacao.Observacao ?? DBNull.Value
        });
    }

    private static Venda MapVenda(NpgsqlDataReader reader) => new(
        reader.GetGuid(0),
        reader.GetGuid(1),
        reader.GetGuid(2),
        reader.IsDBNull(3) ? null : reader.GetGuid(3),
        reader.GetFieldValue<DateTimeOffset>(4),
        reader.GetDecimal(5),
        reader.GetDecimal(6),
        reader.GetDecimal(7),
        Enum.Parse<StatusPagamento>(reader.GetString(8)),
        reader.IsDBNull(9) ? null : reader.GetString(9),
        reader.GetBoolean(10),
        [],
        []);

    private static ItemCalculado MapItem(NpgsqlDataReader reader)
    {
        var produtoId = reader.GetGuid(0);
        var quantidade = reader.GetInt32(1);
        var precoUnitario = reader.GetDecimal(2);
        var descontoTipo = reader.IsDBNull(3) ? null : reader.GetString(3);
        var totalItem = reader.GetDecimal(6);
        var bruto = quantidade * precoUnitario;

        Desconto? desconto = descontoTipo is null
            ? null
            : new Desconto(
                Enum.Parse<TipoDesconto>(descontoTipo), reader.GetDecimal(4), reader.GetString(5));

        return new ItemCalculado(
            produtoId, quantidade, precoUnitario, desconto, bruto, bruto - totalItem, totalItem);
    }

    private static class Sql
    {
        private const string SelectVenda = """
            SELECT v.id, v.cliente_id, v.funcionario_id, v.endereco_entrega_id, v.data,
                   v.total_bruto, v.total_desconto, v.total_liquido, v.status_pagamento::text,
                   v.observacao,
                   EXISTS (SELECT 1 FROM cupons_fiscais cf
                           WHERE cf.venda_id = v.id AND cf.deleted_at IS NULL)
            FROM vendas v
            """;

        public const string InsertVenda = """
            INSERT INTO vendas (id, cliente_id, funcionario_id, endereco_entrega_id,
                                total_bruto, total_desconto, total_liquido, status_pagamento,
                                observacao, created_by)
            VALUES (@id, @clienteId, @funcionarioId, @enderecoEntregaId,
                    @totalBruto, @totalDesconto, @totalLiquido, @status::status_pagamento_venda,
                    @observacao, @funcionarioId)
            """;

        public const string UpdateVenda = """
            UPDATE vendas
            SET cliente_id = @clienteId, funcionario_id = @funcionarioId,
                endereco_entrega_id = @enderecoEntregaId, total_bruto = @totalBruto,
                total_desconto = @totalDesconto, total_liquido = @totalLiquido,
                status_pagamento = @status::status_pagamento_venda, observacao = @observacao,
                updated_by = @funcionarioId, updated_at = now()
            WHERE id = @id AND deleted_at IS NULL
            """;

        public const string SoftDeleteEfeitos = """
            UPDATE venda_itens SET deleted_at = now()
                WHERE venda_id = @vendaId AND deleted_at IS NULL;
            UPDATE venda_pagamentos SET deleted_at = now()
                WHERE venda_id = @vendaId AND deleted_at IS NULL;
            UPDATE movimentos_estoque SET deleted_at = now()
                WHERE venda_id = @vendaId AND deleted_at IS NULL;
            UPDATE movimentos_casco_cliente SET deleted_at = now()
                WHERE venda_id = @vendaId AND deleted_at IS NULL;
            UPDATE entregas_sucata_cliente SET deleted_at = now()
                WHERE venda_id = @vendaId AND deleted_at IS NULL;
            UPDATE lancamentos_fiado SET deleted_at = now()
                WHERE venda_id = @vendaId AND deleted_at IS NULL;
            """;

        public const string InsertItem = """
            INSERT INTO venda_itens (venda_id, produto_id, quantidade, preco_unitario,
                                     desconto_tipo, desconto_valor, motivo_desconto, total_item)
            VALUES (@vendaId, @produtoId, @quantidade, @precoUnitario,
                    @descontoTipo::tipo_desconto, @descontoValor, @motivoDesconto, @totalItem)
            """;

        public const string InsertMovimentoEstoque = """
            INSERT INTO movimentos_estoque (produto_id, tipo, quantidade, venda_id)
            VALUES (@produtoId, @tipo::tipo_movimento_estoque, @quantidade, @vendaId)
            """;

        public const string InsertMovimentoCasco = """
            INSERT INTO movimentos_casco_cliente (cliente_id, venda_id, tipo, quantidade)
            VALUES (@clienteId, @vendaId, @tipo::tipo_movimento_casco, @quantidade)
            """;

        public const string InsertEntregaSucata = """
            INSERT INTO entregas_sucata_cliente (cliente_id, venda_id, quantidade)
            VALUES (@clienteId, @vendaId, @quantidade)
            """;

        public const string InsertPagamento = """
            INSERT INTO venda_pagamentos (venda_id, forma, valor)
            VALUES (@vendaId, @forma::forma_pagamento, @valor)
            """;

        public const string InsertDebitoFiado = """
            INSERT INTO lancamentos_fiado (cliente_id, venda_id, tipo, valor)
            VALUES (@clienteId, @vendaId, 'DEBITO_VENDA', @valor)
            """;

        public const string InsertAbatimentoFiado = """
            INSERT INTO lancamentos_fiado (cliente_id, venda_id, tipo, valor, observacao)
            SELECT v.cliente_id, v.id, 'PAGAMENTO', @valor, 'Pagamento pós-venda'
            FROM vendas v WHERE v.id = @vendaId
            """;

        public const string UpdateStatus = """
            UPDATE vendas SET status_pagamento = @status::status_pagamento_venda, updated_at = now()
            WHERE id = @vendaId AND deleted_at IS NULL
            """;

        public const string Existe =
            "SELECT EXISTS (SELECT 1 FROM vendas WHERE id = @vendaId AND deleted_at IS NULL)";

        public const string GetVenda = SelectVenda + " WHERE v.id = @vendaId AND v.deleted_at IS NULL";

        public const string List = SelectVenda + """
             WHERE v.deleted_at IS NULL
               AND (@clienteId IS NULL OR v.cliente_id = @clienteId)
               AND (@inicio IS NULL OR v.data::date >= @inicio)
               AND (@fim IS NULL OR v.data::date <= @fim)
             ORDER BY v.data DESC
             OFFSET @offset LIMIT @limit
            """;

        public const string GetItens = """
            SELECT produto_id, quantidade, preco_unitario, desconto_tipo::text,
                   desconto_valor, motivo_desconto, total_item
            FROM venda_itens
            WHERE venda_id = @vendaId AND deleted_at IS NULL
            ORDER BY created_at
            """;

        public const string GetPagamentos = """
            SELECT forma::text, valor
            FROM venda_pagamentos
            WHERE venda_id = @vendaId AND deleted_at IS NULL
            ORDER BY data
            """;

        public const string GetInfoPagamento = """
            SELECT v.total_liquido,
                   COALESCE((SELECT SUM(p.valor) FROM venda_pagamentos p
                             WHERE p.venda_id = v.id AND p.deleted_at IS NULL), 0),
                   COALESCE((SELECT SUM(CASE l.tipo
                                 WHEN 'DEBITO_VENDA' THEN l.valor
                                 WHEN 'PAGAMENTO'    THEN -l.valor
                                 ELSE 0 END)
                             FROM lancamentos_fiado l
                             WHERE l.venda_id = v.id AND l.deleted_at IS NULL), 0),
                   v.status_pagamento::text
            FROM vendas v
            WHERE v.id = @vendaId AND v.deleted_at IS NULL
            """;

        public const string GetSaldoCasco =
            "SELECT saldo_cascos FROM vw_saldo_casco_cliente WHERE cliente_id = @clienteId";
    }
}
