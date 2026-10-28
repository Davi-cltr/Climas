import { useSyncExternalStore } from 'react'
import type { Place } from '../lib/types'
import type { UnitSystem } from '../lib/units'
import type { Lang } from '../lib/weatherCodes'

export type ThemePref = 'system' | 'dark' | 'light'

export interface Settings {
  lang: Lang
  units: UnitSystem
  theme: ThemePref
  favorites: Place[]
  lastPlace: Place | null
}

const KEY = 'climas:settings:v1'
const MAX_FAVORITES = 12

export const DEFAULT_PLACE: Place = {
  id: 'geo:3448439',
  kind: 'city',
  name: 'São Paulo',
  admin1: 'São Paulo',
  country: 'Brasil',
  countryCode: 'BR',
  latitude: -23.5475,
  longitude: -46.63611,
  timezone: 'America/Sao_Paulo',
}

function detectLang(): Lang {
  if (typeof navigator === 'undefined') return 'pt'
  return navigator.language?.toLowerCase().startsWith('pt') ? 'pt' : navigator.language ? 'en' : 'pt'
}

function detectUnits(): UnitSystem {
  if (typeof navigator === 'undefined') return 'metric'
  // Países que usam °F no dia a dia
  return /-(US|LR|MM)$/i.test(navigator.language ?? '') ? 'imperial' : 'metric'
}

function load(): Settings {
  const defaults: Settings = { lang: detectLang(), units: detectUnits(), theme: 'system', favorites: [], lastPlace: null }
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return defaults
    const parsed = JSON.parse(raw) as Partial<Settings>
    return {
      lang: parsed.lang === 'en' || parsed.lang === 'pt' ? parsed.lang : defaults.lang,
      units: parsed.units === 'imperial' || parsed.units === 'metric' ? parsed.units : defaults.units,
      theme: parsed.theme === 'dark' || parsed.theme === 'light' || parsed.theme === 'system' ? parsed.theme : 'system',
      favorites: Array.isArray(parsed.favorites) ? parsed.favorites.filter(isPlace).slice(0, MAX_FAVORITES) : [],
      lastPlace: isPlace(parsed.lastPlace) ? parsed.lastPlace : null,
    }
  } catch {
    return defaults
  }
}

function isPlace(p: unknown): p is Place {
  if (typeof p !== 'object' || p === null) return false
  const o = p as Place
  return typeof o.id === 'string' && typeof o.name === 'string' && Number.isFinite(o.latitude) && Number.isFinite(o.longitude)
}

let state: Settings = load()
const listeners = new Set<() => void>()

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    // Armazenamento indisponível: preferências valem só nesta sessão
  }
}

export function updateSettings(patch: Partial<Settings> | ((s: Settings) => Partial<Settings>)) {
  const next = typeof patch === 'function' ? patch(state) : patch
  state = { ...state, ...next }
  persist()
  listeners.forEach((l) => l())
}

export function getSettings() {
  return state
}

/** Só para testes. */
export function resetSettings() {
  state = load()
  listeners.forEach((l) => l())
}

const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, getSettings, getSettings)
}

export const isFavorite = (s: Settings, place: Place) => s.favorites.some((f) => samePlace(f, place))

export function samePlace(a: Place, b: Place) {
  if (a.id === b.id) return true
  return Math.abs(a.latitude - b.latitude) < 0.01 && Math.abs(a.longitude - b.longitude) < 0.01
}

export function toggleFavorite(place: Place) {
  updateSettings((s) => ({
    favorites: isFavorite(s, place)
      ? s.favorites.filter((f) => !samePlace(f, place))
      : [place, ...s.favorites].slice(0, MAX_FAVORITES),
  }))
}
