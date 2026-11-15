using ControleEstoque.Shared.Results;

namespace ControleEstoque.Estoque.Domain;

public interface ITipoCascoService
{
    Task<TipoCasco> CriarAsync(TipoCasco tipoCasco, CancellationToken cancellationToken);
    Task<TipoCasco> AtualizarAsync(TipoCasco tipoCasco, CancellationToken cancellationToken);
    Task<IReadOnlyList<TipoCasco>> ListarAsync(CancellationToken cancellationToken);
}

public sealed class TipoCascoService : ITipoCascoService
{
    private readonly ITipoCascoRepository tiposCasco;
    private readonly IMarcaRepository marcas;

    public TipoCascoService(ITipoCascoRepository tiposCasco, IMarcaRepository marcas)
    {
        this.tiposCasco = tiposCasco;
        this.marcas = marcas;
    }

    public async Task<TipoCasco> CriarAsync(TipoCasco tipoCasco, CancellationToken cancellationToken)
    {
        await ValidarAsync(tipoCasco, cancellationToken);
        var novo = tipoCasco with { Id = tipoCasco.Id == Guid.Empty ? Guid.NewGuid() : tipoCasco.Id };
        await tiposCasco.CreateAsync(novo, cancellationToken);
        return novo;
    }

    // ponytail: a checagem de uso roda fora da transação do UPDATE; um produto ou associação que passe a
    // apontar o tipo entre a checagem e o UPDATE escapa. Teto: travar o tipo (FOR NO KEY UPDATE) na mesma transação.
    public async Task<TipoCasco> AtualizarAsync(TipoCasco tipoCasco, CancellationToken cancellationToken)
    {
        await ValidarAsync(tipoCasco, cancellationToken);
        var atual = await tiposCasco.GetAsync(tipoCasco.Id, cancellationToken)
            ?? throw new EntityNotFoundException(
                "TIPO_CASCO_NAO_ENCONTRADO", $"Tipo de casco {tipoCasco.Id} não encontrado.");

        // Trocar a marca de um tipo em uso furaria CASCO_GENERICO_INVALIDO / CASCO_ESPECIFICO_INVALIDO.
        if (atual.MarcaId != tipoCasco.MarcaId && await tiposCasco.EmUsoAsync(tipoCasco.Id, cancellationToken))
        {
            throw new BusinessRuleException(
                "TIPO_CASCO_EM_USO", "Não é possível trocar a marca de um tipo de casco usado por produto ou associação.");
        }

        // Com saldo de sucata, deixar de aceitar sucata prenderia o saldo: todo movimento de sucata seria recusado.
        if (atual.AceitaSucata && !tipoCasco.AceitaSucata
            && await tiposCasco.GetSaldoSucataAsync(tipoCasco.Id, cancellationToken) != 0)
        {
            throw new BusinessRuleException(
                "TIPO_CASCO_EM_USO", "Não é possível deixar de aceitar sucata enquanto há saldo de sucata no tipo.");
        }

        if (!await tiposCasco.UpdateAsync(tipoCasco, cancellationToken))
        {
            throw new EntityNotFoundException(
                "TIPO_CASCO_NAO_ENCONTRADO", $"Tipo de casco {tipoCasco.Id} não encontrado.");
        }

        return tipoCasco;
    }

    public Task<IReadOnlyList<TipoCasco>> ListarAsync(CancellationToken cancellationToken)
        => tiposCasco.ListAsync(cancellationToken);

    private async Task ValidarAsync(TipoCasco tipoCasco, CancellationToken cancellationToken)
    {
        Validacao.IdPreenchido(tipoCasco.MarcaId, "MarcaId");
        Validacao.NaoNegativo(tipoCasco.PrecoVasilhame, "PrecoVasilhame");

        if (string.IsNullOrWhiteSpace(tipoCasco.Nome))
        {
            throw new RequestValidationException("NOME_OBRIGATORIO", "Nome do tipo de casco é obrigatório.");
        }

        if (tipoCasco.MarcaId is { } marcaId && !await marcas.ExistsAsync(marcaId, cancellationToken))
        {
            throw new BusinessRuleException("MARCA_INEXISTENTE", $"Marca {marcaId} não cadastrada.");
        }
    }
}
