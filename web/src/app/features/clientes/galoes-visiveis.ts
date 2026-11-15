/** Quantos galões desenhar para o saldo de cascos; o resto vira "+N". Saldo negativo conta como 0. */
export function galoesVisiveis(
  saldo: number,
  max: number,
): { desenhados: number; excedente: number } {
  const n = Math.max(0, saldo);
  return { desenhados: Math.min(n, max), excedente: Math.max(0, n - max) };
}
