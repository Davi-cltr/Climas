import { useCallback } from 'react'
import { fetchForecast } from '../lib/api/forecast'
import { fetchGrid } from '../lib/api/grid'
import { coordKey } from '../lib/cache'
import type { Forecast, ForecastGrid, Place } from '../lib/types'
import { useCachedResource } from './useCachedResource'

/** A Open-Meteo atualiza a maioria dos modelos a cada hora; 10 min evita requisições repetidas sem atrasar dados novos. */
export const FORECAST_TTL_MS = 10 * 60_000
export const GRID_TTL_MS = 20 * 60_000

export function useForecast(place: Place | null) {
  const key = place ? `forecast:${coordKey(place.latitude, place.longitude)}` : null
  const lat = place?.latitude
  const lon = place?.longitude
  const fetcher = useCallback(
    (signal: AbortSignal) => fetchForecast(lat as number, lon as number, { signal }),
    [lat, lon],
  )
  return useCachedResource<Forecast>(key, fetcher, FORECAST_TTL_MS)
}

export function useGrid(place: Place | null, enabled: boolean) {
  const key = place && enabled ? `grid:${coordKey(place.latitude, place.longitude)}` : null
  const lat = place?.latitude
  const lon = place?.longitude
  const fetcher = useCallback((signal: AbortSignal) => fetchGrid(lat as number, lon as number, { signal }), [lat, lon])
  return useCachedResource<ForecastGrid>(key, fetcher, GRID_TTL_MS)
}
