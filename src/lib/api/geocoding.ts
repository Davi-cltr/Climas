import { fetchJson, HttpError, type FetchJsonOptions } from '../http'
import type { Place } from '../types'
import { isObject, num, str } from '../validate'

export const GEOCODING_ENDPOINT = 'https://geocoding-api.open-meteo.com/v1/search'

export function buildSearchUrl(query: string, language: string, count = 8): string {
  const params = new URLSearchParams({
    name: query.trim(),
    count: String(count),
    language,
    format: 'json',
  })
  return `${GEOCODING_ENDPOINT}?${params}`
}

export function normalizePlaces(body: unknown): Place[] {
  if (!isObject(body)) throw new HttpError('invalid', 'Resposta da busca em formato inesperado')
  if (body.error === true) throw new HttpError('http', str(body.reason) ?? 'A busca recusou o pedido')
  // Sem resultados, a API omite o campo "results"
  if (!Array.isArray(body.results)) return []

  const places: Place[] = []
  for (const r of body.results) {
    if (!isObject(r)) continue
    const latitude = num(r.latitude)
    const longitude = num(r.longitude)
    const name = str(r.name)
    if (latitude === null || longitude === null || !name) continue
    places.push({
      id: `geo:${num(r.id) ?? `${latitude},${longitude}`}`,
      kind: 'city',
      name,
      admin1: str(r.admin1),
      country: str(r.country),
      countryCode: str(r.country_code),
      latitude,
      longitude,
      timezone: str(r.timezone),
      population: num(r.population) ?? undefined,
    })
  }
  return places
}

/** Buscas com menos de 2 caracteres não são enviadas: a API devolve resultados vazios para 1 letra. */
export const MIN_QUERY_LENGTH = 2

export async function searchPlaces(query: string, language: string, options?: FetchJsonOptions): Promise<Place[]> {
  if (query.trim().length < MIN_QUERY_LENGTH) return []
  const body = await fetchJson(buildSearchUrl(query, language), { timeoutMs: 8_000, ...options })
  return normalizePlaces(body)
}
