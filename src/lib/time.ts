/**
 * Datas sempre exibidas no fuso da LOCALIDADE consultada (não no do navegador).
 * Como os horários chegam em unixtime, o Intl resolve horário de verão corretamente.
 */

const cache = new Map<string, Intl.DateTimeFormat>()

function fmt(locale: string, timeZone: string, opts: Intl.DateTimeFormatOptions) {
  const key = `${locale}|${timeZone}|${JSON.stringify(opts)}`
  let f = cache.get(key)
  if (!f) {
    try {
      f = new Intl.DateTimeFormat(locale, { timeZone, ...opts })
    } catch {
      f = new Intl.DateTimeFormat(locale, { timeZone: 'UTC', ...opts })
    }
    cache.set(key, f)
  }
  return f
}

/** Componentes de data/hora locais para um instante. */
export function localParts(ms: number, timeZone: string) {
  const parts = fmt('en-US', timeZone, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(ms))
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0)
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour') % 24, minute: get('minute') }
}

/** Chave de dia local, ex. "2026-10-28". */
export function localDayKey(ms: number, timeZone: string) {
  const p = localParts(ms, timeZone)
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`
}

export const formatClock = (ms: number, tz: string, locale: string) =>
  fmt(locale, tz, { hour: '2-digit', minute: '2-digit', hourCycle: locale.startsWith('en') ? 'h12' : 'h23' }).format(ms)

/** Hora curta para eixos: "16h" / "4 PM". */
export function formatHourShort(ms: number, tz: string, locale: string) {
  if (locale.startsWith('pt')) return `${localParts(ms, tz).hour}h`
  return fmt(locale, tz, { hour: 'numeric', hourCycle: 'h12' }).format(ms).replace(' ', ' ')
}

export const formatWeekdayShort = (ms: number, tz: string, locale: string) =>
  fmt(locale, tz, { weekday: 'short' }).format(ms).replace('.', '')

export const formatDayShort = (ms: number, tz: string, locale: string) =>
  fmt(locale, tz, { weekday: 'short', day: 'numeric' }).format(ms).replace('.', '').replace(',', '')

export const formatDateLong = (ms: number, tz: string, locale: string) =>
  fmt(locale, tz, { weekday: 'short', day: 'numeric', month: 'short' }).format(ms).replace(/\./g, '').replace(',', '')

/** "3h 49min" */
export function formatDuration(ms: number, lang: 'pt' | 'en') {
  const total = Math.max(0, Math.round(ms / 60000))
  const h = Math.floor(total / 60)
  const m = total % 60
  if (lang === 'en') return h ? `${h}h ${m}m` : `${m}m`
  return h ? `${h}h ${m}min` : `${m}min`
}

/** Índice da hora da previsão que contém o instante (a hora cheia mais recente). */
export function hourIndexAt(times: number[], ms: number): number {
  if (times.length === 0) return -1
  if (ms < times[0]) return 0
  let lo = 0
  let hi = times.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (times[mid] <= ms) lo = mid
    else hi = mid - 1
  }
  return lo
}
