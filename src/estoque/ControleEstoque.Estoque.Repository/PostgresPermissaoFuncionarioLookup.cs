using ControleEstoque.Estoque.Domain;
using Npgsql;

namespace ControleEstoque.Estoque.Repository;

public sealed class PostgresPermissaoFuncionarioLookup : IPermissaoFuncionarioLookup
{
    private readonly NpgsqlDataSource dataSource;

    public PostgresPermissaoFuncionarioLookup(NpgsqlDataSource dataSource) => this.dataSource = dataSource;

    public async Task<IReadOnlyList<string>?> PermissoesAsync(Guid funcionarioId, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(Sql.Permissoes, connection);
        command.Parameters.AddWithValue("funcionarioId", funcionarioId);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);

        // Uma linha por permissão do cargo; o cargo sem permissão devolve uma linha com permissao nula.
        var existe = false;
        var ativo = false;
        var lista = new List<string>();
        while (await reader.ReadAsync(cancellationToken))
        {
            existe = true;
            ativo = reader.GetBoolean(0);
            if (!reader.IsDBNull(1))
            {
                lista.Add(reader.GetString(1));
            }
        }

        if (!existe)
        {
            return null;
        }

        return ativo ? lista : [];
    }

    private static class Sql
    {
        public const string Permissoes = """
            SELECT f.ativo, cp.permissao
            FROM funcionarios f
            LEFT JOIN cargos c ON c.id = f.cargo_id AND c.deleted_at IS NULL
            LEFT JOIN cargo_permissoes cp ON cp.cargo_id = c.id
            WHERE f.id = @funcionarioId AND f.deleted_at IS NULL
            """;
    }
}
