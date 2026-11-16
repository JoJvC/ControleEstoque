namespace ControleEstoque.Financeiro.Domain;

/// <summary>O dia do caixa é o dia em America/Sao_Paulo; estas funções puras não leem relógio nenhum.</summary>
public static class RelogioCaixa
{
    private static readonly TimeZoneInfo Fuso = ObterFuso();

    // O Brasil não tem horário de verão desde 2019: sem o tzdata do sistema, vale UTC-03:00 fixo.
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

    public static DateOnly HojeEmSaoPaulo(DateTimeOffset agora) =>
        DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(agora, Fuso).DateTime);

    /// <summary>00:00 do dia seguinte a <paramref name="data"/>, em São Paulo.</summary>
    public static DateTimeOffset MeiaNoiteSeguinte(DateOnly data) =>
        NoFuso(data.AddDays(1).ToDateTime(TimeOnly.MinValue));

    /// <summary>23:59:59 de <paramref name="data"/>, em São Paulo: instante da diária lançada depois.</summary>
    public static DateTimeOffset InstanteDaDiaria(DateOnly data) =>
        NoFuso(data.ToDateTime(new TimeOnly(23, 59, 59)));

    private static DateTimeOffset NoFuso(DateTime local) => new(local, Fuso.GetUtcOffset(local));
}
