/**
 * Desenho do campo atmosférico sobre o mapa (canvas 2D).
 * Isolinhas e faixas vêm da interpolação da grade real; partículas seguem o vento interpolado.
 */
import { contours } from 'd3-contour'
import { interpolateStops, rgba, thermalPalette, tokenRgb, type Rgb } from '../../lib/color'
import { bilinear, gridSlice, gridToLatLon, latLonToGrid, niceStep, thresholds, upsample, windField, type FieldKind } from '../../lib/field'
import type { ForecastGrid } from '../../lib/types'

export interface Projector {
  project(lon: number, lat: number): [number, number]
  unproject(x: number, y: number): [number, number]
}

export type MapMode = 'temperature' | 'rain' | 'wind'

export const MODE_FIELD: Record<MapMode, FieldKind> = {
  temperature: 'temperature',
  rain: 'precipProbability',
  wind: 'windSpeed',
}

const UPSAMPLE = 6

interface Theme {
  ink: Rgb
  surface: Rgb
  rain: Rgb
  wind: Rgb
  muted: Rgb
  thermal: { c: number; rgb: Rgb }[]
  alpha: number
  dark: boolean
}

export function readTheme(root: Element): Theme {
  const alpha = parseFloat(getComputedStyle(root).getPropertyValue('--map-field-alpha')) || 0.2
  return {
    ink: tokenRgb('--ink', root),
    surface: tokenRgb('--surface-0', root),
    rain: tokenRgb('--rain', root),
    wind: tokenRgb('--wind', root),
    muted: tokenRgb('--muted', root),
    thermal: thermalPalette(root),
    alpha,
    dark: root.getAttribute('data-resolved-theme') !== 'light',
  }
}

function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return [0, 1, 2].map((k) => Math.round(a[k] + (b[k] - a[k]) * t)) as Rgb
}

/** Cor de um valor conforme o modo. Temperatura usa a rampa absoluta; chuva e vento, escalas fixas. */
export function colorFor(mode: MapMode, v: number, theme: Theme): Rgb {
  if (mode === 'temperature') return interpolateStops(v, theme.thermal)
  if (mode === 'rain') return mix(theme.surface, theme.rain, Math.min(1, v / 100))
  return mix(theme.surface, theme.wind, Math.min(1, v / 50))
}

function stepFor(mode: MapMode, span: number) {
  if (mode === 'temperature') return niceStep(span, [0.5, 1, 2, 5])
  if (mode === 'rain') return 10
  return niceStep(span, [1, 2, 5, 10])
}

/** Contorno da área coberta pela grade, em pixels (para recortar o desenho). */
function gridOutline(grid: ForecastGrid, proj: Projector) {
  const pts: [number, number][] = []
  const R = grid.rows - 1
  const C = grid.cols - 1
  const push = (r: number, c: number) => {
    const { lat, lon } = gridToLatLon(grid, r, c)
    pts.push(proj.project(lon, lat))
  }
  for (let c = 0; c <= C; c += 0.5) push(0, c)
  for (let r = 0; r <= R; r += 0.5) push(r, C)
  for (let c = C; c >= 0; c -= 0.5) push(R, c)
  for (let r = R; r >= 0; r -= 0.5) push(r, 0)
  return pts
}

export interface FieldStats {
  min: number
  max: number
  step: number
}

export function drawField(
  ctx: CanvasRenderingContext2D,
  scratch: HTMLCanvasElement,
  grid: ForecastGrid,
  t: number,
  mode: MapMode,
  proj: Projector,
  theme: Theme,
  labelFormat: (v: number) => string,
): FieldStats | null {
  const values = gridSlice(grid, MODE_FIELD[mode], t)
  const finite = values.filter((v): v is number => v !== null)
  if (finite.length < 4) return null
  const min = Math.min(...finite)
  const max = Math.max(...finite)
  const step = stepFor(mode, max - min)

  const { data, w, h } = upsample(values, grid.rows, grid.cols, UPSAMPLE)
  const low = min - step * 2
  for (let i = 0; i < data.length; i++) if (Number.isNaN(data[i])) data[i] = low

  const bands = thresholds(Math.floor(min / step) * step, max, step)
  const polys = contours().size([w, h]).thresholds(bands)(Array.from(data))

  const toScreen = (x: number, y: number) => {
    const c = Math.max(0, Math.min(w - 1, x - 0.5)) / UPSAMPLE
    const r = Math.max(0, Math.min(h - 1, y - 0.5)) / UPSAMPLE
    const { lat, lon } = gridToLatLon(grid, r, c)
    return proj.project(lon, lat)
  }

  /** Traço das isolinhas: pula os trechos que só acompanham a borda da grade (não são isolinhas reais). */
  const onEdge = (x: number, y: number) => x <= 0.51 || y <= 0.51 || x >= w - 0.51 || y >= h - 0.51
  const traceLines = (target: CanvasRenderingContext2D, coords: number[][][][]) => {
    for (const polygon of coords) {
      for (const ring of polygon) {
        let pen = false
        for (let i = 0; i < ring.length; i++) {
          const [x, y] = ring[i]
          const prev = ring[i - 1]
          const edgeSeg = prev && onEdge(x, y) && onEdge(prev[0], prev[1])
          const [px, py] = toScreen(x, y)
          if (!pen || edgeSeg) {
            target.moveTo(px, py)
            pen = true
          } else target.lineTo(px, py)
        }
      }
    }
  }

  const tracePolygon = (target: CanvasRenderingContext2D, coords: number[][][][]) => {
    for (const polygon of coords) {
      for (const ring of polygon) {
        ring.forEach(([x, y], i) => {
          const [px, py] = toScreen(x, y)
          if (i === 0) target.moveTo(px, py)
          else target.lineTo(px, py)
        })
        target.closePath()
      }
    }
  }

  const W = ctx.canvas.width
  const H = ctx.canvas.height
  const dpr = ctx.getTransform().a || 1
  const outline = gridOutline(grid, proj)

  // 1) Faixas opacas num canvas auxiliar, depois compostas com uma única transparência (sem empilhar alfa)
  scratch.width = W
  scratch.height = H
  const sc = scratch.getContext('2d')!
  sc.setTransform(dpr, 0, 0, dpr, 0, 0)
  sc.clearRect(0, 0, W, H)
  for (const p of polys) {
    sc.beginPath()
    tracePolygon(sc, p.coordinates)
    sc.fillStyle = rgba(colorFor(mode, p.value + step / 2, theme), 1)
    sc.fill('evenodd')
  }

  ctx.save()
  ctx.beginPath()
  outline.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)))
  ctx.closePath()
  ctx.clip()
  // Tela no tema escuro (a cor ilumina o fundo), multiplicação no claro (a cor tinge o papel)
  ctx.globalCompositeOperation = theme.dark ? 'screen' : 'multiply'
  ctx.globalAlpha = theme.alpha
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.drawImage(scratch, 0, 0)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = 'source-over'

  // 2) Isolinhas (a cada 2 passos) com rótulo
  const majorEvery = mode === 'rain' ? 2 : 2
  ctx.lineWidth = 1
  ctx.font = '500 11px "Archivo Variable", system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  polys.forEach((p, idx) => {
    if (idx === 0) return
    const major = Math.round(p.value / step) % majorEvery === 0
    ctx.beginPath()
    traceLines(ctx, p.coordinates)
    // Isolinhas coloridas pelo próprio valor: a cor carrega informação, o preenchimento fica sutil
    const lineColor = mode === 'temperature' ? colorFor(mode, p.value, theme) : mode === 'rain' ? theme.rain : theme.wind
    ctx.strokeStyle = rgba(lineColor, major ? 0.9 : 0.35)
    ctx.lineWidth = major ? 1.4 : 0.8
    ctx.stroke()
    if (!major) return
    // Rótulo no ponto da linha mais próximo do centro da vista, longe das bordas e dos controles
    const ring = p.coordinates.flat().sort((a, b) => b.length - a.length)[0]
    if (!ring || ring.length < 12) return
    const vw = W / dpr
    const vh = H / dpr
    let best: [number, number] | null = null
    let bestD = Infinity
    for (let k = 0; k < ring.length; k += 2) {
      const [sx, sy] = toScreen(ring[k][0], ring[k][1])
      if (sx < 48 || sx > vw - 48 || sy < 90 || sy > vh - 40) continue
      const d = Math.hypot(sx - vw * (0.35 + 0.3 * ((idx % 3) / 2)), sy - vh * 0.45)
      if (d < bestD) {
        bestD = d
        best = [sx, sy]
      }
    }
    if (!best) return
    const [lx, ly] = best
    const text = labelFormat(p.value)
    const tw = ctx.measureText(text).width + 8
    ctx.fillStyle = rgba(theme.surface, 0.88)
    ctx.fillRect(lx - tw / 2, ly - 8, tw, 16)
    ctx.fillStyle = rgba(lineColor, 1)
    ctx.fillText(text, lx, ly)
  })
  ctx.restore()

  // 3) Pontos reais da grade
  ctx.save()
  grid.points.forEach((_, i) => {
    const r = Math.floor(i / grid.cols)
    const c = i % grid.cols
    const { lat, lon } = gridToLatLon(grid, r, c)
    const [x, y] = proj.project(lon, lat)
    ctx.beginPath()
    ctx.arc(x, y, 1.8, 0, Math.PI * 2)
    ctx.fillStyle = rgba(theme.muted, values[i] === null ? 0.25 : 0.75)
    ctx.fill()
  })
  ctx.restore()

  return { min, max, step }
}

/* ------------------------------------------------------------------ */
/* Partículas de vento                                                  */
/* ------------------------------------------------------------------ */

interface Particle {
  x: number
  y: number
  age: number
  life: number
}

export class WindParticles {
  private particles: Particle[] = []
  private grid: ForecastGrid | null = null
  private u: (number | null)[] = []
  private v: (number | null)[] = []
  private proj: Projector | null = null
  private width = 0
  private height = 0
  private bounds = { x0: 0, y0: 0, x1: 0, y1: 0 }
  private ctx: CanvasRenderingContext2D
  private color: Rgb = [143, 214, 194]
  private raf = 0
  private running = false
  private emphasis = 0.5

  private canvas: HTMLCanvasElement

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')!
  }

  configure(opts: {
    grid: ForecastGrid
    t: number
    proj: Projector
    width: number
    height: number
    dpr: number
    color: Rgb
    emphasis: number
  }) {
    this.grid = opts.grid
    const f = windField(opts.grid, opts.t)
    this.u = f.u
    this.v = f.v
    this.proj = opts.proj
    this.width = opts.width
    this.height = opts.height
    this.color = opts.color
    this.emphasis = opts.emphasis
    this.canvas.width = Math.round(opts.width * opts.dpr)
    this.canvas.height = Math.round(opts.height * opts.dpr)
    this.ctx.setTransform(opts.dpr, 0, 0, opts.dpr, 0, 0)

    // Retângulo de pixels coberto pela grade
    const corners = [
      gridToLatLon(opts.grid, 0, 0),
      gridToLatLon(opts.grid, opts.grid.rows - 1, opts.grid.cols - 1),
    ].map(({ lat, lon }) => opts.proj.project(lon, lat))
    this.bounds = {
      x0: Math.max(0, Math.min(corners[0][0], corners[1][0])),
      y0: Math.max(0, Math.min(corners[0][1], corners[1][1])),
      x1: Math.min(opts.width, Math.max(corners[0][0], corners[1][0])),
      y1: Math.min(opts.height, Math.max(corners[0][1], corners[1][1])),
    }
    // Densidade limitada pela área visível: no máximo ~700 partículas
    const area = Math.max(0, this.bounds.x1 - this.bounds.x0) * Math.max(0, this.bounds.y1 - this.bounds.y0)
    const count = Math.min(700, Math.round(area / 1100))
    this.particles = Array.from({ length: count }, () => this.spawn(true))
    this.ctx.clearRect(0, 0, this.width, this.height)
  }

  private spawn(randomAge = false): Particle {
    const { x0, y0, x1, y1 } = this.bounds
    const life = 60 + Math.random() * 80
    return { x: x0 + Math.random() * (x1 - x0), y: y0 + Math.random() * (y1 - y0), age: randomAge ? Math.random() * life : 0, life }
  }

  /** Velocidade em px/quadro no ponto de tela. Escala visual, não física. */
  private velocity(x: number, y: number): [number, number] | null {
    if (!this.grid || !this.proj) return null
    const [lon, lat] = this.proj.unproject(x, y)
    const pos = latLonToGrid(this.grid, lat, lon)
    if (!pos.inside) return null
    const u = bilinear(this.u, this.grid.rows, this.grid.cols, pos.r, pos.c)
    const v = bilinear(this.v, this.grid.rows, this.grid.cols, pos.r, pos.c)
    if (Number.isNaN(u) || Number.isNaN(v)) return null
    const k = 0.12
    return [u * k, -v * k]
  }

  private step() {
    const ctx = this.ctx
    // Rastro: apaga parcialmente o quadro anterior
    ctx.globalCompositeOperation = 'destination-in'
    ctx.fillStyle = 'rgba(0,0,0,0.95)'
    ctx.fillRect(0, 0, this.width, this.height)
    ctx.globalCompositeOperation = 'source-over'
    ctx.lineWidth = 1.1
    ctx.strokeStyle = rgba(this.color, 0.35 + 0.45 * this.emphasis)
    ctx.beginPath()
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i]
      const vel = this.velocity(p.x, p.y)
      p.age++
      if (!vel || p.age > p.life) {
        this.particles[i] = this.spawn()
        continue
      }
      const nx = p.x + vel[0]
      const ny = p.y + vel[1]
      ctx.moveTo(p.x, p.y)
      ctx.lineTo(nx, ny)
      p.x = nx
      p.y = ny
    }
    ctx.stroke()
  }

  start() {
    if (this.running) return
    this.running = true
    const loop = () => {
      if (!this.running) return
      this.step()
      this.raf = requestAnimationFrame(loop)
    }
    this.raf = requestAnimationFrame(loop)
  }

  stop() {
    this.running = false
    cancelAnimationFrame(this.raf)
  }

  /** Versão estática (movimento reduzido): linhas de fluxo integradas a partir de uma malha regular. */
  drawStatic() {
    this.stop()
    const ctx = this.ctx
    ctx.clearRect(0, 0, this.width, this.height)
    ctx.strokeStyle = rgba(this.color, 0.4 + 0.4 * this.emphasis)
    ctx.lineWidth = 1.1
    const { x0, y0, x1, y1 } = this.bounds
    const gap = 34
    for (let y = y0 + gap / 2; y < y1; y += gap) {
      for (let x = x0 + gap / 2; x < x1; x += gap) {
        let px = x
        let py = y
        ctx.beginPath()
        ctx.moveTo(px, py)
        for (let s = 0; s < 14; s++) {
          const vel = this.velocity(px, py)
          if (!vel) break
          const m = Math.hypot(vel[0], vel[1]) || 1
          px += (vel[0] / m) * 1.6 * Math.min(4, m * 3)
          py += (vel[1] / m) * 1.6 * Math.min(4, m * 3)
          ctx.lineTo(px, py)
        }
        ctx.stroke()
      }
    }
  }

  clear() {
    this.ctx.clearRect(0, 0, this.width, this.height)
  }
}
