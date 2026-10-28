import 'maplibre-gl/dist/maplibre-gl.css'
import { Map as MapLibreMap, setWorkerUrl } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useI18n } from '../../i18n/useI18n'
import { gridToLatLon } from '../../lib/field'
import { hourIndexAt } from '../../lib/time'
import type { ForecastGrid } from '../../lib/types'
import { formatPercent, formatSpeed, formatTemp } from '../../lib/units'
import { drawField, readTheme, WindParticles, type FieldStats, type MapMode, type Projector } from './overlay'
import { BASE_STYLE_URL, paintBaseMap } from './mapStyle'
import s from './AtmosMap.module.css'

setWorkerUrl(workerUrl)

export interface AtmosMapProps {
  latitude: number
  longitude: number
  grid: ForecastGrid | null
  /** Instante selecionado na linha do tempo (ms). */
  time: number
  mode: MapMode
  reducedMotion: boolean
  /** Muda quando o tema efetivo muda, para repintar. */
  themeKey: string
  /** Rótulo do marcador central (lugar e valor na hora escolhida). */
  centerLabel: string
  onPick: (lat: number, lon: number) => void
  onStats?: (stats: FieldStats | null) => void
  onBaseError?: () => void
}

function webglAvailable() {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

/** Projeção simples (equiretangular) quando não há WebGL: a grade continua legível sem mapa base. */
function fallbackProjector(grid: ForecastGrid | null, lat: number, lon: number, w: number, h: number): Projector {
  const spanLat = grid ? Math.abs(grid.latitudes[0] - grid.latitudes[grid.rows - 1]) : 1.2
  const spanLon = grid ? Math.abs(grid.longitudes[grid.cols - 1] - grid.longitudes[0]) : 1.2
  const scale = Math.min((w * 0.86) / spanLon, (h * 0.86) / spanLat)
  return {
    project: (lo, la) => [w / 2 + (lo - lon) * scale, h / 2 - (la - lat) * scale],
    unproject: (x, y) => [lon + (x - w / 2) / scale, lat - (y - h / 2) / scale],
  }
}

/** Marcador do lugar consultado: mira em ciano, a única cor de destaque do produto. */
function drawCenter(ctx: CanvasRenderingContext2D, [x, y]: [number, number], label: string) {
  const root = document.documentElement
  const signal = getComputedStyle(root).getPropertyValue('--signal').trim() || '#7fe6f2'
  const ink = getComputedStyle(root).getPropertyValue('--ink').trim() || '#e6eff7'
  const surface = getComputedStyle(root).getPropertyValue('--surface-0').trim() || '#08131f'
  ctx.save()
  ctx.strokeStyle = signal
  ctx.fillStyle = signal
  ctx.lineWidth = 1.2
  ctx.globalAlpha = 0.45
  ctx.beginPath()
  ctx.arc(x, y, 24, 0, Math.PI * 2)
  ctx.stroke()
  ctx.globalAlpha = 1
  ctx.beginPath()
  ;[
    [-38, 0, -28, 0],
    [28, 0, 38, 0],
    [0, -38, 0, -28],
    [0, 28, 0, 38],
  ].forEach(([a, b, c, d]) => {
    ctx.moveTo(x + a, y + b)
    ctx.lineTo(x + c, y + d)
  })
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(x, y, 4.5, 0, Math.PI * 2)
  ctx.fill()
  ctx.font = '560 14px "Archivo Variable", system-ui, sans-serif'
  ctx.textBaseline = 'middle'
  const tw = ctx.measureText(label).width
  const lx = x + 34
  const ly = y - 20
  ctx.fillStyle = surface
  ctx.globalAlpha = 0.8
  ctx.fillRect(lx - 6, ly - 11, tw + 12, 22)
  ctx.globalAlpha = 1
  ctx.fillStyle = ink
  ctx.fillText(label, lx, ly)
  ctx.restore()
}

export default function AtmosMap({ latitude, longitude, grid, time, mode, reducedMotion, themeKey, centerLabel, onPick, onStats, onBaseError }: AtmosMapProps) {
  const { locale, units } = useI18n()
  const rootRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<HTMLDivElement>(null)
  const fieldRef = useRef<HTMLCanvasElement>(null)
  const windRef = useRef<HTMLCanvasElement>(null)
  const scratchRef = useRef<HTMLCanvasElement | null>(null)
  const map = useRef<MapLibreMap | null>(null)
  const particles = useRef<WindParticles | null>(null)
  const [ready, setReady] = useState(false)
  const [noGl] = useState(() => !webglAvailable())
  const [frame, setFrame] = useState(0)
  const visible = useRef(true)
  const callbacks = useRef({ onPick, onStats, onBaseError })
  useLayoutEffect(() => {
    callbacks.current = { onPick, onStats, onBaseError }
  })

  // Cria o mapa uma vez
  useEffect(() => {
    if (noGl || !mapRef.current) {
      setReady(true)
      return
    }
    const m = new MapLibreMap({
      container: mapRef.current,
      style: BASE_STYLE_URL,
      center: [longitude, latitude],
      zoom: 8,
      attributionControl: { compact: true },
      cooperativeGestures: true,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      maxZoom: 11,
      minZoom: 4,
      fadeDuration: 0,
    })
    m.touchZoomRotate.disableRotation()
    map.current = m
    const redraw = () => setFrame((f) => f + 1)
    m.on('load', () => {
      paintBaseMap(m, document.documentElement)
      setReady(true)
    })
    m.on('error', (e) => {
      // Falha ao carregar estilo/tiles: mantém a grade sobre fundo liso
      if (!m.isStyleLoaded()) setReady(true)
      if (String(e?.error?.message ?? '').length) callbacks.current.onBaseError?.()
    })
    m.on('move', redraw)
    m.on('resize', redraw)
    m.on('click', (e) => {
      const ll = e.lngLat.wrap()
      callbacks.current.onPick(ll.lat, ll.lng)
    })
    return () => {
      m.remove()
      map.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noGl])

  // Enquadra a grade ao trocar de lugar
  useEffect(() => {
    const m = map.current
    if (!m) return
    if (grid) {
      const a = gridToLatLon(grid, 0, 0)
      const b = gridToLatLon(grid, grid.rows - 1, grid.cols - 1)
      // "Cobrir": a grade preenche o painel inteiro (as bordas da grade podem ficar fora de vista)
      const bounds: [[number, number], [number, number]] = [
        [Math.min(a.lon, b.lon), Math.min(a.lat, b.lat)],
        [Math.max(a.lon, b.lon), Math.max(a.lat, b.lat)],
      ]
      m.resize()
      const cam = m.cameraForBounds(bounds, { padding: 0 })
      const box = m.getContainer().getBoundingClientRect()
      if (cam && cam.zoom !== undefined && box.width > 0) {
        const { width: W, height: H } = box
        const lonSpan = bounds[1][0] - bounds[0][0]
        const latSpan = bounds[1][1] - bounds[0][1]
        // A grade é aproximadamente quadrada em pixels por grau corrigido; compara proporções
        const gridAspect = lonSpan / (latSpan / Math.max(0.2, Math.cos((latitude * Math.PI) / 180)))
        const panelAspect = W / H
        const extra = Math.log2(Math.max(gridAspect / panelAspect, panelAspect / gridAspect)) * 0.92
        // Sem animação: um resize inicial interromperia o easeTo e deixaria a grade mal enquadrada
        m.jumpTo({ center: [longitude, latitude], zoom: cam.zoom + Math.max(0, extra) })
      } else {
        m.fitBounds(bounds, { padding: 0, duration: 0 })
      }
    } else {
      m.jumpTo({ center: [longitude, latitude] })
    }
  }, [grid, latitude, longitude])

  // Repinta o mapa base quando o tema muda
  useEffect(() => {
    const m = map.current
    if (m?.isStyleLoaded()) paintBaseMap(m, document.documentElement)
    setFrame((f) => f + 1)
  }, [themeKey])

  // Redesenha campo e partículas
  useEffect(() => {
    const root = rootRef.current
    const fieldCanvas = fieldRef.current
    const windCanvas = windRef.current
    if (!root || !fieldCanvas || !windCanvas || !ready) return
    const w = root.clientWidth
    const h = root.clientHeight
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    fieldCanvas.width = Math.round(w * dpr)
    fieldCanvas.height = Math.round(h * dpr)
    const ctx = fieldCanvas.getContext('2d')!
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)
    if (!grid) {
      particles.current?.clear()
      callbacks.current.onStats?.(null)
      return
    }

    const m = map.current
    const proj: Projector = m
      ? {
          project: (lo, la) => {
            const p = m.project([lo, la])
            return [p.x, p.y]
          },
          unproject: (x, y) => {
            const ll = m.unproject([x, y])
            return [ll.lng, ll.lat]
          },
        }
      : fallbackProjector(grid, latitude, longitude, w, h)

    const theme = readTheme(document.documentElement)
    const t = Math.max(0, hourIndexAt(grid.times, time))
    scratchRef.current ??= document.createElement('canvas')
    const label = (v: number) =>
      mode === 'temperature' ? formatTemp(v, units, locale) : mode === 'rain' ? formatPercent(v, locale) : formatSpeed(v, units, locale)
    const stats = drawField(ctx, scratchRef.current, grid, t, mode, proj, theme, label)
    callbacks.current.onStats?.(stats)
    drawCenter(ctx, proj.project(longitude, latitude), centerLabel)

    particles.current ??= new WindParticles(windCanvas)
    particles.current.configure({ grid, t, proj, width: w, height: h, dpr, color: theme.wind, emphasis: mode === 'wind' ? 1 : 0.35 })
    if (reducedMotion || !visible.current) particles.current.drawStatic()
    else particles.current.start()
  }, [grid, time, mode, ready, frame, reducedMotion, latitude, longitude, locale, units, centerLabel])

  // Pausa a animação fora da tela ou com a aba oculta
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const io = new IntersectionObserver(([entry]) => {
      visible.current = entry.isIntersecting && !document.hidden
      if (!visible.current) particles.current?.stop()
      else setFrame((f) => f + 1)
    })
    io.observe(root)
    const onVis = () => {
      visible.current = !document.hidden
      if (document.hidden) particles.current?.stop()
      else setFrame((f) => f + 1)
    }
    document.addEventListener('visibilitychange', onVis)
    const ro = new ResizeObserver(() => setFrame((f) => f + 1))
    ro.observe(root)
    return () => {
      io.disconnect()
      ro.disconnect()
      document.removeEventListener('visibilitychange', onVis)
      particles.current?.stop()
    }
  }, [])

  // Sem WebGL, o clique no fundo também escolhe um ponto
  const onFallbackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!noGl || !grid || !rootRef.current) return
    const rect = rootRef.current.getBoundingClientRect()
    const proj = fallbackProjector(grid, latitude, longitude, rect.width, rect.height)
    const [lo, la] = proj.unproject(e.clientX - rect.left, e.clientY - rect.top)
    onPick(la, lo)
  }

  return (
    <div className={s.stage} ref={rootRef} onClick={onFallbackClick} data-nogl={noGl || undefined}>
      <div ref={mapRef} className={s.base} />
      <canvas ref={fieldRef} className={s.layer} aria-hidden="true" />
      <canvas ref={windRef} className={s.layer} aria-hidden="true" />
    </div>
  )
}
