using ControleEstoque.Shared.Results;
using ControleEstoque.Vendas.Domain;
using Npgsql;
using NpgsqlTypes;

namespace ControleEstoque.Vendas.Repository;

public sealed class PostgresVendaRepository : IVendaRepository
{
    private readonly NpgsqlDataSource dataSource;

    public PostgresVendaRepository(NpgsqlDataSource dataSource) => this.dataSource = dataSource;

    public async Task<ResultadoGravacao> CriarAsync(VendaGravacao gravacao, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);

        // Ordem das travas: caixa, venda/cliente, produtos. Venda sem pagamento (só fiado) não toca o caixa.
        if (gravacao.Pagamentos.Count > 0)
        {
            await GarantirCaixaHojeAbertoAsync(connection, transaction, cancellationToken);
        }

        await TravarClienteParaCreditoAsync(connection, transaction, gravacao, cancellationToken);

        if (await ChecarSaldoAsync(connection, transaction, gravacao, cancellationToken) is { } falta)
        {
            return new ResultadoGravacao([], falta); // sem Commit: o Dispose da transação faz rollback.
        }

        await using (var command = new NpgsqlCommand(Sql.InsertVenda, connection, transaction))
        {
            AddVendaParameters(command, gravacao);
            await command.ExecuteNonQueryAsync(cancellationToken);
        }

        await InserirEfeitosAsync(connection, transaction, gravacao, cancellationToken);

        var saldo = await GetSaldoCascoAsync(connection, transaction, gravacao.ClienteId, cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return new ResultadoGravacao(saldo);
    }

    public async Task<ResultadoGravacao> EditarAsync(VendaGravacao gravacao, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);

        await GarantirCaixasDaEdicaoAbertosAsync(connection, transaction, gravacao, cancellationToken);

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

        await TravarClienteParaCreditoAsync(connection, transaction, gravacao, cancellationToken);

        if (await ChecarSaldoAsync(connection, transaction, gravacao, cancellationToken) is { } falta)
        {
            return new ResultadoGravacao([], falta); // sem Commit: o Dispose da transação faz rollback.
        }

        await InserirEfeitosAsync(connection, transaction, gravacao, cancellationToken);

        var saldo = await GetSaldoCascoAsync(connection, transaction, gravacao.ClienteId, cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return new ResultadoGravacao(saldo);
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

        var devolvidos = await LerCascosPorVendaAsync(
            connection, Sql.GetDevolucoes, [vendaId], cancellationToken);
        var sucata = await LerSucatasPorVendaAsync(connection, [vendaId], cancellationToken);
        var vasilhames = await LerVasilhamesPorVendaAsync(connection, [vendaId], cancellationToken);
        return venda with
        {
            Itens = itens,
            Pagamentos = pagamentos,
            CascosDevolvidos = devolvidos.GetValueOrDefault(vendaId) ?? [],
            SucataEntregue = sucata.GetValueOrDefault(vendaId) ?? [],
            Vasilhames = vasilhames.GetValueOrDefault(vendaId) ?? []
        };
    }

    public async Task<IReadOnlyList<Venda>> ListAsync(
        Guid? clienteId, DateOnly? inicio, DateOnly? fim, int page, int pageSize,
        CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        var results = new List<Venda>();
        await using (var command = new NpgsqlCommand(Sql.List, connection))
        {
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
            while (await reader.ReadAsync(cancellationToken))
            {
                results.Add(MapVenda(reader));
            }
        }

        var ids = results.Select(v => v.Id).ToArray();
        var devolvidos = await LerCascosPorVendaAsync(connection, Sql.GetDevolucoes, ids, cancellationToken);
        var sucata = await LerSucatasPorVendaAsync(connection, ids, cancellationToken);
        var vasilhames = await LerVasilhamesPorVendaAsync(connection, ids, cancellationToken);
        return results
            .Select(v => v with
            {
                CascosDevolvidos = devolvidos.GetValueOrDefault(v.Id) ?? [],
                SucataEntregue = sucata.GetValueOrDefault(v.Id) ?? [],
                Vasilhames = vasilhames.GetValueOrDefault(v.Id) ?? []
            })
            .ToList();
    }

    public async Task<InfoPagamentoVenda?> GetInfoPagamentoAsync(
        Guid vendaId, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        return await GetInfoPagamentoAsync(connection, null, vendaId, cancellationToken);
    }

    public async Task<InfoPagamentoVenda> AddPagamentoAsync(
        Guid vendaId, FormaPagamento forma, decimal valor, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);

        // Ordem das travas: caixa (FOR SHARE) e depois a venda (FOR UPDATE).
        await GarantirCaixaHojeAbertoAsync(connection, transaction, cancellationToken);

        await using (var command = new NpgsqlCommand(Sql.TravaVenda, connection, transaction))
        {
            command.Parameters.AddWithValue("vendaId", vendaId);
            if (await command.ExecuteScalarAsync(cancellationToken) is null)
            {
                throw new EntityNotFoundException("VENDA_NAO_ENCONTRADA", $"Venda {vendaId} não encontrada.");
            }
        }

        // Totais relidos sob a trava da venda: pagamentos concorrentes se serializam aqui.
        var info = await GetInfoPagamentoAsync(connection, transaction, vendaId, cancellationToken)
            ?? throw new EntityNotFoundException("VENDA_NAO_ENCONTRADA", $"Venda {vendaId} não encontrada.");
        if (info.TotalPago + valor > info.TotalLiquido)
        {
            throw new BusinessRuleException(
                "PAGAMENTO_EXCEDE_SALDO",
                $"Pagamento de {valor:F2} excede o saldo restante de {info.TotalLiquido - info.TotalPago:F2}.");
        }

        var novoStatus = VendaCalculos.CalcularStatus(info.TotalLiquido, info.TotalPago + valor);

        // O pagamento abate o débito de fiado gerado por esta venda, limitado ao restante.
        var abatimentoFiado = Math.Min(valor, info.DebitoFiadoRestante);

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
        return info;
    }

    public async Task<IReadOnlyList<SaldoCascoTipo>> GetSaldoCascoClienteAsync(
        Guid clienteId, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        return await GetSaldoCascoAsync(connection, null, clienteId, cancellationToken);
    }

    public async Task<UltimoPrecoVenda?> GetUltimoPrecoAsync(
        Guid clienteId, Guid produtoId, Guid marcaId, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(Sql.GetUltimoPreco, connection);
        command.Parameters.AddWithValue("clienteId", clienteId);
        command.Parameters.AddWithValue("produtoId", produtoId);
        command.Parameters.AddWithValue("marcaId", marcaId);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        return await reader.ReadAsync(cancellationToken)
            ? new UltimoPrecoVenda(reader.GetGuid(0), reader.GetFieldValue<DateTimeOffset>(1), reader.GetDecimal(2))
            : null;
    }

    /// <summary>
    /// Trava as associações produto+marca vendidas em ordem de id e, em outra instrução da mesma transação
    /// (READ COMMITTED), confere se o saldo cobre as quantidades (somadas por associação). Na edição roda depois do soft-delete,
    /// então as saídas antigas da própria venda já não contam.
    /// </summary>
    private static async Task<SaldoInsuficiente?> ChecarSaldoAsync(
        NpgsqlConnection connection, NpgsqlTransaction transaction, VendaGravacao gravacao,
        CancellationToken cancellationToken)
    {
        var saidas = gravacao.Itens
            .GroupBy(i => i.ProdutoMarcaId)
            .ToDictionary(g => g.Key, g => g.Sum(i => (long)i.Quantidade));
        var ids = saidas.Keys.ToArray();

        await using (var command = new NpgsqlCommand(Sql.TravaProdutoMarcas, connection, transaction))
        {
            command.Parameters.AddWithValue("ids", ids);
            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            while (await reader.ReadAsync(cancellationToken))
            {
            }
        }

        var saldos = new Dictionary<Guid, long>();
        await using (var command = new NpgsqlCommand(Sql.GetSaldosEstoque, connection, transaction))
        {
            command.Parameters.AddWithValue("ids", ids);
            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            while (await reader.ReadAsync(cancellationToken))
            {
                saldos[reader.GetGuid(0)] = reader.GetInt64(1);
            }
        }

        foreach (var (produtoMarcaId, saida) in saidas)
        {
            var saldo = saldos.GetValueOrDefault(produtoMarcaId);
            if (saldo - saida < 0)
            {
                return new SaldoInsuficiente(produtoMarcaId, saldo, saida);
            }
        }

        return null;
    }

    // ---- privados -----------------------------------------------------------

    private static async Task<InfoPagamentoVenda?> GetInfoPagamentoAsync(
        NpgsqlConnection connection, NpgsqlTransaction? transaction, Guid vendaId,
        CancellationToken cancellationToken)
    {
        await using var command = new NpgsqlCommand(Sql.GetInfoPagamento, connection, transaction);
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

    /// <summary>
    /// Trava o caixa de hoje (mesma base do DEFAULT now() de venda_pagamentos.data) com FOR SHARE, que
    /// conflita com o FOR UPDATE do fechamento. Sem caixa na data, segue; FECHADO lança CAIXA_FECHADO.
    /// </summary>
    private static async Task GarantirCaixaHojeAbertoAsync(
        NpgsqlConnection connection, NpgsqlTransaction transaction, CancellationToken cancellationToken)
    {
        await using var command = new NpgsqlCommand(Sql.TravaCaixaHoje, connection, transaction);
        if ((string?)await command.ExecuteScalarAsync(cancellationToken) == "FECHADO")
        {
            throw new ConflictException("CAIXA_FECHADO", "Não é possível lançar pagamento em caixa fechado.");
        }
    }

    /// <summary>
    /// Edição apaga e reinsere os pagamentos: recusa se algum pagamento atual da venda caiu num dia de caixa
    /// FECHADO, ou se a edição reinsere pagamento (data = hoje) e o caixa de hoje está FECHADO. Travas em
    /// ordem de data, antes da trava da venda e dos produtos.
    /// </summary>
    private static async Task GarantirCaixasDaEdicaoAbertosAsync(
        NpgsqlConnection connection, NpgsqlTransaction transaction, VendaGravacao gravacao,
        CancellationToken cancellationToken)
    {
        await using var command = new NpgsqlCommand(Sql.TravaCaixasDaEdicao, connection, transaction);
        command.Parameters.AddWithValue("vendaId", gravacao.VendaId);
        command.Parameters.AddWithValue("reinsere", gravacao.Pagamentos.Count > 0);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            if (reader.GetString(0) == "FECHADO")
            {
                throw new ConflictException(
                    "CAIXA_FECHADO", "Não é possível editar venda com pagamento em caixa fechado.");
            }
        }
    }

    /// <summary>
    /// Só com uso de crédito ou vasilhame abatido do crédito de galão: trava o cliente (ordem caixa, venda, cliente,
    /// produtos) e relê os saldos sob a trava; recusa com CREDITO_INSUFICIENTE se o uso passa de max(0, saldo) do fiado
    /// e com CREDITO_CASCO_INSUFICIENTE se o abate passa do crédito de galão do tipo (sem commit). Na edição roda depois
    /// do soft-delete dos efeitos, então o uso e o abate anteriores da própria venda não contam.
    /// </summary>
    private static async Task TravarClienteParaCreditoAsync(
        NpgsqlConnection connection, NpgsqlTransaction transaction, VendaGravacao gravacao,
        CancellationToken cancellationToken)
    {
        var abatidos = gravacao.Vasilhames.Where(v => v.QuantidadeAbatida > 0).ToList();
        if (gravacao.UsoCredito <= 0 && abatidos.Count == 0)
        {
            return;
        }

        await using (var command = new NpgsqlCommand(Sql.TravaCliente, connection, transaction))
        {
            command.Parameters.AddWithValue("clienteId", gravacao.ClienteId);
            await command.ExecuteScalarAsync(cancellationToken);
        }

        if (gravacao.UsoCredito > 0)
        {
            decimal saldo;
            await using (var command = new NpgsqlCommand(Sql.SaldoCliente, connection, transaction))
            {
                command.Parameters.AddWithValue("clienteId", gravacao.ClienteId);
                saldo = (decimal?)await command.ExecuteScalarAsync(cancellationToken) ?? 0m;
            }

            VendaCalculos.ValidarUsoCredito(gravacao.UsoCredito, Math.Max(0m, saldo));
        }

        foreach (var vasilhame in abatidos)
        {
            long saldoCasco;
            await using (var command = new NpgsqlCommand(Sql.SaldoCascoTipo, connection, transaction))
            {
                command.Parameters.AddWithValue("clienteId", gravacao.ClienteId);
                command.Parameters.AddWithValue("tipoCascoId", vasilhame.TipoCascoId);
                saldoCasco = (long?)await command.ExecuteScalarAsync(cancellationToken) ?? 0L;
            }

            if (vasilhame.QuantidadeAbatida > Math.Max(0L, -saldoCasco))
            {
                throw new BusinessRuleException(
                    "CREDITO_CASCO_INSUFICIENTE",
                    $"Abate de {vasilhame.QuantidadeAbatida} vasilhame(s) do tipo {vasilhame.TipoCascoId} " +
                    $"excede o crédito de galão do cliente ({Math.Max(0L, -saldoCasco)}).");
            }
        }
    }

    private static async Task InserirEfeitosAsync(
        NpgsqlConnection connection, NpgsqlTransaction transaction, VendaGravacao gravacao,
        CancellationToken cancellationToken)
    {
        foreach (var item in gravacao.Itens)
        {
            await using (var command = new NpgsqlCommand(Sql.InsertItem, connection, transaction))
            {
                command.Parameters.AddWithValue("vendaId", gravacao.VendaId);
                command.Parameters.AddWithValue("produtoMarcaId", item.ProdutoMarcaId);
                command.Parameters.Add(new NpgsqlParameter("tipoCascoId", NpgsqlDbType.Uuid)
                {
                    Value = (object?)item.TipoCascoId ?? DBNull.Value
                });
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
                command.Parameters.AddWithValue("produtoMarcaId", item.ProdutoMarcaId);
                command.Parameters.AddWithValue("tipo", "SAIDA_VENDA");
                command.Parameters.AddWithValue("quantidade", -item.Quantidade);
                command.Parameters.AddWithValue("vendaId", gravacao.VendaId);
                await command.ExecuteNonQueryAsync(cancellationToken);
            }
        }

        // Galões cheios do tipo que não foram pagos como vasilhame = casco emprestado.
        foreach (var casco in gravacao.CascosEmprestados)
        {
            await InserirMovimentoCascoAsync(
                connection, transaction, gravacao, "EMPRESTIMO", casco, cancellationToken);
        }

        // Vasilhame vendido: registro por tipo; o abatido do crédito de galão volta como EMPRESTIMO (o crédito diminui).
        foreach (var vasilhame in gravacao.Vasilhames)
        {
            await using var command = new NpgsqlCommand(Sql.InsertVasilhame, connection, transaction);
            command.Parameters.AddWithValue("vendaId", gravacao.VendaId);
            command.Parameters.AddWithValue("tipoCascoId", vasilhame.TipoCascoId);
            command.Parameters.AddWithValue("quantidade", vasilhame.Quantidade);
            command.Parameters.AddWithValue("quantidadeAbatida", vasilhame.QuantidadeAbatida);
            command.Parameters.AddWithValue("precoUnitario", vasilhame.PrecoUnitario);
            command.Parameters.AddWithValue("modo", vasilhame.Modo.ToString());
            command.Parameters.AddWithValue("total", vasilhame.Total);
            await command.ExecuteNonQueryAsync(cancellationToken);

            if (vasilhame.QuantidadeAbatida > 0)
            {
                await InserirMovimentoCascoAsync(
                    connection, transaction, gravacao, "EMPRESTIMO",
                    new CascoQuantidade(vasilhame.TipoCascoId, vasilhame.QuantidadeAbatida), cancellationToken);
            }
        }

        // Vasilhames além dos galões cheios da venda saem dos vazios da loja (sem bloqueio por saldo).
        foreach (var casco in gravacao.VaziosSaidos)
        {
            await InserirMovimentoEstoqueCascoAsync(
                connection, transaction, gravacao, "VAZIO", "SAIDA_VENDA", casco with { Quantidade = -casco.Quantidade },
                cancellationToken);
        }

        // Devolução: abate o saldo do cliente no tipo e dá entrada no vazio do tipo.
        foreach (var casco in gravacao.CascosDevolvidos)
        {
            await InserirMovimentoCascoAsync(
                connection, transaction, gravacao, "DEVOLUCAO", casco, cancellationToken);
            await InserirMovimentoEstoqueCascoAsync(
                connection, transaction, gravacao, "VAZIO", "DEVOLUCAO_CLIENTE", casco, cancellationToken);
        }

        // Sucata entregue: vira desconto da venda (venda_sucatas), não entra no saldo de sucata do cliente
        // e dá entrada no estoque de sucata da loja. Não toca o ledger de casco do cliente.
        foreach (var sucata in gravacao.SucataEntregue)
        {
            await using (var command = new NpgsqlCommand(Sql.InsertVendaSucata, connection, transaction))
            {
                command.Parameters.AddWithValue("vendaId", gravacao.VendaId);
                command.Parameters.AddWithValue("tipoCascoId", sucata.TipoCascoId);
                command.Parameters.AddWithValue("quantidade", sucata.Quantidade);
                command.Parameters.AddWithValue("valorUnitario", sucata.ValorUnitario);
                command.Parameters.AddWithValue("total", sucata.Total);
                await command.ExecuteNonQueryAsync(cancellationToken);
            }

            await InserirMovimentoEstoqueCascoAsync(
                connection, transaction, gravacao, "SUCATA", "ENTRADA_SUCATA",
                new CascoQuantidade(sucata.TipoCascoId, sucata.Quantidade), cancellationToken);
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

        if (gravacao.UsoCredito > 0)
        {
            await using var command = new NpgsqlCommand(Sql.InsertUsoCredito, connection, transaction);
            command.Parameters.AddWithValue("clienteId", gravacao.ClienteId);
            command.Parameters.AddWithValue("vendaId", gravacao.VendaId);
            command.Parameters.AddWithValue("valor", gravacao.UsoCredito);
            await command.ExecuteNonQueryAsync(cancellationToken);
        }

        // Pagamento acima do líquido: a sobra vira crédito do cliente.
        if (gravacao.CreditoGerado > 0)
        {
            await using var command = new NpgsqlCommand(Sql.InsertCreditoSobra, connection, transaction);
            command.Parameters.AddWithValue("clienteId", gravacao.ClienteId);
            command.Parameters.AddWithValue("vendaId", gravacao.VendaId);
            command.Parameters.AddWithValue("valor", gravacao.CreditoGerado);
            await command.ExecuteNonQueryAsync(cancellationToken);
        }
    }

    private static async Task InserirMovimentoCascoAsync(
        NpgsqlConnection connection, NpgsqlTransaction transaction, VendaGravacao gravacao,
        string tipo, CascoQuantidade casco, CancellationToken cancellationToken)
    {
        await using var command = new NpgsqlCommand(Sql.InsertMovimentoCasco, connection, transaction);
        command.Parameters.AddWithValue("clienteId", gravacao.ClienteId);
        command.Parameters.AddWithValue("vendaId", gravacao.VendaId);
        command.Parameters.AddWithValue("tipoCascoId", casco.TipoCascoId);
        command.Parameters.AddWithValue("tipo", tipo);
        command.Parameters.AddWithValue("quantidade", casco.Quantidade);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    private static async Task InserirMovimentoEstoqueCascoAsync(
        NpgsqlConnection connection, NpgsqlTransaction transaction, VendaGravacao gravacao,
        string situacao, string tipo, CascoQuantidade casco, CancellationToken cancellationToken)
    {
        await using var command = new NpgsqlCommand(Sql.InsertMovimentoEstoqueCasco, connection, transaction);
        command.Parameters.AddWithValue("tipoCascoId", casco.TipoCascoId);
        command.Parameters.AddWithValue("situacao", situacao);
        command.Parameters.AddWithValue("tipo", tipo);
        command.Parameters.AddWithValue("quantidade", casco.Quantidade);
        command.Parameters.AddWithValue("vendaId", gravacao.VendaId);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    private static async Task<IReadOnlyList<SaldoCascoTipo>> GetSaldoCascoAsync(
        NpgsqlConnection connection, NpgsqlTransaction? transaction, Guid clienteId,
        CancellationToken cancellationToken)
    {
        await using var command = new NpgsqlCommand(Sql.GetSaldoCasco, connection, transaction);
        command.Parameters.AddWithValue("clienteId", clienteId);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        var saldos = new List<SaldoCascoTipo>();
        while (await reader.ReadAsync(cancellationToken))
        {
            saldos.Add(new SaldoCascoTipo(reader.GetGuid(0), reader.GetString(1), reader.GetInt64(2)));
        }

        return saldos;
    }

    /// <summary>Devolução ou sucata da venda, somada por tipo de casco; lê várias vendas de uma vez.</summary>
    private static async Task<Dictionary<Guid, List<CascoQuantidade>>> LerCascosPorVendaAsync(
        NpgsqlConnection connection, string sql, Guid[] vendaIds, CancellationToken cancellationToken)
    {
        await using var command = new NpgsqlCommand(sql, connection);
        command.Parameters.AddWithValue("vendaIds", vendaIds);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        var porVenda = new Dictionary<Guid, List<CascoQuantidade>>();
        while (await reader.ReadAsync(cancellationToken))
        {
            var vendaId = reader.GetGuid(0);
            if (!porVenda.TryGetValue(vendaId, out var lista))
            {
                porVenda[vendaId] = lista = [];
            }

            lista.Add(new CascoQuantidade(reader.GetGuid(1), reader.GetInt32(2)));
        }

        return porVenda;
    }

    /// <summary>Sucata da venda por tipo e valor unitário; lê várias vendas de uma vez.</summary>
    private static async Task<Dictionary<Guid, List<SucataVenda>>> LerSucatasPorVendaAsync(
        NpgsqlConnection connection, Guid[] vendaIds, CancellationToken cancellationToken)
    {
        await using var command = new NpgsqlCommand(Sql.GetSucata, connection);
        command.Parameters.AddWithValue("vendaIds", vendaIds);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        var porVenda = new Dictionary<Guid, List<SucataVenda>>();
        while (await reader.ReadAsync(cancellationToken))
        {
            var vendaId = reader.GetGuid(0);
            if (!porVenda.TryGetValue(vendaId, out var lista))
            {
                porVenda[vendaId] = lista = [];
            }

            lista.Add(new SucataVenda(reader.GetGuid(1), reader.GetInt32(2), reader.GetDecimal(3)));
        }

        return porVenda;
    }

    private static async Task<Dictionary<Guid, List<VasilhameCalculado>>> LerVasilhamesPorVendaAsync(
        NpgsqlConnection connection, Guid[] vendaIds, CancellationToken cancellationToken)
    {
        await using var command = new NpgsqlCommand(Sql.GetVasilhames, connection);
        command.Parameters.AddWithValue("vendaIds", vendaIds);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        var porVenda = new Dictionary<Guid, List<VasilhameCalculado>>();
        while (await reader.ReadAsync(cancellationToken))
        {
            var vendaId = reader.GetGuid(0);
            if (!porVenda.TryGetValue(vendaId, out var lista))
            {
                porVenda[vendaId] = lista = [];
            }

            lista.Add(new VasilhameCalculado(
                reader.GetGuid(1), reader.GetInt32(2), reader.GetInt32(3), reader.GetDecimal(4),
                Enum.Parse<ModoCreditoVasilhame>(reader.GetString(5)), reader.GetDecimal(6)));
        }

        return porVenda;
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
        command.Parameters.AddWithValue("descontoSucata", gravacao.DescontoSucata);
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
        [],
        [],
        [],
        [],
        reader.IsDBNull(11) ? null : reader.GetString(11),
        reader.IsDBNull(12) ? null : reader.GetFieldValue<DateTimeOffset>(12),
        reader.GetDecimal(13));

    private static ItemCalculado MapItem(NpgsqlDataReader reader)
    {
        var quantidade = reader.GetInt32(4);
        var precoUnitario = reader.GetDecimal(5);
        var descontoTipo = reader.IsDBNull(6) ? null : reader.GetString(6);
        var totalItem = reader.GetDecimal(9);
        var bruto = quantidade * precoUnitario;

        Desconto? desconto = descontoTipo is null
            ? null
            : new Desconto(
                Enum.Parse<TipoDesconto>(descontoTipo), reader.GetDecimal(7), reader.GetString(8));

        return new ItemCalculado(
            reader.GetGuid(0), reader.GetGuid(1), reader.GetGuid(2),
            reader.IsDBNull(3) ? null : reader.GetGuid(3),
            quantidade, precoUnitario, desconto,
            bruto, bruto - totalItem, totalItem);
    }

    private static class Sql
    {
        private const string SelectVenda = """
            SELECT v.id, v.cliente_id, v.funcionario_id, v.endereco_entrega_id, v.data,
                   v.total_bruto, v.total_desconto, v.total_liquido, v.status_pagamento::text,
                   v.observacao,
                   EXISTS (SELECT 1 FROM cupons_fiscais cf
                           WHERE cf.venda_id = v.id AND cf.deleted_at IS NULL),
                   cf.numero, cf.emitido_em, v.desconto_sucata
            FROM vendas v
            LEFT JOIN LATERAL (SELECT numero, emitido_em FROM cupons_fiscais
                               WHERE venda_id = v.id AND deleted_at IS NULL
                               ORDER BY emitido_em DESC LIMIT 1) cf ON true
            """;

        public const string InsertVenda = """
            INSERT INTO vendas (id, cliente_id, funcionario_id, endereco_entrega_id,
                                total_bruto, total_desconto, desconto_sucata, total_liquido, status_pagamento,
                                observacao, created_by)
            VALUES (@id, @clienteId, @funcionarioId, @enderecoEntregaId,
                    @totalBruto, @totalDesconto, @descontoSucata, @totalLiquido, @status::status_pagamento_venda,
                    @observacao, @funcionarioId)
            """;

        public const string UpdateVenda = """
            UPDATE vendas
            SET cliente_id = @clienteId, funcionario_id = @funcionarioId,
                endereco_entrega_id = @enderecoEntregaId, total_bruto = @totalBruto,
                total_desconto = @totalDesconto, desconto_sucata = @descontoSucata, total_liquido = @totalLiquido,
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
            UPDATE movimentos_estoque_casco SET deleted_at = now()
                WHERE venda_id = @vendaId AND deleted_at IS NULL;
            UPDATE entregas_sucata_cliente SET deleted_at = now()
                WHERE venda_id = @vendaId AND deleted_at IS NULL;
            UPDATE venda_vasilhames SET deleted_at = now()
                WHERE venda_id = @vendaId AND deleted_at IS NULL;
            UPDATE venda_sucatas SET deleted_at = now()
                WHERE venda_id = @vendaId AND deleted_at IS NULL;
            UPDATE lancamentos_fiado SET deleted_at = now()
                WHERE venda_id = @vendaId AND deleted_at IS NULL;
            """;

        public const string InsertItem = """
            INSERT INTO venda_itens (venda_id, produto_marca_id, tipo_casco_id, quantidade, preco_unitario,
                                     desconto_tipo, desconto_valor, motivo_desconto, total_item)
            VALUES (@vendaId, @produtoMarcaId, @tipoCascoId, @quantidade, @precoUnitario,
                    @descontoTipo::tipo_desconto, @descontoValor, @motivoDesconto, @totalItem)
            """;

        // NO KEY UPDATE não conflita com o FOR KEY SHARE das FKs: lançamentos positivos não esperam.
        public const string TravaProdutoMarcas =
            "SELECT id FROM produto_marcas WHERE id = ANY(@ids) ORDER BY id FOR NO KEY UPDATE";

        public const string GetSaldosEstoque = """
            SELECT produto_marca_id, COALESCE(SUM(quantidade), 0)::bigint
            FROM movimentos_estoque
            WHERE produto_marca_id = ANY(@ids) AND deleted_at IS NULL
            GROUP BY produto_marca_id
            """;

        public const string InsertMovimentoEstoque = """
            INSERT INTO movimentos_estoque (produto_marca_id, tipo, quantidade, venda_id)
            VALUES (@produtoMarcaId, @tipo::tipo_movimento_estoque, @quantidade, @vendaId)
            """;

        public const string InsertMovimentoEstoqueCasco = """
            INSERT INTO movimentos_estoque_casco (tipo_casco_id, situacao, tipo, quantidade, venda_id)
            VALUES (@tipoCascoId, @situacao::situacao_casco, @tipo::tipo_movimento_estoque, @quantidade, @vendaId)
            """;

        public const string InsertMovimentoCasco = """
            INSERT INTO movimentos_casco_cliente (cliente_id, venda_id, tipo_casco_id, tipo, quantidade)
            VALUES (@clienteId, @vendaId, @tipoCascoId, @tipo::tipo_movimento_casco, @quantidade)
            """;

        public const string InsertVasilhame = """
            INSERT INTO venda_vasilhames (venda_id, tipo_casco_id, quantidade, quantidade_abatida,
                                          preco_unitario, modo, total)
            VALUES (@vendaId, @tipoCascoId, @quantidade, @quantidadeAbatida, @precoUnitario, @modo, @total)
            """;

        public const string InsertVendaSucata = """
            INSERT INTO venda_sucatas (venda_id, tipo_casco_id, quantidade, valor_unitario, total)
            VALUES (@vendaId, @tipoCascoId, @quantidade, @valorUnitario, @total)
            """;

        public const string InsertPagamento = """
            INSERT INTO venda_pagamentos (venda_id, forma, valor)
            VALUES (@vendaId, @forma::forma_pagamento, @valor)
            """;

        public const string InsertDebitoFiado = """
            INSERT INTO lancamentos_fiado (cliente_id, venda_id, tipo, valor)
            VALUES (@clienteId, @vendaId, 'DEBITO_VENDA', @valor)
            """;

        public const string InsertUsoCredito = """
            INSERT INTO lancamentos_fiado (cliente_id, venda_id, tipo, valor, observacao)
            VALUES (@clienteId, @vendaId, 'DEBITO_USO_CREDITO', @valor, 'Uso de crédito na venda')
            """;

        public const string InsertCreditoSobra = """
            INSERT INTO lancamentos_fiado (cliente_id, venda_id, tipo, valor, observacao)
            VALUES (@clienteId, @vendaId, 'CREDITO_SOBRA_VENDA', @valor, 'Pagamento acima do total da venda')
            """;

        // Mesma conta de vw_saldo_casco_cliente, para um tipo (positivo = cliente deve; negativo = crédito de galão).
        public const string SaldoCascoTipo = """
            SELECT COALESCE(SUM(CASE tipo
                       WHEN 'EMPRESTIMO'      THEN  quantidade
                       WHEN 'DEVOLUCAO'       THEN -quantidade
                       WHEN 'CONVERSAO_VALOR' THEN -quantidade
                   END), 0)::bigint
            FROM movimentos_casco_cliente
            WHERE cliente_id = @clienteId AND tipo_casco_id = @tipoCascoId AND deleted_at IS NULL
            """;

        public const string GetUltimoPreco = """
            SELECT v.id, v.data, i.preco_unitario
            FROM venda_itens i
            JOIN vendas v ON v.id = i.venda_id
            JOIN produto_marcas pm ON pm.id = i.produto_marca_id
            WHERE v.cliente_id = @clienteId AND pm.produto_id = @produtoId AND pm.marca_id = @marcaId
              AND v.deleted_at IS NULL AND i.deleted_at IS NULL
            ORDER BY v.data DESC, i.created_at DESC
            LIMIT 1
            """;

        public const string TravaCliente =
            "SELECT id FROM clientes WHERE id = @clienteId AND deleted_at IS NULL FOR UPDATE";

        public const string SaldoCliente =
            "SELECT saldo FROM vw_saldo_fiado_cliente WHERE cliente_id = @clienteId";

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
            SELECT pm.produto_id, pm.marca_id, i.produto_marca_id, i.tipo_casco_id, i.quantidade,
                   i.preco_unitario, i.desconto_tipo::text,
                   i.desconto_valor, i.motivo_desconto, i.total_item
            FROM venda_itens i
            JOIN produto_marcas pm ON pm.id = i.produto_marca_id
            WHERE i.venda_id = @vendaId AND i.deleted_at IS NULL
            ORDER BY i.created_at
            """;

        public const string GetDevolucoes = """
            SELECT venda_id, tipo_casco_id, SUM(quantidade)::int
            FROM movimentos_casco_cliente
            WHERE venda_id = ANY(@vendaIds) AND tipo = 'DEVOLUCAO' AND deleted_at IS NULL
            GROUP BY venda_id, tipo_casco_id
            ORDER BY venda_id, tipo_casco_id
            """;

        public const string GetSucata = """
            SELECT venda_id, tipo_casco_id, SUM(quantidade)::int, valor_unitario
            FROM venda_sucatas
            WHERE venda_id = ANY(@vendaIds) AND deleted_at IS NULL
            GROUP BY venda_id, tipo_casco_id, valor_unitario
            ORDER BY venda_id, tipo_casco_id, valor_unitario
            """;

        public const string GetVasilhames = """
            SELECT venda_id, tipo_casco_id, quantidade, quantidade_abatida, preco_unitario, modo, total
            FROM venda_vasilhames
            WHERE venda_id = ANY(@vendaIds) AND deleted_at IS NULL
            ORDER BY venda_id, created_at
            """;

        public const string GetPagamentos = """
            SELECT forma::text, valor
            FROM venda_pagamentos
            WHERE venda_id = @vendaId AND deleted_at IS NULL
            ORDER BY data
            """;

        public const string TravaCaixaHoje =
            "SELECT status::text FROM caixas WHERE data = CURRENT_DATE AND deleted_at IS NULL FOR SHARE";

        public const string TravaCaixasDaEdicao = """
            SELECT c.status::text
            FROM caixas c
            WHERE c.deleted_at IS NULL
              AND (c.data IN (SELECT p.data::date FROM venda_pagamentos p
                              WHERE p.venda_id = @vendaId AND p.deleted_at IS NULL)
                   OR (@reinsere AND c.data = CURRENT_DATE))
            ORDER BY c.data
            FOR SHARE OF c
            """;

        public const string TravaVenda =
            "SELECT id FROM vendas WHERE id = @vendaId AND deleted_at IS NULL FOR UPDATE";

        public const string GetInfoPagamento = """
            SELECT v.total_liquido,
                   COALESCE((SELECT SUM(p.valor) FROM venda_pagamentos p
                             WHERE p.venda_id = v.id AND p.deleted_at IS NULL), 0),
                   COALESCE((SELECT SUM(CASE l.tipo
                                 WHEN 'DEBITO_VENDA' THEN l.valor
                                 WHEN 'PAGAMENTO'    THEN -l.valor
                                 ELSE 0 END)
                             FROM lancamentos_fiado l
                             WHERE l.venda_id = v.id AND l.deleted_at IS NULL), 0)
                   - COALESCE((SELECT SUM(p.valor) FROM venda_pagamentos p
                               WHERE p.venda_id = v.id AND p.deleted_at IS NULL
                                 AND p.lancamento_fiado_id IS NOT NULL), 0),
                   v.status_pagamento::text
            FROM vendas v
            WHERE v.id = @vendaId AND v.deleted_at IS NULL
            """;

        // Mesma regra do saldo por tipo de Clientes: sem a linha de tipo NULL (cliente sem movimento) e sem saldo zero.
        public const string GetSaldoCasco = """
            SELECT v.tipo_casco_id, tc.nome, v.saldo_cascos
            FROM vw_saldo_casco_cliente v
            JOIN tipos_casco tc ON tc.id = v.tipo_casco_id
            WHERE v.cliente_id = @clienteId AND v.saldo_cascos <> 0
            ORDER BY tc.nome
            """;
    }
}
