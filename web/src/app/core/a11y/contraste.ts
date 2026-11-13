/** Luminância relativa WCAG 2.x de uma cor `#rrggbb`. */
function luminancia(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const canal = parseInt(hex.slice(i, i + 2), 16) / 255;
    return canal <= 0.03928 ? canal / 12.92 : ((canal + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Razão de contraste WCAG 2.x entre duas cores `#rrggbb` (1 a 21). */
export function razaoContraste(hexA: string, hexB: string): number {
  const [a, b] = [luminancia(hexA), luminancia(hexB)];
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
