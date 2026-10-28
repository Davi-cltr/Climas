/**
 * Resumo atmosférico por regras determinísticas.
 * Cada regra só gera um fato quando há dados suficientes; nada é inferido além do que a previsão traz.
 */
import type { HourPoint } from './types'

export type SummaryFact =
  | { kind: 'tempRise'; to: number; at: number }
  | { kind: 'tempFall'; to: number; at: number }
  | { kind: 'tempSteady'; around: number }
  | { kind: 'rainLikely'; from: number; peak: number }
  | { kind: 'rainPossible'; peak: number; at: number }
  | { kind: 'rainUnlikely' }
  | { kind: 'rainAmount'; mm: number }
  | { kind: 'gusts'; speed: number; at: number }

export const SUMMARY_WINDOW_HOURS = 12
/** Variação mínima (°C) para dizer que a temperatura sobe ou cai. */
export const TEMP_CHANGE_THRESHOLD = 2
export const RAIN_LIKELY = 50
export const RAIN_POSSIBLE = 20
export const RAIN_AMOUNT_MIN_MM = 1
export const STRONG_GUSTS_KMH = 50
/** Mínimo de horas com valor para uma regra valer. */
const MIN_POINTS = 3

function present<K extends keyof HourPoint>(hours: HourPoint[], key: K) {
  return hours.filter((h) => h[key] !== null) as (HourPoint & Record<K, number>)[]
}

export function summarize(hourly: HourPoint[], startIndex: number, windowHours = SUMMARY_WINDOW_HOURS): SummaryFact[] {
  if (startIndex < 0) return []
  const window = hourly.slice(startIndex, startIndex + windowHours + 1)
  const facts: SummaryFact[] = []

  // Temperatura
  const temps = present(window, 'temperature')
  if (temps.length >= MIN_POINTS) {
    const start = temps[0].temperature
    const max = temps.reduce((a, b) => (b.temperature > a.temperature ? b : a))
    const min = temps.reduce((a, b) => (b.temperature < a.temperature ? b : a))
    if (max.temperature - start >= TEMP_CHANGE_THRESHOLD && max.time > temps[0].time) {
      facts.push({ kind: 'tempRise', to: max.temperature, at: max.time })
    } else if (start - min.temperature >= TEMP_CHANGE_THRESHOLD && min.time > temps[0].time) {
      facts.push({ kind: 'tempFall', to: min.temperature, at: min.time })
    } else {
      const mean = temps.reduce((s, h) => s + h.temperature, 0) / temps.length
      facts.push({ kind: 'tempSteady', around: mean })
    }
  }

  // Chance de chuva (probabilidade, não volume)
  const probs = present(window, 'precipProbability')
  if (probs.length >= MIN_POINTS) {
    const peak = probs.reduce((a, b) => (b.precipProbability > a.precipProbability ? b : a))
    if (peak.precipProbability >= RAIN_LIKELY) {
      const first = probs.find((h) => h.precipProbability >= RAIN_LIKELY)!
      facts.push({ kind: 'rainLikely', from: first.time, peak: peak.precipProbability })
    } else if (peak.precipProbability >= RAIN_POSSIBLE) {
      facts.push({ kind: 'rainPossible', peak: peak.precipProbability, at: peak.time })
    } else {
      facts.push({ kind: 'rainUnlikely' })
    }
  }

  // Volume previsto (mm), separado da probabilidade
  const amounts = present(window, 'precipitation')
  if (amounts.length >= MIN_POINTS) {
    const mm = amounts.reduce((s, h) => s + h.precipitation, 0)
    if (mm >= RAIN_AMOUNT_MIN_MM) facts.push({ kind: 'rainAmount', mm })
  }

  // Rajadas fortes
  const gusts = present(window, 'windGusts')
  if (gusts.length >= MIN_POINTS) {
    const peak = gusts.reduce((a, b) => (b.windGusts > a.windGusts ? b : a))
    if (peak.windGusts >= STRONG_GUSTS_KMH) facts.push({ kind: 'gusts', speed: peak.windGusts, at: peak.time })
  }

  return facts
}
