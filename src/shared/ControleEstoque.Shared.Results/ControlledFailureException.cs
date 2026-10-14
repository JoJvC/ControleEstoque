namespace ControleEstoque.Shared.Results;

/// <summary>
/// Base para toda falha de domínio esperada. Exceções fora desta hierarquia
/// são erros técnicos inesperados (viram 500 no middleware global).
/// </summary>
public class ControlledFailureException : Exception
{
    public string Code { get; }
    public int StatusCode { get; }

    public ControlledFailureException(string code, int statusCode, string message)
        : base(message)
    {
        Code = code;
        StatusCode = statusCode;
    }
}

public sealed class EntityNotFoundException : ControlledFailureException
{
    public EntityNotFoundException(string code, string message)
        : base(code, 404, message)
    {
    }
}

public sealed class BusinessRuleException : ControlledFailureException
{
    public BusinessRuleException(string code, string message)
        : base(code, 422, message)
    {
    }
}

public sealed class RequestValidationException : ControlledFailureException
{
    public RequestValidationException(string code, string message)
        : base(code, 400, message)
    {
    }
}

public sealed class ConflictException : ControlledFailureException
{
    public ConflictException(string code, string message)
        : base(code, 409, message)
    {
    }
}

public sealed class InsufficientStockException : ControlledFailureException
{
    public InsufficientStockException(string message)
        : base("ESTOQUE_INSUFICIENTE", 422, message)
    {
    }
}
