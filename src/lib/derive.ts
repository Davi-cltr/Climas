import { hourIndexAt, localDayKey } from './time'
import type { DayPoint, Forecast, HourPoint } from './types'

export const TIMELINE_HOURS = 48

export interface Derived {
  nowIndex: number
  /** Horas exibidas na linha do tempo (a partir da hora vigente). */
  window: HourPoint[]
  today: DayPoint | null
  /** Dia (da previsão diária) de um instante qualquer. */
  dayOf: (ms: number) => DayPoint | null
}

export function derive(forecast: Forecast, now: number): Derived {
  const times = forecast.hourly.map((h) => h.time)
  const nowIndex = Math.max(0, hourIndexAt(times, now))
  const window = forecast.hourly.slice(nowIndex, nowIndex + TIMELINE_HOURS)
  const byKey = new Map(forecast.daily.map((d) => [localDayKey(d.time, forecast.timezone), d]))
  const dayOf = (ms: number) => byKey.get(localDayKey(ms, forecast.timezone)) ?? null
  return { nowIndex, window, today: dayOf(now), dayOf }
}

/** Mínimo e máximo ignorando nulos. */
export function extent(values: (number | null)[]): [number, number] | null {
  let min = Infinity
  let max = -Infinity
  for (const v of values) {
    if (v === null) continue
    if (v < min) min = v
    if (v > max) max = v
  }
  return min === Infinity ? null : [min, max]
}
