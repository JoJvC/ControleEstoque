namespace ControleEstoque.Shared.Contracts;

/// <summary>Envelope padrão de erro na wire para todas as APIs.</summary>
public sealed record ApiErrorEnvelope(string Code, string Message, string TraceId);
