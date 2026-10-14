using ControleEstoque.Vendas.Domain;
using Npgsql;

namespace ControleEstoque.Vendas.Repository;

public sealed class PostgresCupomFiscalRepository : ICupomFiscalRepository
{
    private readonly NpgsqlDataSource dataSource;

    public PostgresCupomFiscalRepository(NpgsqlDataSource dataSource) => this.dataSource = dataSource;

    public async Task<bool> JaEmitidoAsync(Guid vendaId, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(Sql.JaEmitido, connection);
        command.Parameters.AddWithValue("vendaId", vendaId);
        return (bool?)await command.ExecuteScalarAsync(cancellationToken) == true;
    }

    public async Task<CupomFiscal> EmitirAsync(Guid vendaId, CancellationToken cancellationToken)
    {
        // MVP: número sequencial local persistido; integração com emissor fiscal
        // (SEFAZ) é feature futura — o payload JSONB já reserva o espaço.
        var id = Guid.NewGuid();
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(Sql.Emitir, connection);
        command.Parameters.AddWithValue("id", id);
        command.Parameters.AddWithValue("vendaId", vendaId);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        await reader.ReadAsync(cancellationToken);
        return new CupomFiscal(id, reader.GetString(0), reader.GetFieldValue<DateTimeOffset>(1));
    }

    private static class Sql
    {
        public const string JaEmitido = """
            SELECT EXISTS (SELECT 1 FROM cupons_fiscais
                           WHERE venda_id = @vendaId AND deleted_at IS NULL)
            """;

        public const string Emitir = """
            INSERT INTO cupons_fiscais (id, venda_id, numero)
            VALUES (@id, @vendaId, 'CF-' || lpad(nextval('cupom_fiscal_seq')::text, 8, '0'))
            RETURNING numero, emitido_em
            """;
    }
}
