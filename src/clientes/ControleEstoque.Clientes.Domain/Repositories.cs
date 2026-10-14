namespace ControleEstoque.Clientes.Domain;

public interface IClienteRepository
{
    Task CreateAsync(Cliente cliente, CancellationToken cancellationToken);
    Task<bool> UpdateAsync(Cliente cliente, CancellationToken cancellationToken);
    Task<Cliente?> GetAsync(Guid id, CancellationToken cancellationToken);
    Task<bool> ExistsAsync(Guid id, CancellationToken cancellationToken);
    Task<IReadOnlyList<Cliente>> ListAsync(string? nome, int page, int pageSize, CancellationToken cancellationToken);
    Task AddEnderecoAsync(Endereco endereco, CancellationToken cancellationToken);
}

public interface ISaldosRepository
{
    Task<SaldosCliente> GetSaldosAsync(Guid clienteId, CancellationToken cancellationToken);

    /// <summary>Relatório: clientes com saldo de casco normal diferente de zero.</summary>
    Task<IReadOnlyList<SaldoCascoRelatorio>> ListSaldosCascoAsync(CancellationToken cancellationToken);

    /// <summary>Relatório: clientes que já entregaram sucata (independente do saldo de casco).</summary>
    Task<IReadOnlyList<SucataEntregueRelatorio>> ListSucataEntregueAsync(CancellationToken cancellationToken);
}

public interface ICascoClienteRepository
{
    Task<long> GetSaldoAsync(Guid clienteId, CancellationToken cancellationToken);

    /// <summary>Devolução física avulsa: DEVOLUCAO no ledger + entrada no estoque de vazios.</summary>
    Task<ResultadoDevolucaoCasco> DevolverAsync(Guid clienteId, int quantidade, CancellationToken cancellationToken);

    /// <summary>
    /// Conversão em valor: CONVERSAO_VALOR no ledger + DEBITO_CONVERSAO_CASCO no fiado.
    /// NÃO dá entrada no estoque físico — o casco fica com o cliente, agora comprado.
    /// </summary>
    Task<ResultadoConversaoCasco> ConverterAsync(
        Guid clienteId, int quantidade, decimal valorUnitario, CancellationToken cancellationToken);
}

public interface ISucataClienteRepository
{
    /// <summary>
    /// Entrega de sucata: registro do cliente + entrada no estoque de sucata.
    /// Nunca toca o ledger de casco normal. Se houver valor de conversão,
    /// lança CREDITO_CONVERSAO_SUCATA no fiado.
    /// </summary>
    Task<ResultadoEntregaSucata> EntregarAsync(
        Guid clienteId, int quantidade, decimal? valorConversao, CancellationToken cancellationToken);
}
