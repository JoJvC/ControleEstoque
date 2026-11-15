using ControleEstoque.Clientes.Domain;
using Npgsql;

namespace ControleEstoque.Clientes.Repository;

public sealed class PostgresCascoClienteRepository : ICascoClienteRepository
{
    private readonly NpgsqlDataSource dataSource;

    public PostgresCascoClienteRepository(NpgsqlDataSource dataSource) => this.dataSource = dataSource;

    public async Task<long> GetSaldoAsync(
        Guid clienteId, Guid tipoCascoId, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(Sql.GetSaldoTipo, connection);
        command.Parameters.AddWithValue("clienteId", clienteId);
        command.Parameters.AddWithValue("tipoCascoId", tipoCascoId);
        return (long?)await command.ExecuteScalarAsync(cancellationToken) ?? 0;
    }

    public async Task<ResultadoDevolucaoCasco> DevolverAsync(
        Guid clienteId, Guid tipoCascoId, int quantidade, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);

        await using (var command = new NpgsqlCommand(Sql.InsertMovimentoCasco, connection, transaction))
        {
            command.Parameters.AddWithValue("clienteId", clienteId);
            command.Parameters.AddWithValue("tipoCascoId", tipoCascoId);
            command.Parameters.AddWithValue("tipo", "DEVOLUCAO");
            command.Parameters.AddWithValue("quantidade", quantidade);
            await command.ExecuteNonQueryAsync(cancellationToken);
        }

        // O vazio devolvido entra no estoque físico da loja, no tipo de casco devolvido.
        await using (var command = new NpgsqlCommand(Sql.InsertMovimentoEstoqueCasco, connection, transaction))
        {
            command.Parameters.AddWithValue("tipoCascoId", tipoCascoId);
            command.Parameters.AddWithValue("quantidade", quantidade);
            await command.ExecuteNonQueryAsync(cancellationToken);
        }

        var novoSaldo = await GetSaldoAsync(connection, transaction, clienteId, cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return new ResultadoDevolucaoCasco(novoSaldo);
    }

    public async Task<ResultadoConversaoCasco> ConverterAsync(
        Guid clienteId, Guid tipoCascoId, int quantidade, decimal valorUnitario,
        CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);

        await using (var command = new NpgsqlCommand(Sql.InsertMovimentoCasco, connection, transaction))
        {
            command.Parameters.AddWithValue("clienteId", clienteId);
            command.Parameters.AddWithValue("tipoCascoId", tipoCascoId);
            command.Parameters.AddWithValue("tipo", "CONVERSAO_VALOR");
            command.Parameters.AddWithValue("quantidade", quantidade);
            await command.ExecuteNonQueryAsync(cancellationToken);
        }

        // A pendência migra para a conta corrente financeira (fiado).
        // Sem entrada no estoque físico: o casco fica com o cliente, agora comprado.
        await using (var command = new NpgsqlCommand(Sql.InsertLancamentoFiado, connection, transaction))
        {
            command.Parameters.AddWithValue("clienteId", clienteId);
            command.Parameters.AddWithValue("tipo", "DEBITO_CONVERSAO_CASCO");
            command.Parameters.AddWithValue("valor", quantidade * valorUnitario);
            command.Parameters.AddWithValue("observacao", $"Conversão de {quantidade} casco(s) em valor");
            await command.ExecuteNonQueryAsync(cancellationToken);
        }

        var novoSaldoCascos = await GetSaldoAsync(connection, transaction, clienteId, cancellationToken);
        var novoSaldoFiado = await GetSaldoFiadoAsync(connection, transaction, clienteId, cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return new ResultadoConversaoCasco(novoSaldoCascos, novoSaldoFiado);
    }

    private static async Task<long> GetSaldoAsync(
        NpgsqlConnection connection, NpgsqlTransaction? transaction, Guid clienteId,
        CancellationToken cancellationToken)
    {
        await using var command = new NpgsqlCommand(Sql.GetSaldo, connection, transaction);
        command.Parameters.AddWithValue("clienteId", clienteId);
        return (long?)await command.ExecuteScalarAsync(cancellationToken) ?? 0;
    }

    private static async Task<decimal> GetSaldoFiadoAsync(
        NpgsqlConnection connection, NpgsqlTransaction transaction, Guid clienteId,
        CancellationToken cancellationToken)
    {
        await using var command = new NpgsqlCommand(Sql.GetSaldoFiado, connection, transaction);
        command.Parameters.AddWithValue("clienteId", clienteId);
        return (decimal?)await command.ExecuteScalarAsync(cancellationToken) ?? 0m;
    }

    private static class Sql
    {
        public const string InsertMovimentoCasco = """
            INSERT INTO movimentos_casco_cliente (cliente_id, tipo_casco_id, tipo, quantidade)
            VALUES (@clienteId, @tipoCascoId, @tipo::tipo_movimento_casco, @quantidade)
            """;

        public const string InsertMovimentoEstoqueCasco = """
            INSERT INTO movimentos_estoque_casco (tipo_casco_id, situacao, tipo, quantidade)
            VALUES (@tipoCascoId, 'VAZIO', 'DEVOLUCAO_CLIENTE', @quantidade)
            """;

        public const string InsertLancamentoFiado = """
            INSERT INTO lancamentos_fiado (cliente_id, tipo, valor, observacao)
            VALUES (@clienteId, @tipo::tipo_lancamento_fiado, @valor, @observacao)
            """;

        // SUM(bigint) é numeric no Postgres: o ::bigint mantém o (long?) do ExecuteScalar.
        public const string GetSaldo =
            "SELECT COALESCE(SUM(saldo_cascos), 0)::bigint FROM vw_saldo_casco_cliente WHERE cliente_id = @clienteId";

        public const string GetSaldoTipo = """
            SELECT COALESCE(SUM(saldo_cascos), 0)::bigint FROM vw_saldo_casco_cliente
            WHERE cliente_id = @clienteId AND tipo_casco_id = @tipoCascoId
            """;

        public const string GetSaldoFiado =
            "SELECT saldo_devedor FROM vw_saldo_fiado_cliente WHERE cliente_id = @clienteId";
    }
}
