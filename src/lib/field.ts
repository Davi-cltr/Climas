/**
 * Campo contínuo a partir da grade de pontos da Open-Meteo.
 * A interpolação é bilinear entre os pontos reais; o resultado é uma estimativa visual, rotulada como tal.
 */
import type { ForecastGrid } from './types'

export type FieldKind = 'temperature' | 'precipProbability' | 'windSpeed'

/** Valores de uma variável no instante `t` (índice do eixo da grade), linha a linha. */
export function gridSlice(grid: ForecastGrid, kind: FieldKind, t: number): (number | null)[] {
  return grid.points.map((p) => p[kind][t] ?? null)
}

/** Interpolação bilinear com tolerância a nulos: usa só os cantos disponíveis. */
export function bilinear(values: (number | null)[], rows: number, cols: number, r: number, c: number): number {
  const r0 = Math.max(0, Math.min(rows - 1, Math.floor(r)))
  const c0 = Math.max(0, Math.min(cols - 1, Math.floor(c)))
  const r1 = Math.min(rows - 1, r0 + 1)
  const c1 = Math.min(cols - 1, c0 + 1)
  const tr = Math.max(0, Math.min(1, r - r0))
  const tc = Math.max(0, Math.min(1, c - c0))
  const corners: [number | null, number][] = [
    [values[r0 * cols + c0], (1 - tr) * (1 - tc)],
    [values[r0 * cols + c1], (1 - tr) * tc],
    [values[r1 * cols + c0], tr * (1 - tc)],
    [values[r1 * cols + c1], tr * tc],
  ]
  let sum = 0
  let weight = 0
  for (const [v, w] of corners) {
    if (v === null) continue
    sum += v * w
    weight += w
  }
  return weight > 0 ? sum / weight : NaN
}

/** Amostra a grade numa malha mais fina (para isolinhas suaves). */
export function upsample(values: (number | null)[], rows: number, cols: number, factor: number) {
  const w = (cols - 1) * factor + 1
  const h = (rows - 1) * factor + 1
  const data = new Float64Array(w * h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      data[y * w + x] = bilinear(values, rows, cols, y / factor, x / factor)
    }
  }
  return { data, w, h }
}

/** Posição fracionária na grade (linha, coluna) para uma coordenada geográfica. */
export function latLonToGrid(grid: Pick<ForecastGrid, 'latitudes' | 'longitudes' | 'rows' | 'cols'>, lat: number, lon: number) {
  const { latitudes, longitudes, rows, cols } = grid
  const r = ((latitudes[0] - lat) / (latitudes[0] - latitudes[rows - 1])) * (rows - 1)
  const c = ((lon - longitudes[0]) / (longitudes[cols - 1] - longitudes[0])) * (cols - 1)
  return { r, c, inside: r >= 0 && r <= rows - 1 && c >= 0 && c <= cols - 1 }
}

export function gridToLatLon(grid: Pick<ForecastGrid, 'latitudes' | 'longitudes' | 'rows' | 'cols'>, r: number, c: number) {
  const { latitudes, longitudes, rows, cols } = grid
  const lat = latitudes[0] + (r / (rows - 1)) * (latitudes[rows - 1] - latitudes[0])
  const lon = longitudes[0] + (c / (cols - 1)) * (longitudes[cols - 1] - longitudes[0])
  return { lat, lon }
}

/**
 * Componentes do vento "para onde vai" (km/h): u para leste, v para norte.
 * A direção meteorológica indica de onde o vento vem, por isso soma-se 180°.
 * Interpolar u e v (e não o ângulo) evita saltos entre 359° e 0°.
 */
export function windComponents(speed: number, fromDeg: number) {
  const to = ((fromDeg + 180) * Math.PI) / 180
  return { u: speed * Math.sin(to), v: speed * Math.cos(to) }
}

export function windField(grid: ForecastGrid, t: number) {
  const u: (number | null)[] = []
  const v: (number | null)[] = []
  for (const p of grid.points) {
    const s = p.windSpeed[t]
    const d = p.windDirection[t]
    if (s == null || d == null) {
      u.push(null)
      v.push(null)
    } else {
      const w = windComponents(s, d)
      u.push(w.u)
      v.push(w.v)
    }
  }
  return { u, v }
}

/** Limiares "redondos" para isolinhas dentro de um intervalo. */
export function thresholds(min: number, max: number, step: number) {
  const out: number[] = []
  const start = Math.ceil(min / step) * step
  for (let v = start; v <= max + 1e-9; v += step) out.push(Number(v.toFixed(6)))
  return out
}

/** Escolhe um passo de isolinha que gere entre ~4 e ~12 linhas. */
export function niceStep(span: number, candidates: number[]) {
  for (const c of candidates) if (span / c <= 12) return c
  return candidates[candidates.length - 1]
}
