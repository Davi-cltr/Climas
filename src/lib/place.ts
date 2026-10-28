import type { Place } from './types'

export function placeDetail(p: Place) {
  return [p.admin1 && p.admin1 !== p.name ? p.admin1 : null, p.country].filter(Boolean).join(', ')
}

export function formatCoords(lat: number, lon: number, lang: 'pt' | 'en', digits = 2) {
  const nf = new Intl.NumberFormat(lang === 'pt' ? 'pt-BR' : 'en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })
  const ns = lat >= 0 ? 'N' : 'S'
  const ew = lon >= 0 ? (lang === 'pt' ? 'L' : 'E') : lang === 'pt' ? 'O' : 'W'
  return `${nf.format(Math.abs(lat))}° ${ns}  ${nf.format(Math.abs(lon))}° ${ew}`
}
