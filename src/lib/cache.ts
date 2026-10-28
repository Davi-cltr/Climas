/**
 * Cache em duas camadas: memória (sessão) e localStorage (sobrevive a recarregar e serve de reserva offline).
 * Cada entrada guarda quando foi obtida, para a interface poder dizer a idade dos dados.
 */

export interface CacheEntry<T> {
  value: T
  storedAt: number
}

const PREFIX = 'climas:cache:'
const MAX_STORED = 12

const memory = new Map<string, CacheEntry<unknown>>()

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

export function readCache<T>(key: string): CacheEntry<T> | null {
  const hit = memory.get(key)
  if (hit) return hit as CacheEntry<T>
  try {
    const raw = storage()?.getItem(PREFIX + key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CacheEntry<T>
    if (typeof parsed?.storedAt !== 'number') return null
    memory.set(key, parsed)
    return parsed
  } catch {
    return null
  }
}

export function writeCache<T>(key: string, value: T, now = Date.now()): void {
  const entry: CacheEntry<T> = { value, storedAt: now }
  memory.set(key, entry)
  const s = storage()
  if (!s) return
  try {
    s.setItem(PREFIX + key, JSON.stringify(entry))
    pruneStorage(s)
  } catch {
    // Cota cheia ou armazenamento bloqueado: a memória continua valendo
  }
}

/** Mantém só as entradas mais recentes no localStorage. */
function pruneStorage(s: Storage) {
  const entries: { key: string; storedAt: number }[] = []
  for (let i = 0; i < s.length; i++) {
    const key = s.key(i)
    if (!key?.startsWith(PREFIX)) continue
    try {
      entries.push({ key, storedAt: (JSON.parse(s.getItem(key) ?? '') as CacheEntry<unknown>).storedAt ?? 0 })
    } catch {
      entries.push({ key, storedAt: 0 })
    }
  }
  entries
    .sort((a, b) => b.storedAt - a.storedAt)
    .slice(MAX_STORED)
    .forEach((e) => s.removeItem(e.key))
}

export const isFresh = (entry: CacheEntry<unknown> | null, ttlMs: number, now = Date.now()) =>
  !!entry && now - entry.storedAt < ttlMs

/** Chave estável para uma coordenada (~100 m de precisão). */
export const coordKey = (lat: number, lon: number) => `${lat.toFixed(3)},${lon.toFixed(3)}`

export function clearMemoryCache() {
  memory.clear()
}
