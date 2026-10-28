/** Modelo de domínio do CLIMAS. Valores ausentes na API viram `null`, nunca um número inventado. */

export type PlaceKind = 'city' | 'device' | 'point'

export interface Place {
  id: string
  kind: PlaceKind
  name: string
  admin1?: string
  country?: string
  countryCode?: string
  latitude: number
  longitude: number
  /** Fuso IANA, quando a geocodificação o fornece. */
  timezone?: string
  population?: number
}

export interface CurrentConditions {
  /** Instante da estimativa (ms desde a época, UTC). */
  time: number
  temperature: number | null
  apparentTemperature: number | null
  humidity: number | null
  weatherCode: number | null
  windSpeed: number | null
  windDirection: number | null
  windGusts: number | null
  precipitation: number | null
  cloudCover: number | null
  isDay: boolean | null
}

export interface HourPoint {
  time: number
  temperature: number | null
  apparentTemperature: number | null
  humidity: number | null
  precipProbability: number | null
  precipitation: number | null
  weatherCode: number | null
  windSpeed: number | null
  windDirection: number | null
  windGusts: number | null
  cloudCover: number | null
  isDay: boolean | null
}

export interface DayPoint {
  /** Meia-noite local do dia (ms, UTC). */
  time: number
  tempMax: number | null
  tempMin: number | null
  weatherCode: number | null
  precipProbabilityMax: number | null
  precipitationSum: number | null
  sunrise: number | null
  sunset: number | null
  windSpeedMax: number | null
  windGustsMax: number | null
  windDirectionDominant: number | null
}

export interface Forecast {
  latitude: number
  longitude: number
  elevation: number | null
  timezone: string
  timezoneAbbreviation: string
  utcOffsetSeconds: number
  current: CurrentConditions | null
  hourly: HourPoint[]
  daily: DayPoint[]
  /** Quando o app recebeu os dados (ms). */
  fetchedAt: number
}

/** Um ponto da grade usada pelo mapa: séries horárias alinhadas ao eixo de tempo da grade. */
export interface GridPoint {
  latitude: number
  longitude: number
  temperature: (number | null)[]
  precipProbability: (number | null)[]
  windSpeed: (number | null)[]
  windDirection: (number | null)[]
}

export interface ForecastGrid {
  /** Coordenadas pedidas, linha a linha de norte para sul, oeste para leste. */
  rows: number
  cols: number
  /** Latitudes e longitudes pedidas (o modelo pode ajustar levemente cada ponto). */
  latitudes: number[]
  longitudes: number[]
  times: number[]
  points: GridPoint[]
  fetchedAt: number
}
