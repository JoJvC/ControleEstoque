using ControleEstoque.Clientes.Domain;
using ControleEstoque.Shared.Results;
using Npgsql;

namespace ControleEstoque.Clientes.Repository;

public sealed class PostgresCascoClienteRepository : ICascoClienteRepository
{
    private readonly NpgsqlDataSource dataSource;

    public PostgresCascoClienteRepository(NpgsqlDataSource dataSource) => this.dataSource = dataSource;

    public async Task<long> GetSaldoAsync(Guid clienteId, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        return await GetSaldoAsync(connection, null, clienteId, cancellationToken);
    }

    public async Task<ResultadoDevolucaoCasco> DevolverAsync(
        Guid clienteId, int quantidade, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);

        var cascoProdutoId = await GetProdutoEstruturalAsync(connection, transaction, "CASCO", cancellationToken);

        await using (var command = new NpgsqlCommand(Sql.InsertMovimentoCasco, connection, transaction))
        {
            command.Parameters.AddWithValue("clienteId", clienteId);
            command.Parameters.AddWithValue("tipo", "DEVOLUCAO");
            command.Parameters.AddWithValue("quantidade", quantidade);
            await command.ExecuteNonQueryAsync(cancellationToken);
        }

        // O vazio devolvido entra no estoque físico da loja.
        await using (var command = new NpgsqlCommand(Sql.InsertMovimentoEstoque, connection, transaction))
        {
            command.Parameters.AddWithValue("produtoId", cascoProdutoId);
            command.Parameters.AddWithValue("tipo", "DEVOLUCAO_CLIENTE");
            command.Parameters.AddWithValue("quantidade", quantidade);
            await command.ExecuteNonQueryAsync(cancellationToken);
        }

        var novoSaldo = await GetSaldoAsync(connection, transaction, clienteId, cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return new ResultadoDevolucaoCasco(novoSaldo);
    }

    public async Task<ResultadoConversaoCasco> ConverterAsync(
        Guid clienteId, int quantidade, decimal valorUnitario, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);

        await using (var command = new NpgsqlCommand(Sql.InsertMovimentoCasco, connection, transaction))
        {
            command.Parameters.AddWithValue("clienteId", clienteId);
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

    private static async Task<Guid> GetProdutoEstruturalAsync(
        NpgsqlConnection connection, NpgsqlTransaction transaction, string tipo, CancellationToken cancellationToken)
    {
        await using var command = new NpgsqlCommand(Sql.GetProdutoEstrutural, connection, transaction);
        command.Parameters.AddWithValue("tipo", tipo);
        var id = (Guid?)await command.ExecuteScalarAsync(cancellationToken);
        return id ?? throw new BusinessRuleException(
            "PRODUTO_ESTRUTURAL_AUSENTE", $"Produto estrutural {tipo} não cadastrado.");
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
        public const string GetProdutoEstrutural = """
            SELECT id FROM produtos
            WHERE tipo = @tipo::tipo_produto AND deleted_at IS NULL
            ORDER BY created_at LIMIT 1
            """;

        public const string InsertMovimentoCasco = """
            INSERT INTO movimentos_casco_cliente (cliente_id, tipo, quantidade)
            VALUES (@clienteId, @tipo::tipo_movimento_casco, @quantidade)
            """;

        public const string InsertMovimentoEstoque = """
            INSERT INTO movimentos_estoque (produto_id, tipo, quantidade)
            VALUES (@produtoId, @tipo::tipo_movimento_estoque, @quantidade)
            """;

        public const string InsertLancamentoFiado = """
            INSERT INTO lancamentos_fiado (cliente_id, tipo, valor, observacao)
            VALUES (@clienteId, @tipo::tipo_lancamento_fiado, @valor, @observacao)
            """;

        public const string GetSaldo =
            "SELECT saldo_cascos FROM vw_saldo_casco_cliente WHERE cliente_id = @clienteId";

        public const string GetSaldoFiado =
            "SELECT saldo_devedor FROM vw_saldo_fiado_cliente WHERE cliente_id = @clienteId";
    }
}
