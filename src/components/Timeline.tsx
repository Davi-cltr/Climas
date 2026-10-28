import { scaleLinear } from 'd3-scale'
import { area, curveMonotoneX, line } from 'd3-shape'
import { useId, useMemo, useRef } from 'react'
import { useI18n } from '../i18n/useI18n'
import { THERMAL_STOPS } from '../lib/color'
import { extent } from '../lib/derive'
import { formatDayShort, formatHourShort, localParts } from '../lib/time'
import type { HourPoint } from '../lib/types'
import { compassPoint, convertSpeed, formatNumber, formatPercent, formatPrecip, formatSpeed, formatTemp } from '../lib/units'
import { conditionLabel } from '../lib/weatherCodes'
import { useSize } from '../state/useSize'
import s from './Timeline.module.css'

interface Props {
  hours: HourPoint[]
  selected: number
  pinned: number | null
  onSelect: (i: number) => void
  timeZone: string
  /** Muda a cada nova previsão, para reexecutar a animação de entrada. */
  animationKey: string
}

const MIN_HOUR_WIDTH = 24
const PAD_L = 44
const PAD_R = 16
/** Faixa superior reservada ao tooltip, para ele nunca cobrir a curva. */
const TIP_BAND = 62
const TEMP_TOP = TIP_BAND + 24
const TEMP_BOTTOM = TEMP_TOP + 124
const AXIS_Y = TEMP_BOTTOM + 20
const RAIN_TOP = AXIS_Y + 18
const RAIN_H = 44
const WIND_Y = RAIN_TOP + RAIN_H + 28
const HEIGHT = WIND_Y + 32

export function Timeline({ hours, selected, pinned, onSelect, timeZone, animationKey }: Props) {
  const { t, lang, locale, units } = useI18n()
  const [wrapRef, { width: containerWidth }] = useSize<HTMLDivElement>()
  const gradId = useId()
  const pointer = useRef<{ id: number; x: number; y: number; type: string; dragging: boolean } | null>(null)

  const n = hours.length
  const width = Math.max(containerWidth, PAD_L + PAD_R + n * MIN_HOUR_WIDTH)
  const scrolls = width > containerWidth + 1

  const geo = useMemo(() => {
    const x = scaleLinear()
      .domain([0, Math.max(1, n - 1)])
      .range([PAD_L, width - PAD_R])
    const tExt = extent(hours.map((h) => h.temperature)) ?? [0, 1]
    const pad = Math.max(1.5, (tExt[1] - tExt[0]) * 0.18)
    const y = scaleLinear()
      .domain([tExt[0] - pad, tExt[1] + pad])
      .range([TEMP_BOTTOM, TEMP_TOP])
      .nice()
    const step = (width - PAD_L - PAD_R) / Math.max(1, n - 1)
    const mm = extent(hours.map((h) => h.precipitation))
    const mmMax = Math.max(4, mm?.[1] ?? 0)
    return { x, y, step, mmMax }
  }, [hours, n, width])

  const { x, y, step, mmMax } = geo

  const paths = useMemo(() => {
    const defined = (h: HourPoint) => h.temperature !== null
    const ln = line<HourPoint>()
      .defined(defined)
      .x((_, i) => x(i))
      .y((h) => y(h.temperature as number))
      .curve(curveMonotoneX)
    const ar = area<HourPoint>()
      .defined(defined)
      .x((_, i) => x(i))
      .y0(TEMP_BOTTOM)
      .y1((h) => y(h.temperature as number))
      .curve(curveMonotoneX)
    return { line: ln(hours) ?? '', area: ar(hours) ?? '' }
  }, [hours, x, y])

  // Máxima e mínima da janela
  const marks = useMemo(() => {
    let max = -1
    let min = -1
    hours.forEach((h, i) => {
      if (h.temperature === null) return
      if (max < 0 || h.temperature > (hours[max].temperature as number)) max = i
      if (min < 0 || h.temperature < (hours[min].temperature as number)) min = i
    })
    return { max, min }
  }, [hours])

  const midnights = useMemo(
    () => hours.map((h, i) => ({ i, h })).filter(({ h, i }) => i > 0 && localParts(h.time, timeZone).hour === 0),
    [hours, timeZone],
  )

  const labelEvery = width / n < 30 ? 3 : 2
  const windEvery = width / n < 30 ? 3 : 2

  // Gradiente vertical da linha: estende a rampa absoluta pelo eixo y, então cada altura tem a cor da sua temperatura
  const hot = THERMAL_STOPS[THERMAL_STOPS.length - 1].c
  const cold = THERMAL_STOPS[0].c
  const stops = THERMAL_STOPS.map((st) => ({ ...st, offset: (hot - st.c) / (hot - cold) }))

  const indexFromClientX = (clientX: number, el: Element) => {
    const rect = el.getBoundingClientRect()
    const px = ((clientX - rect.left) / rect.width) * width
    return Math.max(0, Math.min(n - 1, Math.round((px - PAD_L) / step)))
  }

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    pointer.current = { id: e.pointerId, x: e.clientX, y: e.clientY, type: e.pointerType, dragging: e.pointerType !== 'touch' }
    if (e.pointerType !== 'touch') {
      e.currentTarget.setPointerCapture(e.pointerId)
      onSelect(indexFromClientX(e.clientX, e.currentTarget))
    }
  }
  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const p = pointer.current
    if (!p || p.id !== e.pointerId || !p.dragging) return
    onSelect(indexFromClientX(e.clientX, e.currentTarget))
  }
  const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    const p = pointer.current
    pointer.current = null
    // No toque, um toque curto escolhe a hora; arrastar continua rolando a linha do tempo
    if (p?.type === 'touch' && Math.hypot(e.clientX - p.x, e.clientY - p.y) < 10) {
      onSelect(indexFromClientX(e.clientX, e.currentTarget))
    }
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    const map: Record<string, number> = {
      ArrowRight: selected + 1,
      ArrowUp: selected + 1,
      ArrowLeft: selected - 1,
      ArrowDown: selected - 1,
      PageUp: selected + 6,
      PageDown: selected - 6,
      Home: 0,
      End: n - 1,
    }
    if (!(e.key in map)) return
    e.preventDefault()
    onSelect(Math.max(0, Math.min(n - 1, map[e.key])))
  }

  const sel = hours[selected]
  const valueText = sel
    ? [
        `${formatDayShort(sel.time, timeZone, locale)} ${formatHourShort(sel.time, timeZone, locale)}`,
        formatTemp(sel.temperature, units, locale),
        conditionLabel(sel.weatherCode, lang),
        `${t.rainChance} ${formatPercent(sel.precipProbability, locale)}`,
      ].join(', ')
    : ''

  // Tooltip posicionado em HTML para não ser cortado e manter texto nítido
  const tipX = x(selected)
  const tipLeft = Math.max(PAD_L, Math.min(width - PAD_R - 220, tipX - 24))
  const tipTop = 0

  return (
    <div
      className={s.scroller}
      ref={wrapRef}
      data-scrolls={scrolls || undefined}
      role="slider"
      tabIndex={0}
      aria-label={t.timelineSlider}
      aria-valuemin={0}
      aria-valuemax={n - 1}
      aria-valuenow={selected}
      aria-valuetext={valueText}
      onKeyDown={onKeyDown}
    >
      <div className={s.canvas} style={{ width }}>
        <svg
          width={width}
          height={HEIGHT}
          viewBox={`0 0 ${width} ${HEIGHT}`}
          className={s.svg}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => (pointer.current = null)}
          aria-hidden="true"
        >
          <defs>
            <linearGradient id={`${gradId}-line`} x1="0" x2="0" y1={y(hot)} y2={y(cold)} gradientUnits="userSpaceOnUse">
              {stops
                .slice()
                .sort((a, b) => a.offset - b.offset)
                .map((st) => (
                  <stop key={st.c} offset={st.offset} style={{ stopColor: `var(${st.token})` }} />
                ))}
            </linearGradient>
            <linearGradient id={`${gradId}-area`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" style={{ stopColor: 'var(--t-warm)', stopOpacity: 0.16 }} />
              <stop offset="1" style={{ stopColor: 'var(--t-warm)', stopOpacity: 0 }} />
            </linearGradient>
          </defs>

          {/* Noite (is_day da API) */}
          {hours.map((h, i) =>
            h.isDay === false ? (
              <rect key={`n${i}`} x={x(i) - step / 2} y={TEMP_TOP - 20} width={step + 0.5} height={HEIGHT - TEMP_TOP + 14} className={s.night} />
            ) : null,
          )}

          {/* Grade de temperatura */}
          {y.ticks(4).map((v) => (
            <g key={v}>
              <line x1={PAD_L} x2={width - PAD_R} y1={y(v)} y2={y(v)} className={s.grid} />
              <text x={PAD_L - 10} y={y(v) + 4} textAnchor="end" className={s.tick}>
                {formatTemp(v, units, locale)}
              </text>
            </g>
          ))}

          {/* Viradas de dia */}
          {midnights.map(({ i, h }) => (
            <g key={`d${i}`}>
              <line x1={x(i) - step / 2} x2={x(i) - step / 2} y1={TEMP_TOP - 20} y2={HEIGHT - 4} className={s.daySep} />
              <text x={x(i) - step / 2 + 6} y={TEMP_TOP - 8} className={s.dayLabel}>
                {formatDayShort(h.time, timeZone, locale)}
              </text>
            </g>
          ))}

          <g key={animationKey} className={s.reveal}>
            <path d={paths.area} fill={`url(#${gradId}-area)`} />
            <path d={paths.line} fill="none" stroke={`url(#${gradId}-line)`} strokeWidth={2.4} strokeLinecap="round" pathLength={1} className={s.curve} />
          </g>

          {/* Máxima e mínima */}
          {[
            { i: marks.max, label: t.max, dy: -12 },
            { i: marks.min, label: t.min, dy: 22 },
          ].map(({ i, label, dy }) =>
            i >= 0 && marks.max !== marks.min ? (
              <g key={label}>
                <circle cx={x(i)} cy={y(hours[i].temperature as number)} r={3} className={s.extreme} />
                <text x={x(i)} y={y(hours[i].temperature as number) + dy} textAnchor="middle" className={s.extremeLabel}>
                  {label} {formatTemp(hours[i].temperature, units, locale)}
                </text>
              </g>
            ) : null,
          )}

          {/* Eixo de horas */}
          {hours.map((h, i) =>
            i % labelEvery === 0 ? (
              <text key={`h${i}`} x={x(i)} y={AXIS_Y} textAnchor="middle" className={i === 0 ? s.tickNow : s.tick}>
                {i === 0 ? t.now : formatHourShort(h.time, timeZone, locale)}
              </text>
            ) : null,
          )}

          {/* Chuva: probabilidade (barra clara) e volume (barra cheia) */}
          <text x={PAD_L - 10} y={RAIN_TOP + 14} textAnchor="end" className={s.rowLabel}>
            {t.rainRow}
          </text>
          <line x1={PAD_L - step / 2} x2={width - PAD_R + step / 2} y1={RAIN_TOP + RAIN_H} y2={RAIN_TOP + RAIN_H} className={s.baseline} />
          {hours.map((h, i) => {
            const bw = Math.max(3, step * 0.56)
            const ph = h.precipProbability !== null ? (h.precipProbability / 100) * RAIN_H : 0
            const ah = h.precipitation ? Math.min(RAIN_H, (h.precipitation / mmMax) * RAIN_H) : 0
            return (
              <g key={`r${i}`}>
                {ph > 0 && <rect x={x(i) - bw / 2} y={RAIN_TOP + RAIN_H - ph} width={bw} height={ph} rx={1.5} className={s.prob} />}
                {ah > 0 && <rect x={x(i) - bw / 2} y={RAIN_TOP + RAIN_H - ah} width={bw} height={Math.max(1.5, ah)} rx={1.5} className={s.amount} />}
              </g>
            )
          })}

          {/* Vento: seta aponta para onde o vento vai */}
          <text x={PAD_L - 10} y={WIND_Y + 4} textAnchor="end" className={s.rowLabel}>
            {t.windRow}
          </text>
          {hours.map((h, i) =>
            i % windEvery === 0 ? (
              <g key={`w${i}`}>
                {h.windDirection !== null && (
                  <g transform={`translate(${x(i)},${WIND_Y}) rotate(${h.windDirection + 180})`}>
                    <path d="M0,-7 L0,7 M-3.5,2.5 L0,7 L3.5,2.5" className={s.arrow} />
                  </g>
                )}
                <text x={x(i)} y={WIND_Y + 22} textAnchor="middle" className={s.windValue}>
                  {h.windSpeed === null ? '—' : formatNumber(convertSpeed(h.windSpeed, units), locale)}
                </text>
              </g>
            ) : null,
          )}

          {/* Hora fixada para comparação */}
          {pinned !== null && pinned !== selected && hours[pinned] && (
            <g>
              <line x1={x(pinned)} x2={x(pinned)} y1={TEMP_TOP - 14} y2={HEIGHT - 6} className={s.pinned} />
              {hours[pinned].temperature !== null && <circle cx={x(pinned)} cy={y(hours[pinned].temperature as number)} r={4} className={s.pinnedDot} />}
            </g>
          )}

          {/* Agora */}
          <line x1={x(0)} x2={x(0)} y1={TEMP_TOP - 14} y2={HEIGHT - 6} className={s.nowLine} />

          {/* Seleção */}
          {sel && (
            <g className={s.selection}>
              <line x1={x(selected)} x2={x(selected)} y1={TIP_BAND - 4} y2={HEIGHT - 6} className={s.selLine} />
              {sel.temperature !== null && <circle cx={x(selected)} cy={y(sel.temperature)} r={6} className={s.selDot} />}
            </g>
          )}
        </svg>

        {sel && (
          <div className={s.tip} style={{ left: tipLeft, top: tipTop }} aria-hidden="true">
            <span className={s.tipTime}>
              {formatDayShort(sel.time, timeZone, locale)}, {formatHourShort(sel.time, timeZone, locale)}
            </span>
            <span className={`${s.tipMain} tabular`}>
              {formatTemp(sel.temperature, units, locale)} <i>{conditionLabel(sel.weatherCode, lang)}</i>
            </span>
            <span className={`${s.tipSub} tabular`}>
              {t.rainRow} {formatPercent(sel.precipProbability, locale)}
              {sel.precipitation ? `, ${formatPrecip(sel.precipitation, units, locale)}` : ''}
              {'  '}
              {t.windRow} {formatSpeed(sel.windSpeed, units, locale)} {compassPoint(sel.windDirection, lang)}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
