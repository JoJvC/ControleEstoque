using ControleEstoque.Clientes.Domain;
using Npgsql;

namespace ControleEstoque.Clientes.Repository;

public sealed class PostgresTipoCascoLeituraRepository : ITipoCascoLeituraRepository
{
    private readonly NpgsqlDataSource dataSource;

    public PostgresTipoCascoLeituraRepository(NpgsqlDataSource dataSource) => this.dataSource = dataSource;

    public async Task<TipoCascoCliente?> GetAsync(Guid tipoCascoId, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(Sql.Get, connection);
        command.Parameters.AddWithValue("id", tipoCascoId);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        return await reader.ReadAsync(cancellationToken)
            ? new TipoCascoCliente(
                reader.GetGuid(0), reader.GetString(1), reader.GetBoolean(2))
            : null;
    }

    private static class Sql
    {
        public const string Get = """
            SELECT id, nome, aceita_sucata
            FROM tipos_casco
            WHERE id = @id AND deleted_at IS NULL
            """;
    }
}
