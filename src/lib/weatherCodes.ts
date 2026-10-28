/** Códigos de tempo WMO (campo weather_code da Open-Meteo). */

export type ConditionGroup = 'clear' | 'partly' | 'cloudy' | 'fog' | 'drizzle' | 'rain' | 'snow' | 'storm' | 'unknown'

export type Lang = 'pt' | 'en'

const LABELS: Record<number, [pt: string, en: string]> = {
  0: ['Céu limpo', 'Clear sky'],
  1: ['Predominantemente limpo', 'Mainly clear'],
  2: ['Parcialmente nublado', 'Partly cloudy'],
  3: ['Encoberto', 'Overcast'],
  45: ['Neblina', 'Fog'],
  48: ['Neblina com geada', 'Depositing rime fog'],
  51: ['Garoa fraca', 'Light drizzle'],
  53: ['Garoa moderada', 'Moderate drizzle'],
  55: ['Garoa intensa', 'Dense drizzle'],
  56: ['Garoa congelante fraca', 'Light freezing drizzle'],
  57: ['Garoa congelante intensa', 'Dense freezing drizzle'],
  61: ['Chuva fraca', 'Slight rain'],
  63: ['Chuva moderada', 'Moderate rain'],
  65: ['Chuva forte', 'Heavy rain'],
  66: ['Chuva congelante fraca', 'Light freezing rain'],
  67: ['Chuva congelante forte', 'Heavy freezing rain'],
  71: ['Neve fraca', 'Slight snow'],
  73: ['Neve moderada', 'Moderate snow'],
  75: ['Neve forte', 'Heavy snow'],
  77: ['Grãos de neve', 'Snow grains'],
  80: ['Pancadas de chuva fracas', 'Slight rain showers'],
  81: ['Pancadas de chuva moderadas', 'Moderate rain showers'],
  82: ['Pancadas de chuva violentas', 'Violent rain showers'],
  85: ['Pancadas de neve fracas', 'Slight snow showers'],
  86: ['Pancadas de neve fortes', 'Heavy snow showers'],
  95: ['Trovoada', 'Thunderstorm'],
  96: ['Trovoada com granizo fraco', 'Thunderstorm with slight hail'],
  99: ['Trovoada com granizo forte', 'Thunderstorm with heavy hail'],
}

export function conditionLabel(code: number | null, lang: Lang): string {
  if (code === null) return lang === 'pt' ? 'Condição indisponível' : 'Condition unavailable'
  const entry = LABELS[code]
  if (!entry) return lang === 'pt' ? `Código de tempo ${code}` : `Weather code ${code}`
  return lang === 'pt' ? entry[0] : entry[1]
}

export function conditionGroup(code: number | null): ConditionGroup {
  if (code === null) return 'unknown'
  if (code === 0 || code === 1) return 'clear'
  if (code === 2) return 'partly'
  if (code === 3) return 'cloudy'
  if (code === 45 || code === 48) return 'fog'
  if (code >= 51 && code <= 57) return 'drizzle'
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return 'rain'
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow'
  if (code >= 95) return 'storm'
  return 'unknown'
}

export const isWet = (group: ConditionGroup) => group === 'drizzle' || group === 'rain' || group === 'storm'
