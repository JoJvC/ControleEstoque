using ControleEstoque.Shared.Results;
using ControleEstoque.Vendas.Domain;
using Npgsql;

namespace ControleEstoque.Vendas.Repository;

/// <summary>
/// Trava, saldo e reservado por produto+marca, na mesma transação: usada pela venda (nova e edição) e pelo início
/// do pedido, para que as duas disputem a mesma trava.
/// </summary>
internal static class ChecagemEstoque
{
    // NO KEY UPDATE não conflita com o FOR KEY SHARE das FKs: lançamentos positivos não esperam.
    private const string TravaProdutoMarcas =
        "SELECT id FROM produto_marcas WHERE id = ANY(@ids) ORDER BY id FOR NO KEY UPDATE";

    private const string GetSaldosEstoque = """
        SELECT produto_marca_id, COALESCE(SUM(quantidade), 0)::bigint
        FROM movimentos_estoque
        WHERE produto_marca_id = ANY(@ids) AND deleted_at IS NULL
        GROUP BY produto_marca_id
        """;

    // Reserva = itens dos pedidos EM_ANDAMENTO; PENDENTE, CONCLUIDO e CANCELADO não reservam.
    private const string GetReservado = """
        SELECT i.produto_marca_id, COALESCE(SUM(i.quantidade), 0)::bigint
        FROM pedido_itens i
        JOIN pedidos p ON p.id = i.pedido_id
        WHERE p.status = 'EM_ANDAMENTO' AND i.produto_marca_id = ANY(@ids)
        GROUP BY i.produto_marca_id
        """;

    /// <summary>
    /// Trava as associações em ordem de id e, em outras instruções da mesma transação (READ COMMITTED), confere
    /// saldo − reservado − saída por associação. Na falta, devolve a primeira com o disponível em <c>Saldo</c>.
    /// </summary>
    public static async Task<SaldoInsuficiente?> ChecarAsync(
        NpgsqlConnection connection, NpgsqlTransaction transaction, IReadOnlyDictionary<Guid, long> saidas,
        CancellationToken cancellationToken)
    {
        var ids = saidas.Keys.ToArray();

        await using (var command = new NpgsqlCommand(TravaProdutoMarcas, connection, transaction))
        {
            command.Parameters.AddWithValue("ids", ids);
            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            while (await reader.ReadAsync(cancellationToken))
            {
            }
        }

        var saldos = await LerAsync(connection, transaction, GetSaldosEstoque, ids, cancellationToken);
        var reservados = await LerAsync(connection, transaction, GetReservado, ids, cancellationToken);

        foreach (var (produtoMarcaId, saida) in saidas)
        {
            var saldo = saldos.GetValueOrDefault(produtoMarcaId);
            var reservado = reservados.GetValueOrDefault(produtoMarcaId);
            if (EstoqueDisponivel.Falta(saldo, reservado, saida))
            {
                return new SaldoInsuficiente(produtoMarcaId, EstoqueDisponivel.Disponivel(saldo, reservado), saida);
            }
        }

        return null;
    }

    private static async Task<Dictionary<Guid, long>> LerAsync(
        NpgsqlConnection connection, NpgsqlTransaction transaction, string sql, Guid[] ids,
        CancellationToken cancellationToken)
    {
        var lidos = new Dictionary<Guid, long>();
        await using var command = new NpgsqlCommand(sql, connection, transaction);
        command.Parameters.AddWithValue("ids", ids);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            lidos[reader.GetGuid(0)] = reader.GetInt64(1);
        }

        return lidos;
    }
}
