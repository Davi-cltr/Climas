import { describe, expect, it } from 'vitest'
import { makeGridResponse } from '../test/fixtures'
import { gridCoordinates, normalizeGrid } from './api/grid'
import { bilinear, gridToLatLon, latLonToGrid, niceStep, thresholds, upsample, windComponents, windField } from './field'

describe('campo interpolado', () => {
  const v = [0, 10, 20, 30] // 2×2

  it('interpola bilinearmente e respeita os pontos reais', () => {
    expect(bilinear(v, 2, 2, 0, 0)).toBe(0)
    expect(bilinear(v, 2, 2, 1, 1)).toBe(30)
    expect(bilinear(v, 2, 2, 0.5, 0.5)).toBe(15)
  })

  it('ignora cantos nulos em vez de tratá-los como zero', () => {
    expect(bilinear([null, 10, 10, 10], 2, 2, 0.5, 0.5)).toBe(10)
    expect(Number.isNaN(bilinear([null, null, null, null], 2, 2, 0.5, 0.5))).toBe(true)
  })

  it('reamostra preservando dimensões', () => {
    const { w, h, data } = upsample(v, 2, 2, 4)
    expect([w, h]).toEqual([5, 5])
    expect(data[0]).toBe(0)
    expect(data[24]).toBe(30)
  })

  it('converte entre coordenadas geográficas e posição na grade', () => {
    const { latitudes, longitudes } = gridCoordinates(-23.5, -46.6)
    const g = { latitudes, longitudes, rows: 7, cols: 9 }
    const pos = latLonToGrid(g, -23.5, -46.6)
    expect(pos.r).toBeCloseTo(3)
    expect(pos.c).toBeCloseTo(4)
    expect(pos.inside).toBe(true)
    const back = gridToLatLon(g, pos.r, pos.c)
    expect(back.lat).toBeCloseTo(-23.5)
    expect(latLonToGrid(g, 10, 10).inside).toBe(false)
  })
})

describe('vento', () => {
  it('vento de norte (0°) sopra para o sul', () => {
    const w = windComponents(10, 0)
    expect(w.u).toBeCloseTo(0)
    expect(w.v).toBeCloseTo(-10)
  })

  it('vento de oeste (270°) sopra para leste', () => {
    const w = windComponents(10, 270)
    expect(w.u).toBeCloseTo(10)
    expect(w.v).toBeCloseTo(0)
  })

  it('gera componentes para cada ponto da grade', () => {
    const { latitudes, longitudes } = gridCoordinates(-23.5, -46.6)
    const g = normalizeGrid(makeGridResponse(latitudes, longitudes), latitudes, longitudes)
    const f = windField(g, 0)
    expect(f.u).toHaveLength(63)
    expect(f.u.every((x) => x !== null)).toBe(true)
  })
})

describe('isolinhas', () => {
  it('gera limiares redondos dentro do intervalo', () => {
    expect(thresholds(17.3, 22.1, 1)).toEqual([18, 19, 20, 21, 22])
    expect(niceStep(4, [0.5, 1, 2, 5])).toBe(0.5)
    expect(niceStep(30, [0.5, 1, 2, 5])).toBe(5)
  })
})
