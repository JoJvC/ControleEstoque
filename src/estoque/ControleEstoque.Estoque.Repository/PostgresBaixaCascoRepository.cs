using ControleEstoque.Estoque.Domain;
using ControleEstoque.Shared.Results;
using Npgsql;
using NpgsqlTypes;

namespace ControleEstoque.Estoque.Repository;

public sealed class PostgresBaixaCascoRepository : IBaixaCascoRepository
{
    private readonly NpgsqlDataSource dataSource;

    public PostgresBaixaCascoRepository(NpgsqlDataSource dataSource) => this.dataSource = dataSource;

    public async Task<(Guid Id, SaldoInsuficiente? Falta)> CreateAsync(
        NovaBaixaCasco baixa, IReadOnlyList<MovimentoCasco> movimentos, CancellationToken cancellationToken)
    {
        var id = Guid.NewGuid();
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);

        // Trava o tipo de casco e, em outra instrução, confere o saldo; tudo antes de qualquer INSERT.
        if (await PostgresEstoqueRepository.ChecarSaldoCascoAsync(
                connection, transaction, baixa.TipoCascoId, movimentos, cancellationToken) is { } falta)
        {
            return (Guid.Empty, falta); // sem Commit: o Dispose da transação faz rollback.
        }

        await using (var command = new NpgsqlCommand(Sql.InsertBaixa, connection, transaction))
        {
            command.Parameters.AddWithValue("id", id);
            command.Parameters.AddWithValue("tipoCascoId", baixa.TipoCascoId);
            command.Parameters.AddWithValue("quantidade", baixa.Quantidade);
            command.Parameters.Add(new NpgsqlParameter("motivo", NpgsqlDbType.Text)
            {
                Value = baixa.Motivo.ToString()
            });
            await command.ExecuteNonQueryAsync(cancellationToken);
        }

        foreach (var funcionarioId in baixa.ResponsaveisIds.Distinct())
        {
            await using var command = new NpgsqlCommand(Sql.InsertResponsavel, connection, transaction);
            command.Parameters.AddWithValue("baixaId", id);
            command.Parameters.AddWithValue("funcionarioId", funcionarioId);
            await command.ExecuteNonQueryAsync(cancellationToken);
        }

        // Quebrado sai dos vazios e, se o tipo aceita, entra na sucata; perdido sai só dos vazios.
        await PostgresEstoqueRepository.InserirMovimentosCascoAsync(
            connection, transaction, baixa.TipoCascoId, movimentos, id, baixa.Observacao, cancellationToken);

        await transaction.CommitAsync(cancellationToken);
        return (id, null);
    }

    private static class Sql
    {
        public const string InsertBaixa = """
            INSERT INTO baixas_casco (id, tipo_casco_id, quantidade, motivo)
            VALUES (@id, @tipoCascoId, @quantidade, @motivo)
            """;

        public const string InsertResponsavel = """
            INSERT INTO baixa_casco_responsaveis (baixa_id, funcionario_id)
            VALUES (@baixaId, @funcionarioId)
            """;
    }
}
