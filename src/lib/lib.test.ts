import { describe, expect, it } from 'vitest'
import { makeForecastResponse } from '../test/fixtures'
import { normalizeForecast } from './api/forecast'
import { coordKey, isFresh, readCache, writeCache, clearMemoryCache } from './cache'
import { summarize, type SummaryFact } from './summary'
import { formatDuration, formatHourShort, hourIndexAt, localDayKey, localParts } from './time'
import type { HourPoint } from './types'
import { compassName, compassPoint, convertTemp, formatPercent, formatPrecip, formatSpeed, formatTemp } from './units'
import { conditionGroup, conditionLabel } from './weatherCodes'

const hour = (i: number, patch: Partial<HourPoint> = {}): HourPoint => ({
  time: i * 3_600_000,
  temperature: 20,
  apparentTemperature: 20,
  humidity: 60,
  precipProbability: 5,
  precipitation: 0,
  weatherCode: 1,
  windSpeed: 10,
  windDirection: 90,
  windGusts: 20,
  cloudCover: 10,
  isDay: true,
  ...patch,
})

describe('unidades', () => {
  it('converte e formata temperatura', () => {
    expect(convertTemp(0, 'imperial')).toBe(32)
    expect(formatTemp(23.6, 'metric', 'pt-BR')).toBe('24°')
    expect(formatTemp(-0.3, 'metric', 'pt-BR')).toBe('0°')
    expect(formatTemp(100, 'imperial', 'en-US')).toBe('212°')
    expect(formatTemp(null, 'metric', 'pt-BR')).toBe('—')
  })

  it('formata vento, chuva e porcentagem com unidade explícita', () => {
    expect(formatSpeed(16.09344, 'imperial', 'en-US')).toBe('10 mph')
    expect(formatSpeed(14.2, 'metric', 'pt-BR')).toBe('14 km/h')
    expect(formatPrecip(1.25, 'metric', 'pt-BR')).toBe('1,3 mm')
    expect(formatPrecip(25.4, 'imperial', 'en-US')).toBe('1.00 in')
    expect(formatPercent(35, 'pt-BR')).toBe('35%')
  })

  it('traduz direção do vento (de onde sopra)', () => {
    expect(compassPoint(0, 'pt')).toBe('N')
    expect(compassPoint(135, 'pt')).toBe('SE')
    expect(compassPoint(270, 'pt')).toBe('O')
    expect(compassPoint(270, 'en')).toBe('W')
    expect(compassPoint(359, 'pt')).toBe('N')
    expect(compassName(135, 'pt')).toBe('sudeste')
    expect(compassPoint(null, 'pt')).toBe('—')
  })
})

describe('códigos de tempo', () => {
  it('tem rótulo nos dois idiomas e grupo visual', () => {
    expect(conditionLabel(63, 'pt')).toBe('Chuva moderada')
    expect(conditionLabel(63, 'en')).toBe('Moderate rain')
    expect(conditionGroup(95)).toBe('storm')
    expect(conditionGroup(2)).toBe('partly')
    expect(conditionLabel(null, 'pt')).toBe('Condição indisponível')
    expect(conditionLabel(42, 'pt')).toBe('Código de tempo 42')
  })
})

describe('datas no fuso da localidade', () => {
  const ms = Date.UTC(2026, 9, 28, 17, 30) // 14:30 em São Paulo
  it('usa o fuso informado, não o do navegador', () => {
    expect(localParts(ms, 'America/Sao_Paulo')).toMatchObject({ hour: 14, minute: 30, day: 28 })
    expect(localParts(ms, 'Asia/Tokyo')).toMatchObject({ hour: 2, day: 29 })
    expect(localDayKey(ms, 'Asia/Tokyo')).toBe('2026-10-29')
    expect(formatHourShort(ms, 'America/Sao_Paulo', 'pt-BR')).toBe('14h')
  })

  it('respeita horário de verão (Nova York, novembro de 2026)', () => {
    // 1 de novembro de 2026: relógios voltam de 02:00 EDT para 01:00 EST
    const before = Date.UTC(2026, 10, 1, 5, 30) // 01:30 EDT
    const after = Date.UTC(2026, 10, 1, 6, 30) // 01:30 EST
    expect(localParts(before, 'America/New_York').hour).toBe(1)
    expect(localParts(after, 'America/New_York').hour).toBe(1)
  })

  it('encontra a hora cheia vigente', () => {
    const times = [0, 3600e3, 7200e3]
    expect(hourIndexAt(times, 3700e3)).toBe(1)
    expect(hourIndexAt(times, -5)).toBe(0)
    expect(hourIndexAt(times, 9e9)).toBe(2)
    expect(hourIndexAt([], 1)).toBe(-1)
  })

  it('formata duração', () => {
    expect(formatDuration((3 * 60 + 49) * 60_000, 'pt')).toBe('3h 49min')
    expect(formatDuration(5 * 60_000, 'en')).toBe('5m')
  })
})

describe('resumo atmosférico', () => {
  const kinds = (f: SummaryFact[]) => f.map((x) => x.kind)

  it('detecta subida de temperatura e chuva provável', () => {
    const hours = Array.from({ length: 13 }, (_, i) =>
      hour(i, { temperature: 20 + i * 0.5, precipProbability: i >= 8 ? 70 : 10, precipitation: i >= 8 ? 0.5 : 0 }),
    )
    const facts = summarize(hours, 0)
    expect(kinds(facts)).toEqual(['tempRise', 'rainLikely', 'rainAmount'])
    expect(facts[0]).toMatchObject({ to: 26, at: 12 * 3_600_000 })
    expect(facts[1]).toMatchObject({ from: 8 * 3_600_000, peak: 70 })
  })

  it('detecta queda e temperatura estável', () => {
    const falling = Array.from({ length: 13 }, (_, i) => hour(i, { temperature: 25 - i * 0.4 }))
    expect(kinds(summarize(falling, 0))[0]).toBe('tempFall')
    const steady = Array.from({ length: 13 }, (_, i) => hour(i, { temperature: 20 + (i % 2) * 0.5 }))
    expect(summarize(steady, 0)[0]).toMatchObject({ kind: 'tempSteady' })
  })

  it('diferencia chance possível de improvável', () => {
    const possible = Array.from({ length: 13 }, (_, i) => hour(i, { precipProbability: i === 5 ? 35 : 10 }))
    expect(summarize(possible, 0)).toContainEqual({ kind: 'rainPossible', peak: 35, at: 5 * 3_600_000 })
    expect(kinds(summarize(Array.from({ length: 13 }, (_, i) => hour(i)), 0))).toContain('rainUnlikely')
  })

  it('não afirma nada quando faltam dados', () => {
    const empty = Array.from({ length: 13 }, (_, i) =>
      hour(i, { temperature: null, precipProbability: null, precipitation: null, windGusts: null }),
    )
    expect(summarize(empty, 0)).toEqual([])
    expect(summarize([], -1)).toEqual([])
  })

  it('avisa rajadas fortes', () => {
    const gusty = Array.from({ length: 13 }, (_, i) => hour(i, { windGusts: i === 4 ? 62 : 20 }))
    expect(summarize(gusty, 0)).toContainEqual({ kind: 'gusts', speed: 62, at: 4 * 3_600_000 })
  })

  it('funciona com uma resposta completa da API', () => {
    const f = normalizeForecast(makeForecastResponse())
    const idx = hourIndexAt(f.hourly.map((h) => h.time), f.current!.time)
    expect(summarize(f.hourly, idx).length).toBeGreaterThan(1)
  })
})

describe('cache', () => {
  it('guarda com data e recupera do localStorage', () => {
    writeCache('k', { a: 1 }, 1000)
    clearMemoryCache()
    expect(readCache('k')).toEqual({ value: { a: 1 }, storedAt: 1000 })
    expect(isFresh(readCache('k'), 500, 1400)).toBe(true)
    expect(isFresh(readCache('k'), 500, 1600)).toBe(false)
    expect(coordKey(-23.54751, -46.636)).toBe('-23.548,-46.636')
  })
})
