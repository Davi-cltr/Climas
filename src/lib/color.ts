/** Rampa térmica absoluta: a mesma temperatura tem sempre a mesma cor, em qualquer cidade. */
export const THERMAL_STOPS = [
  { c: -5, token: '--t-cold' },
  { c: 14, token: '--t-mild' },
  { c: 24, token: '--t-warm' },
  { c: 34, token: '--t-hot' },
] as const

export function readToken(name: string, el: Element = document.documentElement): string {
  return getComputedStyle(el).getPropertyValue(name).trim()
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((x) => x + x).join('') : h
  const n = parseInt(full, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export type Rgb = [number, number, number]

/** Lê as cores da rampa do tema atual (para canvas). */
export function thermalPalette(el?: Element): { c: number; rgb: Rgb }[] {
  return THERMAL_STOPS.map((s) => ({ c: s.c, rgb: hexToRgb(readToken(s.token, el) || '#888888') }))
}

export function interpolateStops(value: number, stops: { c: number; rgb: Rgb }[]): Rgb {
  if (value <= stops[0].c) return stops[0].rgb
  for (let i = 1; i < stops.length; i++) {
    if (value <= stops[i].c) {
      const a = stops[i - 1]
      const b = stops[i]
      const t = (value - a.c) / (b.c - a.c)
      return [0, 1, 2].map((k) => Math.round(a.rgb[k] + (b.rgb[k] - a.rgb[k]) * t)) as Rgb
    }
  }
  return stops[stops.length - 1].rgb
}

export function tokenRgb(name: string, el?: Element): Rgb {
  return hexToRgb(readToken(name, el) || '#888888')
}

export const rgba = ([r, g, b]: Rgb, a: number) => `rgba(${r},${g},${b},${a})`

/** Posição (0–1) de uma temperatura dentro da rampa, para gradientes em SVG. */
export function thermalOffset(c: number) {
  const min = THERMAL_STOPS[0].c
  const max = THERMAL_STOPS[THERMAL_STOPS.length - 1].c
  return Math.max(0, Math.min(1, (c - min) / (max - min)))
}

/** Estilo CSS que recorta a rampa térmica (gradiente de 4 paradas) para mostrar só [min, max]. */
export function rampWindow(min: number, max: number): { backgroundSize: string; backgroundPosition: string } {
  const from = thermalOffset(min)
  const span = Math.max(0.06, thermalOffset(max) - from)
  const size = 100 / span
  const pos = span >= 0.999 ? 0 : (from / (1 - span)) * 100
  return { backgroundSize: `${size}% 100%`, backgroundPosition: `${pos}% 0` }
}
