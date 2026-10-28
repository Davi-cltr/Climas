/** Pequenos leitores defensivos para respostas JSON externas. */

export type Json = Record<string, unknown>

export const isObject = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v)

export const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

export const str = (v: unknown): string | undefined => (typeof v === 'string' && v.length > 0 ? v : undefined)

/** Lê uma série numérica com o mesmo tamanho do eixo de tempo; se não bater, a série inteira é tratada como ausente. */
export function series(section: Json | undefined, key: string, length: number): (number | null)[] {
  const raw = section?.[key]
  if (!Array.isArray(raw) || raw.length !== length) return Array.from({ length }, () => null)
  return raw.map(num)
}
