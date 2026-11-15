/** Primeira letra do primeiro e do último nome, em maiúsculas ("Marina Souza" → "MS"); só palavras que começam com letra, ignora parênteses e símbolos. */
export function iniciais(nome: string): string {
  const partes = nome.match(/\p{L}[\p{L}\p{M}'’-]*/gu) ?? [];
  const primeira = partes[0]?.charAt(0) ?? '';
  const ultima = partes.length > 1 ? (partes.at(-1)?.charAt(0) ?? '') : '';
  return (primeira + ultima).toUpperCase();
}
