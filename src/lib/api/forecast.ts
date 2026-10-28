import { fetchJson, HttpError, type FetchJsonOptions } from '../http'
import type { CurrentConditions, DayPoint, Forecast, HourPoint } from '../types'
import { isObject, num, series, str, type Json } from '../validate'

export const FORECAST_ENDPOINT = 'https://api.open-meteo.com/v1/forecast'

const CURRENT_VARS = [
  'temperature_2m',
  'apparent_temperature',
  'relative_humidity_2m',
  'weather_code',
  'wind_speed_10m',
  'wind_direction_10m',
  'wind_gusts_10m',
  'precipitation',
  'cloud_cover',
  'is_day',
] as const

const HOURLY_VARS = [
  'temperature_2m',
  'apparent_temperature',
  'relative_humidity_2m',
  'precipitation_probability',
  'precipitation',
  'weather_code',
  'wind_speed_10m',
  'wind_direction_10m',
  'wind_gusts_10m',
  'cloud_cover',
  'is_day',
] as const

const DAILY_VARS = [
  'temperature_2m_max',
  'temperature_2m_min',
  'weather_code',
  'precipitation_probability_max',
  'precipitation_sum',
  'sunrise',
  'sunset',
  'wind_speed_10m_max',
  'wind_gusts_10m_max',
  'wind_direction_10m_dominant',
] as const

export const FORECAST_DAYS = 7

/**
 * Sempre pedimos unidades métricas e horários em unixtime.
 * A conversão para °F/mph/pol é feita no cliente, então trocar de unidade não gera nova requisição.
 */
export function buildForecastUrl(latitude: number, longitude: number): string {
  const params = new URLSearchParams({
    latitude: latitude.toFixed(4),
    longitude: longitude.toFixed(4),
    current: CURRENT_VARS.join(','),
    hourly: HOURLY_VARS.join(','),
    daily: DAILY_VARS.join(','),
    timezone: 'auto',
    timeformat: 'unixtime',
    forecast_days: String(FORECAST_DAYS),
    wind_speed_unit: 'kmh',
  })
  return `${FORECAST_ENDPOINT}?${params}`
}

const toMs = (seconds: number | null) => (seconds === null ? null : seconds * 1000)
const toBool = (v: number | null) => (v === null ? null : v === 1)

function normalizeCurrent(section: unknown): CurrentConditions | null {
  if (!isObject(section)) return null
  const time = num(section.time)
  if (time === null) return null
  return {
    time: time * 1000,
    temperature: num(section.temperature_2m),
    apparentTemperature: num(section.apparent_temperature),
    humidity: num(section.relative_humidity_2m),
    weatherCode: num(section.weather_code),
    windSpeed: num(section.wind_speed_10m),
    windDirection: num(section.wind_direction_10m),
    windGusts: num(section.wind_gusts_10m),
    precipitation: num(section.precipitation),
    cloudCover: num(section.cloud_cover),
    isDay: toBool(num(section.is_day)),
  }
}

function timeAxis(section: Json | undefined): number[] | null {
  const raw = section?.time
  if (!Array.isArray(raw) || raw.length === 0) return null
  const times = raw.map(num)
  if (times.some((t) => t === null)) return null
  return (times as number[]).map((t) => t * 1000)
}

function normalizeHourly(section: unknown): HourPoint[] {
  const s = isObject(section) ? section : undefined
  const times = timeAxis(s)
  if (!times) return []
  const n = times.length
  const t = series(s, 'temperature_2m', n)
  const at = series(s, 'apparent_temperature', n)
  const rh = series(s, 'relative_humidity_2m', n)
  const pp = series(s, 'precipitation_probability', n)
  const pr = series(s, 'precipitation', n)
  const wc = series(s, 'weather_code', n)
  const ws = series(s, 'wind_speed_10m', n)
  const wd = series(s, 'wind_direction_10m', n)
  const wg = series(s, 'wind_gusts_10m', n)
  const cc = series(s, 'cloud_cover', n)
  const day = series(s, 'is_day', n)
  return times.map((time, i) => ({
    time,
    temperature: t[i],
    apparentTemperature: at[i],
    humidity: rh[i],
    precipProbability: pp[i],
    precipitation: pr[i],
    weatherCode: wc[i],
    windSpeed: ws[i],
    windDirection: wd[i],
    windGusts: wg[i],
    cloudCover: cc[i],
    isDay: toBool(day[i]),
  }))
}

function normalizeDaily(section: unknown): DayPoint[] {
  const s = isObject(section) ? section : undefined
  const times = timeAxis(s)
  if (!times) return []
  const n = times.length
  const max = series(s, 'temperature_2m_max', n)
  const min = series(s, 'temperature_2m_min', n)
  const wc = series(s, 'weather_code', n)
  const pp = series(s, 'precipitation_probability_max', n)
  const ps = series(s, 'precipitation_sum', n)
  const sr = series(s, 'sunrise', n)
  const ss = series(s, 'sunset', n)
  const ws = series(s, 'wind_speed_10m_max', n)
  const wg = series(s, 'wind_gusts_10m_max', n)
  const wd = series(s, 'wind_direction_10m_dominant', n)
  return times.map((time, i) => ({
    time,
    tempMax: max[i],
    tempMin: min[i],
    weatherCode: wc[i],
    precipProbabilityMax: pp[i],
    precipitationSum: ps[i],
    // Em regiões polares nascer/pôr podem não existir; a API devolve null ou 0
    sunrise: sr[i] ? toMs(sr[i]) : null,
    sunset: ss[i] ? toMs(ss[i]) : null,
    windSpeedMax: ws[i],
    windGustsMax: wg[i],
    windDirectionDominant: wd[i],
  }))
}

export function normalizeForecast(body: unknown, fetchedAt = Date.now()): Forecast {
  if (!isObject(body)) throw new HttpError('invalid', 'Resposta da previsão em formato inesperado')
  if (body.error === true) throw new HttpError('http', str(body.reason) ?? 'A previsão recusou o pedido')

  const latitude = num(body.latitude)
  const longitude = num(body.longitude)
  const hourly = normalizeHourly(body.hourly)
  if (latitude === null || longitude === null || hourly.length === 0) {
    throw new HttpError('invalid', 'A previsão não trouxe dados horários')
  }

  return {
    latitude,
    longitude,
    elevation: num(body.elevation),
    timezone: str(body.timezone) ?? 'UTC',
    timezoneAbbreviation: str(body.timezone_abbreviation) ?? '',
    utcOffsetSeconds: num(body.utc_offset_seconds) ?? 0,
    current: normalizeCurrent(body.current),
    hourly,
    daily: normalizeDaily(body.daily),
    fetchedAt,
  }
}

export async function fetchForecast(latitude: number, longitude: number, options?: FetchJsonOptions): Promise<Forecast> {
  const body = await fetchJson(buildForecastUrl(latitude, longitude), options)
  return normalizeForecast(body)
}
