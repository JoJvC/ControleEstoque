using ControleEstoque.Clientes.Domain;
using Npgsql;
using NpgsqlTypes;

namespace ControleEstoque.Clientes.Repository;

public sealed class PostgresSucataClienteRepository : ISucataClienteRepository
{
    private readonly NpgsqlDataSource dataSource;

    public PostgresSucataClienteRepository(NpgsqlDataSource dataSource) => this.dataSource = dataSource;

    public async Task<ResultadoEntregaSucata> EntregarAsync(
        Guid clienteId, Guid tipoCascoId, int quantidade, decimal? valorConversao,
        CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);

        // Registro do cliente — nunca toca movimentos_casco_cliente.
        await using (var command = new NpgsqlCommand(Sql.InsertEntrega, connection, transaction))
        {
            command.Parameters.AddWithValue("clienteId", clienteId);
            command.Parameters.AddWithValue("tipoCascoId", tipoCascoId);
            command.Parameters.AddWithValue("quantidade", quantidade);
            command.Parameters.Add(new NpgsqlParameter("valorConversao", NpgsqlDbType.Numeric)
            {
                Value = (object?)valorConversao ?? DBNull.Value
            });
            await command.ExecuteNonQueryAsync(cancellationToken);
        }

        await using (var command = new NpgsqlCommand(Sql.InsertMovimentoEstoqueCasco, connection, transaction))
        {
            command.Parameters.AddWithValue("tipoCascoId", tipoCascoId);
            command.Parameters.AddWithValue("quantidade", quantidade);
            await command.ExecuteNonQueryAsync(cancellationToken);
        }

        if (valorConversao is > 0)
        {
            await using var command = new NpgsqlCommand(Sql.InsertCreditoFiado, connection, transaction);
            command.Parameters.AddWithValue("clienteId", clienteId);
            command.Parameters.AddWithValue("valor", valorConversao.Value);
            command.Parameters.AddWithValue(
                "observacao", $"Crédito por entrega de {quantidade} sucata(s)");
            await command.ExecuteNonQueryAsync(cancellationToken);
        }

        long totalEntregue;
        await using (var command = new NpgsqlCommand(Sql.GetTotalEntregue, connection, transaction))
        {
            command.Parameters.AddWithValue("clienteId", clienteId);
            totalEntregue = (long?)await command.ExecuteScalarAsync(cancellationToken) ?? 0;
        }

        decimal saldoFiado;
        await using (var command = new NpgsqlCommand(Sql.GetSaldoFiado, connection, transaction))
        {
            command.Parameters.AddWithValue("clienteId", clienteId);
            saldoFiado = (decimal?)await command.ExecuteScalarAsync(cancellationToken) ?? 0m;
        }

        await transaction.CommitAsync(cancellationToken);
        return new ResultadoEntregaSucata(totalEntregue, saldoFiado);
    }

    private static class Sql
    {
        public const string InsertEntrega = """
            INSERT INTO entregas_sucata_cliente (cliente_id, tipo_casco_id, quantidade, valor_conversao)
            VALUES (@clienteId, @tipoCascoId, @quantidade, @valorConversao)
            """;

        public const string InsertMovimentoEstoqueCasco = """
            INSERT INTO movimentos_estoque_casco (tipo_casco_id, situacao, tipo, quantidade)
            VALUES (@tipoCascoId, 'SUCATA', 'ENTRADA_SUCATA', @quantidade)
            """;

        public const string InsertCreditoFiado = """
            INSERT INTO lancamentos_fiado (cliente_id, tipo, valor, observacao)
            VALUES (@clienteId, 'CREDITO_CONVERSAO_SUCATA', @valor, @observacao)
            """;

        // SUM(bigint) é numeric no Postgres: o ::bigint mantém o (long?) do ExecuteScalar.
        public const string GetTotalEntregue =
            "SELECT COALESCE(SUM(total_entregue), 0)::bigint FROM vw_sucata_entregue_cliente WHERE cliente_id = @clienteId";

        public const string GetSaldoFiado =
            "SELECT saldo_devedor FROM vw_saldo_fiado_cliente WHERE cliente_id = @clienteId";
    }
}
