/** Conversão e formatação de unidades. Os dados chegam sempre em °C, km/h e mm. */

export type UnitSystem = 'metric' | 'imperial'

export const convertTemp = (c: number, u: UnitSystem) => (u === 'metric' ? c : (c * 9) / 5 + 32)
/** Diferença de temperatura (sem o deslocamento de 32). */
export const convertTempDelta = (c: number, u: UnitSystem) => (u === 'metric' ? c : (c * 9) / 5)
export const convertSpeed = (kmh: number, u: UnitSystem) => (u === 'metric' ? kmh : kmh / 1.609344)
export const convertPrecip = (mm: number, u: UnitSystem) => (u === 'metric' ? mm : mm / 25.4)

export const tempUnit = (u: UnitSystem) => (u === 'metric' ? '°C' : '°F')
export const speedUnit = (u: UnitSystem) => (u === 'metric' ? 'km/h' : 'mph')
export const precipUnit = (u: UnitSystem) => (u === 'metric' ? 'mm' : 'in')

const nf = new Map<string, Intl.NumberFormat>()
function numberFormat(locale: string, digits: number) {
  const key = `${locale}|${digits}`
  let f = nf.get(key)
  if (!f) {
    f = new Intl.NumberFormat(locale, { maximumFractionDigits: digits, minimumFractionDigits: digits })
    nf.set(key, f)
  }
  return f
}

export const DASH = '—'

/** Evita "-0" ao arredondar valores como -0,3. */
const noNegZero = (v: number, digits: number) => {
  const p = 10 ** digits
  const r = Math.round(v * p) / p
  return Object.is(r, -0) ? 0 : r
}

export function formatNumber(v: number | null, locale: string, digits = 0): string {
  if (v === null) return DASH
  return numberFormat(locale, digits).format(noNegZero(v, digits))
}

/** "24°" (unidade fica no cabeçalho ou ao lado do número grande). */
export function formatTemp(c: number | null, u: UnitSystem, locale: string): string {
  if (c === null) return DASH
  return `${formatNumber(convertTemp(c, u), locale)}°`
}

export function formatSpeed(kmh: number | null, u: UnitSystem, locale: string): string {
  if (kmh === null) return DASH
  return `${formatNumber(convertSpeed(kmh, u), locale)} ${speedUnit(u)}`
}

export function formatPrecip(mm: number | null, u: UnitSystem, locale: string): string {
  if (mm === null) return DASH
  const v = convertPrecip(mm, u)
  return `${formatNumber(v, locale, u === 'metric' ? 1 : 2)} ${precipUnit(u)}`
}

export function formatPercent(v: number | null, locale: string): string {
  if (v === null) return DASH
  return `${formatNumber(v, locale)}%`
}

const COMPASS = {
  pt: ['N', 'NNE', 'NE', 'LNE', 'L', 'LSE', 'SE', 'SSE', 'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO'],
  en: ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'],
}
const COMPASS_NAMES = {
  pt: ['norte', 'nordeste', 'leste', 'sudeste', 'sul', 'sudoeste', 'oeste', 'noroeste'],
  en: ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'],
}

const normDeg = (deg: number) => ((deg % 360) + 360) % 360

/** Ponto cardeal de 16 direções de onde o vento SOPRA (convenção meteorológica). */
export function compassPoint(deg: number | null, lang: 'pt' | 'en'): string {
  if (deg === null) return DASH
  return COMPASS[lang][Math.round(normDeg(deg) / 22.5) % 16]
}

/** Nome por extenso em 8 direções, para frases ("de sudeste"). */
export function compassName(deg: number | null, lang: 'pt' | 'en'): string | null {
  if (deg === null) return null
  return COMPASS_NAMES[lang][Math.round(normDeg(deg) / 45) % 8]
}
