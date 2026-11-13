namespace ControleEstoque.Shared.Results;

/// <summary>Produto que ficaria com saldo negativo; devolvido pelo repositório após o rollback.</summary>
public sealed record SaldoInsuficiente(Guid ProdutoId, long Saldo, long Solicitado);
