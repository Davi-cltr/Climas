import { describe, expect, it, vi } from 'vitest'
import { fetchJson, HttpError } from '../http'
import { GEOCODING_SAO_PAULO, makeForecastResponse, makeGridResponse, T0 } from '../../test/fixtures'
import { buildForecastUrl, normalizeForecast } from './forecast'
import { buildSearchUrl, normalizePlaces, searchPlaces } from './geocoding'
import { buildGridUrl, gridCoordinates, normalizeGrid } from './grid'

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

describe('buildForecastUrl', () => {
  it('pede unidades métricas, fuso automático e horários em unixtime', () => {
    const url = new URL(buildForecastUrl(-23.5475, -46.63611))
    expect(url.origin + url.pathname).toBe('https://api.open-meteo.com/v1/forecast')
    expect(url.searchParams.get('latitude')).toBe('-23.5475')
    expect(url.searchParams.get('timezone')).toBe('auto')
    expect(url.searchParams.get('timeformat')).toBe('unixtime')
    expect(url.searchParams.get('forecast_days')).toBe('7')
    expect(url.searchParams.get('hourly')).toContain('precipitation_probability')
    expect(url.searchParams.get('daily')).toContain('sunrise')
  })
})

describe('normalizeForecast', () => {
  it('converte segundos em milissegundos e mantém o fuso da localidade', () => {
    const f = normalizeForecast(makeForecastResponse(), 123)
    expect(f.timezone).toBe('America/Sao_Paulo')
    expect(f.hourly).toHaveLength(168)
    expect(f.hourly[0].time).toBe(T0 * 1000)
    expect(f.daily).toHaveLength(7)
    expect(f.daily[0].sunrise).toBe((T0 + 5 * 3600 + 22 * 60) * 1000)
    expect(f.current?.isDay).toBe(true)
    expect(f.fetchedAt).toBe(123)
  })

  it('trata valores nulos e séries ausentes como dados indisponíveis, sem inventar números', () => {
    const body = makeForecastResponse()
    body.hourly.temperature_2m[3] = null as unknown as number
    delete (body.hourly as Partial<typeof body.hourly>).precipitation_probability
    body.hourly.wind_gusts_10m = [1, 2] // tamanho errado
    const f = normalizeForecast(body)
    expect(f.hourly[3].temperature).toBeNull()
    expect(f.hourly.every((h) => h.precipProbability === null)).toBe(true)
    expect(f.hourly.every((h) => h.windGusts === null)).toBe(true)
    expect(f.hourly[4].temperature).not.toBeNull()
  })

  it('aceita resposta sem "current" e sem "daily"', () => {
    const body: Record<string, unknown> = makeForecastResponse()
    delete body.current
    delete body.daily
    const f = normalizeForecast(body)
    expect(f.current).toBeNull()
    expect(f.daily).toEqual([])
  })

  it('trata nascer/pôr do sol zerados (regiões polares) como ausentes', () => {
    const body = makeForecastResponse()
    body.daily.sunrise[0] = 0
    expect(normalizeForecast(body).daily[0].sunrise).toBeNull()
  })

  it('rejeita respostas sem dados horários', () => {
    expect(() => normalizeForecast({ latitude: 1, longitude: 2 })).toThrow(HttpError)
    expect(() => normalizeForecast('oops')).toThrow(/formato inesperado/)
  })

  it('propaga o motivo de erro da API', () => {
    expect(() => normalizeForecast({ error: true, reason: 'Latitude must be in range' })).toThrow('Latitude must be in range')
  })
})

describe('geocodificação', () => {
  it('monta a URL de busca com idioma', () => {
    const url = new URL(buildSearchUrl(' Lisboa ', 'pt'))
    expect(url.searchParams.get('name')).toBe('Lisboa')
    expect(url.searchParams.get('language')).toBe('pt')
  })

  it('normaliza resultados com estado e país para diferenciar homônimos', () => {
    const places = normalizePlaces(GEOCODING_SAO_PAULO)
    expect(places).toHaveLength(2)
    expect(places[0]).toMatchObject({ name: 'São Paulo', admin1: 'São Paulo', country: 'Brasil', timezone: 'America/Sao_Paulo' })
    expect(places[1].admin1).toBe('Pará')
  })

  it('devolve lista vazia quando a API omite "results"', () => {
    expect(normalizePlaces({ generationtime_ms: 0.2 })).toEqual([])
  })

  it('descarta entradas sem coordenadas válidas', () => {
    expect(normalizePlaces({ results: [{ name: 'X' }, { name: 'Y', latitude: 1, longitude: 2 }] })).toHaveLength(1)
  })

  it('não consulta a API para buscas muito curtas', async () => {
    const fetchImpl = vi.fn()
    expect(await searchPlaces('a', 'pt', { fetchImpl })).toEqual([])
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})

describe('grade do mapa', () => {
  it('gera 7×9 coordenadas centradas, de norte para sul', () => {
    const { latitudes, longitudes } = gridCoordinates(-23.5, -46.6)
    expect(latitudes).toHaveLength(7)
    expect(longitudes).toHaveLength(9)
    expect(latitudes[3]).toBeCloseTo(-23.5)
    expect(longitudes[4]).toBeCloseTo(-46.6)
    expect(latitudes[0]).toBeGreaterThan(latitudes[6])
  })

  it('ajusta longitudes perto da linha de data', () => {
    const { latitudes, longitudes } = gridCoordinates(0, 179.9)
    // Geometria contínua (crescente) para o mapa
    expect(longitudes.every((l, i) => i === 0 || l > longitudes[i - 1])).toBe(true)
    // URL sempre dentro de [-180, 180]
    const sent = new URL(buildGridUrl(latitudes, longitudes)).searchParams.get('longitude')!.split(',').map(Number)
    expect(sent.every((l) => l >= -180 && l <= 180)).toBe(true)
  })

  it('pede todos os pontos numa única URL', () => {
    const { latitudes, longitudes } = gridCoordinates(10, 10)
    const url = new URL(buildGridUrl(latitudes, longitudes))
    expect(url.searchParams.get('latitude')!.split(',')).toHaveLength(63)
    expect(url.searchParams.get('forecast_hours')).toBe('48')
  })

  it('normaliza a resposta em array', () => {
    const { latitudes, longitudes } = gridCoordinates(-23.5, -46.6)
    const g = normalizeGrid(makeGridResponse(latitudes, longitudes), latitudes, longitudes)
    expect(g.points).toHaveLength(63)
    expect(g.times).toHaveLength(48)
    expect(g.points[0].temperature).toHaveLength(48)
  })

  it('rejeita grade incompleta', () => {
    const { latitudes, longitudes } = gridCoordinates(-23.5, -46.6)
    expect(() => normalizeGrid(makeGridResponse(latitudes, longitudes).slice(1), latitudes, longitudes)).toThrow(HttpError)
  })
})

describe('fetchJson', () => {
  it('converte erro HTTP com motivo da API', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ error: true, reason: 'Parameter invalid' }, 400))
    await expect(fetchJson('https://x', { fetchImpl })).rejects.toMatchObject({ kind: 'http', status: 400, message: 'Parameter invalid' })
  })

  it('classifica corpo inválido', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('<html>', { status: 200 }))
    await expect(fetchJson('https://x', { fetchImpl })).rejects.toMatchObject({ kind: 'invalid' })
  })

  it('classifica falha de rede', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(fetchJson('https://x', { fetchImpl })).rejects.toMatchObject({ kind: 'network' })
  })

  it('aplica timeout', async () => {
    vi.useFakeTimers()
    const fetchImpl = vi.fn(
      (_: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
        }),
    )
    const p = fetchJson('https://x', { fetchImpl: fetchImpl as typeof fetch, timeoutMs: 500 })
    const assertion = expect(p).rejects.toMatchObject({ kind: 'timeout' })
    await vi.advanceTimersByTimeAsync(600)
    await assertion
    vi.useRealTimers()
  })

  it('respeita cancelamento externo', async () => {
    const controller = new AbortController()
    const fetchImpl = vi.fn(
      (_: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
        }),
    )
    const p = fetchJson('https://x', { fetchImpl: fetchImpl as typeof fetch, signal: controller.signal })
    controller.abort()
    await expect(p).rejects.toMatchObject({ kind: 'aborted' })
  })
})
