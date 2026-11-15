namespace ControleEstoque.Clientes.Domain;

public interface IClienteRepository
{
    Task CreateAsync(Cliente cliente, CancellationToken cancellationToken);
    Task<bool> UpdateAsync(Cliente cliente, CancellationToken cancellationToken);
    Task<Cliente?> GetAsync(Guid id, CancellationToken cancellationToken);
    Task<bool> ExistsAsync(Guid id, CancellationToken cancellationToken);
    Task<IReadOnlyList<Cliente>> ListAsync(string? nome, int page, int pageSize, CancellationToken cancellationToken);

    /// <summary>Endereços ativos do cliente, do mais antigo para o mais novo (created_at).</summary>
    Task<IReadOnlyList<Endereco>> ListEnderecosAsync(Guid clienteId, CancellationToken cancellationToken);

    /// <summary>Insere o endereço; com <paramref name="desmarcarOutros"/>, tira o principal dos demais, na mesma transação.</summary>
    Task AddEnderecoAsync(Endereco endereco, bool desmarcarOutros, CancellationToken cancellationToken);

    /// <summary>Atualiza o endereço ativo; false se não existir. Com <paramref name="desmarcarOutros"/>, tira o principal dos demais, na mesma transação.</summary>
    Task<bool> UpdateEnderecoAsync(Endereco endereco, bool desmarcarOutros, CancellationToken cancellationToken);

    /// <summary>Soft delete; se <paramref name="novoPrincipalId"/> vier, marca esse endereço como principal na mesma transação.</summary>
    Task<bool> RemoveEnderecoAsync(
        Guid clienteId, Guid enderecoId, Guid? novoPrincipalId, CancellationToken cancellationToken);
}

public interface ISaldosRepository
{
    Task<SaldosCliente> GetSaldosAsync(Guid clienteId, CancellationToken cancellationToken);

    /// <summary>Relatório: clientes com saldo de casco normal diferente de zero.</summary>
    Task<IReadOnlyList<SaldoCascoRelatorio>> ListSaldosCascoAsync(CancellationToken cancellationToken);

    /// <summary>Relatório: total de cascos na rua (soma dos saldos positivos).</summary>
    Task<long> GetTotalCascosNaRuaAsync(CancellationToken cancellationToken);

    /// <summary>Relatório: clientes que já entregaram sucata (independente do saldo de casco).</summary>
    Task<IReadOnlyList<SucataEntregueRelatorio>> ListSucataEntregueAsync(CancellationToken cancellationToken);
}

/// <summary>Leitura do tipo de casco (tabela tipos_casco, do Estoque) sem referenciar o projeto do Estoque.</summary>
public interface ITipoCascoLeituraRepository
{
    /// <summary>Null quando o tipo não existe ou foi apagado.</summary>
    Task<TipoCascoCliente?> GetAsync(Guid tipoCascoId, CancellationToken cancellationToken);
}

public interface ICascoClienteRepository
{
    /// <summary>Saldo do cliente no tipo de casco.</summary>
    Task<long> GetSaldoAsync(Guid clienteId, Guid tipoCascoId, CancellationToken cancellationToken);

    /// <summary>
    /// Devolução física avulsa: DEVOLUCAO do tipo no ledger + entrada de vazio do tipo no estoque de casco.
    /// Retorna o total do cliente (todos os tipos).
    /// </summary>
    Task<ResultadoDevolucaoCasco> DevolverAsync(
        Guid clienteId, Guid tipoCascoId, int quantidade, CancellationToken cancellationToken);

    /// <summary>
    /// Conversão em valor: CONVERSAO_VALOR no ledger + DEBITO_CONVERSAO_CASCO no fiado.
    /// NÃO dá entrada no estoque físico — o casco fica com o cliente, agora comprado.
    /// </summary>
    Task<ResultadoConversaoCasco> ConverterAsync(
        Guid clienteId, Guid tipoCascoId, int quantidade, decimal valorUnitario,
        CancellationToken cancellationToken);
}

public interface ISucataClienteRepository
{
    /// <summary>
    /// Entrega de sucata: registro do cliente por tipo + entrada de sucata do tipo no estoque de casco.
    /// Nunca toca o ledger de casco normal. Se houver valor de conversão,
    /// lança CREDITO_CONVERSAO_SUCATA no fiado.
    /// </summary>
    Task<ResultadoEntregaSucata> EntregarAsync(
        Guid clienteId, Guid tipoCascoId, int quantidade, decimal? valorConversao,
        CancellationToken cancellationToken);
}
