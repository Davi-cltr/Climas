import { fetchJson, HttpError, type FetchJsonOptions } from '../http'
import type { ForecastGrid, GridPoint } from '../types'
import { isObject, num, series } from '../validate'
import { FORECAST_ENDPOINT } from './forecast'

/** Grade quadrada de pontos ao redor do centro. 7×7 = 49 pontos numa única requisição. */
export const GRID_SIZE = 7
/** Espaçamento em graus de latitude (~22 km). */
export const GRID_STEP_DEG = 0.2
export const GRID_HOURS = 48

export function gridCoordinates(lat: number, lon: number, size = GRID_SIZE, step = GRID_STEP_DEG) {
  const half = (size - 1) / 2
  // Corrige a longitude pela latitude para a grade ficar aproximadamente quadrada no mapa
  const lonStep = step / Math.max(0.2, Math.cos((lat * Math.PI) / 180))
  const clampLat = (v: number) => Math.max(-89.9, Math.min(89.9, v))
  const wrapLon = (v: number) => ((((v + 180) % 360) + 360) % 360) - 180
  const latitudes = Array.from({ length: size }, (_, r) => clampLat(lat + (half - r) * step))
  const longitudes = Array.from({ length: size }, (_, c) => wrapLon(lon + (c - half) * lonStep))
  return { latitudes, longitudes }
}

export function buildGridUrl(latitudes: number[], longitudes: number[]): string {
  const lats: string[] = []
  const lons: string[] = []
  for (const la of latitudes) {
    for (const lo of longitudes) {
      lats.push(la.toFixed(3))
      lons.push(lo.toFixed(3))
    }
  }
  const params = new URLSearchParams({
    latitude: lats.join(','),
    longitude: lons.join(','),
    hourly: 'temperature_2m,precipitation_probability,wind_speed_10m,wind_direction_10m',
    forecast_hours: String(GRID_HOURS),
    timeformat: 'unixtime',
    wind_speed_unit: 'kmh',
  })
  return `${FORECAST_ENDPOINT}?${params}`
}

export function normalizeGrid(
  body: unknown,
  latitudes: number[],
  longitudes: number[],
  fetchedAt = Date.now(),
): ForecastGrid {
  const expected = latitudes.length * longitudes.length
  if (!Array.isArray(body) || body.length !== expected) {
    throw new HttpError('invalid', 'A grade do mapa veio incompleta')
  }
  const first = body[0]
  const rawTimes = isObject(first) && isObject(first.hourly) ? first.hourly.time : null
  if (!Array.isArray(rawTimes) || rawTimes.length === 0) throw new HttpError('invalid', 'A grade do mapa veio sem horários')
  const times = rawTimes.map((t) => (num(t) ?? 0) * 1000)
  const n = times.length

  const points: GridPoint[] = body.map((loc, i) => {
    const hourly = isObject(loc) && isObject(loc.hourly) ? loc.hourly : undefined
    return {
      latitude: (isObject(loc) && num(loc.latitude)) || latitudes[Math.floor(i / longitudes.length)],
      longitude: (isObject(loc) && num(loc.longitude)) || longitudes[i % longitudes.length],
      temperature: series(hourly, 'temperature_2m', n),
      precipProbability: series(hourly, 'precipitation_probability', n),
      windSpeed: series(hourly, 'wind_speed_10m', n),
      windDirection: series(hourly, 'wind_direction_10m', n),
    }
  })

  return { rows: latitudes.length, cols: longitudes.length, latitudes, longitudes, times, points, fetchedAt }
}

export async function fetchGrid(lat: number, lon: number, options?: FetchJsonOptions): Promise<ForecastGrid> {
  const { latitudes, longitudes } = gridCoordinates(lat, lon)
  const body = await fetchJson(buildGridUrl(latitudes, longitudes), { timeoutMs: 15_000, ...options })
  return normalizeGrid(body, latitudes, longitudes)
}
