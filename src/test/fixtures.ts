/**
 * Respostas no formato exato da Open-Meteo (timeformat=unixtime), usadas SOMENTE em testes
 * e na inspeção visual automatizada. Nunca são importadas pelo app.
 */

export const T0 = Date.UTC(2026, 9, 28, 3, 0, 0) / 1000 // 00:00 em São Paulo (UTC-3)

export function hourlyTimes(start = T0, hours = 168) {
  return Array.from({ length: hours }, (_, i) => start + i * 3600)
}

function localHour(sec: number, offsetSec: number) {
  return (((sec + offsetSec) / 3600) % 24 + 24) % 24
}

export function makeForecastResponse(opts: { start?: number; hours?: number; offset?: number; nowSec?: number } = {}) {
  const start = opts.start ?? T0
  const hours = opts.hours ?? 168
  const offset = opts.offset ?? -10800
  const time = hourlyTimes(start, hours)
  const temp = time.map((t, i) => {
    const h = localHour(t, offset)
    return +(22 + 5.5 * Math.sin(((h - 9) / 24) * 2 * Math.PI) - (i > 30 ? 1.8 : 0)).toFixed(1)
  })
  const prob = time.map((t, i) => {
    const h = localHour(t, offset)
    const base = h >= 15 && h <= 21 ? 18 + (h - 15) * 11 : 6
    return Math.min(96, Math.round(base + (i > 24 && i < 48 ? 12 : 0)))
  })
  const precip = prob.map((p) => (p > 45 ? +((p - 45) / 14).toFixed(1) : 0))
  const code = prob.map((p) => (p > 70 ? 63 : p > 50 ? 61 : p > 30 ? 3 : p > 15 ? 2 : 1))
  const wdir = time.map((_, i) => Math.round(120 + 25 * Math.sin(i / 8)))
  const wspd = time.map((_, i) => +(9 + 6 * Math.abs(Math.sin(i / 6))).toFixed(1))
  const gust = wspd.map((w) => +(w * 1.9).toFixed(1))
  const rh = temp.map((t) => Math.round(95 - (t - 15) * 2.4))
  const isDay = time.map((t) => {
    const h = localHour(t, offset)
    return h >= 6 && h < 18 ? 1 : 0
  })
  const nowSec = opts.nowSec ?? start + 14 * 3600 + 30 * 60
  const ci = Math.min(hours - 1, Math.floor((nowSec - start) / 3600))
  const days = Math.ceil(hours / 24)
  const dTime = Array.from({ length: days }, (_, d) => start + d * 86400)
  const slice = <T,>(arr: T[], d: number) => arr.slice(d * 24, d * 24 + 24)

  return {
    latitude: -23.5,
    longitude: -46.625,
    generationtime_ms: 0.8,
    utc_offset_seconds: offset,
    timezone: 'America/Sao_Paulo',
    timezone_abbreviation: 'GMT-3',
    elevation: 763,
    current_units: { time: 'unixtime', interval: 'seconds', temperature_2m: '°C' },
    current: {
      time: Math.floor(nowSec / 900) * 900,
      interval: 900,
      temperature_2m: temp[ci],
      apparent_temperature: +(temp[ci] + 1.4).toFixed(1),
      relative_humidity_2m: rh[ci],
      weather_code: code[ci],
      wind_speed_10m: wspd[ci],
      wind_direction_10m: wdir[ci],
      wind_gusts_10m: gust[ci],
      precipitation: 0,
      cloud_cover: 48,
      is_day: isDay[ci],
    },
    hourly_units: { time: 'unixtime', temperature_2m: '°C' },
    hourly: {
      time,
      temperature_2m: temp,
      apparent_temperature: temp.map((t) => +(t + 1.2).toFixed(1)),
      relative_humidity_2m: rh,
      precipitation_probability: prob,
      precipitation: precip,
      weather_code: code,
      wind_speed_10m: wspd,
      wind_direction_10m: wdir,
      wind_gusts_10m: gust,
      cloud_cover: prob.map((p) => Math.min(100, p + 25)),
      is_day: isDay,
    },
    daily_units: { time: 'unixtime' },
    daily: {
      time: dTime,
      temperature_2m_max: dTime.map((_, d) => Math.max(...slice(temp, d))),
      temperature_2m_min: dTime.map((_, d) => Math.min(...slice(temp, d))),
      weather_code: dTime.map((_, d) => Math.max(...slice(code, d))),
      precipitation_probability_max: dTime.map((_, d) => Math.max(...slice(prob, d))),
      precipitation_sum: dTime.map((_, d) => +slice(precip, d).reduce((a, b) => a + b, 0).toFixed(1)),
      sunrise: dTime.map((t) => t + 5 * 3600 + 22 * 60),
      sunset: dTime.map((t) => t + 18 * 3600 + 21 * 60),
      wind_speed_10m_max: dTime.map((_, d) => Math.max(...slice(wspd, d))),
      wind_gusts_10m_max: dTime.map((_, d) => Math.max(...slice(gust, d))),
      wind_direction_10m_dominant: dTime.map(() => 128),
    },
  }
}

export function makeGridResponse(latitudes: number[], longitudes: number[], start = T0 + 14 * 3600, hours = 48) {
  const time = hourlyTimes(start, hours)
  const out = []
  for (let r = 0; r < latitudes.length; r++) {
    for (let c = 0; c < longitudes.length; c++) {
      out.push({
        latitude: latitudes[r],
        longitude: longitudes[c],
        generationtime_ms: 0.4,
        utc_offset_seconds: 0,
        timezone: 'GMT',
        timezone_abbreviation: 'GMT',
        elevation: 700 + r * 20,
        location_id: r * longitudes.length + c,
        hourly_units: { time: 'unixtime' },
        hourly: {
          time,
          temperature_2m: time.map((_, i) => +(24 + 2.8 * Math.sin(c * 0.9 + r * 0.4) - 0.8 * r + 0.5 * c + 3 * Math.sin(i / 4)).toFixed(1)),
          precipitation_probability: time.map((_, i) => Math.max(0, Math.min(100, Math.round(30 + 25 * Math.sin(i / 5 + c * 0.6 - r * 0.3))))),
          wind_speed_10m: time.map((_, i) => +(8 + 4 * Math.sin(r * 0.7 + i / 7) + c * 0.6).toFixed(1)),
          wind_direction_10m: time.map((_, i) => Math.round(115 + 30 * Math.sin(c * 0.5 + r * 0.4 + i / 9))),
        },
      })
    }
  }
  return out
}

export const GEOCODING_SAO_PAULO = {
  results: [
    {
      id: 3448439,
      name: 'São Paulo',
      latitude: -23.5475,
      longitude: -46.63611,
      elevation: 769,
      feature_code: 'PPLA',
      country_code: 'BR',
      admin1_id: 3448433,
      timezone: 'America/Sao_Paulo',
      population: 10021295,
      country_id: 3469034,
      country: 'Brasil',
      admin1: 'São Paulo',
    },
    {
      id: 3388368,
      name: 'São Paulo',
      latitude: -1.48,
      longitude: -47.2,
      feature_code: 'PPL',
      country_code: 'BR',
      timezone: 'America/Belem',
      country: 'Brasil',
      admin1: 'Pará',
    },
  ],
  generationtime_ms: 0.6,
}
