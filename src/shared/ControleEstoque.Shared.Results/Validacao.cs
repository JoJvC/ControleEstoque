namespace ControleEstoque.Shared.Results;

/// <summary>Checagens de entrada compartilhadas; todas lançam <see cref="RequestValidationException"/> (400).</summary>
public static class Validacao
{
    /// <summary>O JSON ainda aceita inteiro para enum; rejeita valor fora dos definidos.</summary>
    public static void EnumDefinido<T>(T valor, string campo)
        where T : struct, Enum
    {
        if (!Enum.IsDefined(valor))
        {
            throw new RequestValidationException(
                "VALOR_ENUM_INVALIDO", $"Valor '{valor}' inválido para {campo}.");
        }
    }

    public static void EnumDefinido<T>(T? valor, string campo)
        where T : struct, Enum
    {
        if (valor is { } v)
        {
            EnumDefinido(v, campo);
        }
    }

    /// <summary>Id nulo continua aceito; só <see cref="Guid.Empty"/> é rejeitado.</summary>
    public static void IdPreenchido(Guid? id, string campo)
    {
        if (id == Guid.Empty)
        {
            throw new RequestValidationException("ID_INVALIDO", $"{campo} inválido.");
        }
    }

    public static void NaoNegativo(decimal valor, string campo)
    {
        if (valor < 0)
        {
            throw new RequestValidationException("VALOR_INVALIDO", $"{campo} não pode ser negativo.");
        }
    }

    public static void Periodo(DateOnly? inicio, DateOnly? fim)
    {
        if (inicio is { } i && fim is { } f && i > f)
        {
            throw new RequestValidationException(
                "PERIODO_INVALIDO", "Data inicial não pode ser posterior à data final.");
        }
    }

    /// <summary>Lista nula vira vazia; elemento nulo (ou texto em branco, em lista de string) é rejeitado.</summary>
    public static IReadOnlyList<T> SemNulos<T>(IReadOnlyList<T?>? lista, string campo)
        where T : class
    {
        if (lista is null)
        {
            return [];
        }

        if (lista.Any(e => e is null || (e is string s && string.IsNullOrWhiteSpace(s))))
        {
            throw new RequestValidationException("ITEM_INVALIDO", $"{campo} contém elemento nulo ou vazio.");
        }

        return lista!;
    }
}
