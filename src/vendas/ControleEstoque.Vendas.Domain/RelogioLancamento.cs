namespace ControleEstoque.Vendas.Domain;

/// <summary>Data gravada na venda e nos efeitos dela quando o caixa escolhido não é o de hoje (caixa reaberto).</summary>
public static class RelogioLancamento
{
    private static readonly TimeZoneInfo Fuso = ObterFuso();

    // ponytail: mesma regra de fuso do RelogioCaixa do financeiro, duplicada porque os contextos não se referenciam;
    // o caminho de upgrade é subir a função para o Shared.
    private static TimeZoneInfo ObterFuso()
    {
        try
        {
            return TimeZoneInfo.FindSystemTimeZoneById("America/Sao_Paulo");
        }
        catch (Exception e) when (e is TimeZoneNotFoundException or InvalidTimeZoneException)
        {
            return TimeZoneInfo.CreateCustomTimeZone("America/Sao_Paulo", TimeSpan.FromHours(-3), "SP", "SP");
        }
    }

    /// <summary>
    /// Nulo quando <paramref name="dataCaixa"/> é hoje em São Paulo (o repositório mantém o DEFAULT now()); para outra
    /// data, o meio-dia dela em São Paulo, que cai na data do caixa com a sessão do banco em UTC ou em São Paulo.
    /// </summary>
    public static DateTimeOffset? InstanteDoLancamento(DateOnly dataCaixa, DateTimeOffset agoraUtc)
    {
        var hoje = DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(agoraUtc, Fuso).DateTime);
        if (dataCaixa == hoje)
        {
            return null;
        }

        var local = dataCaixa.ToDateTime(new TimeOnly(12, 0));
        return new DateTimeOffset(local, Fuso.GetUtcOffset(local));
    }
}
