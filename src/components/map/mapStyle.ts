import type { Map as MapLibreMap } from 'maplibre-gl'
import { readToken } from '../../lib/color'

/** Estilo vetorial gratuito, sem chave. Atribuição exibida no mapa. */
export const BASE_STYLE_URL = 'https://tiles.openfreemap.org/styles/positron'

/**
 * Repinta o estilo base com os tokens do CLIMAS: o mapa vira um fundo discreto
 * para os dados, não o protagonista.
 */
export function paintBaseMap(map: MapLibreMap, root: Element) {
  const style = map.getStyle()
  if (!style?.layers) return
  const surface = readToken('--surface-0', root)
  const surface1 = readToken('--surface-1', root)
  const line = readToken('--line', root)
  const lineSoft = readToken('--line-soft', root)
  const muted = readToken('--muted', root)
  const faint = readToken('--faint', root)
  const isLight = root.getAttribute('data-resolved-theme') === 'light'
  const water = isLight ? '#d4e1ec' : '#0b1b2c'

  const set = (id: string, prop: string, value: unknown, layout = false) => {
    try {
      // As propriedades variam por tipo de camada; o try/catch absorve as que não se aplicam
      if (layout) (map.setLayoutProperty as (a: string, b: string, c: unknown) => void).call(map, id, prop, value)
      else (map.setPaintProperty as (a: string, b: string, c: unknown) => void).call(map, id, prop, value)
    } catch {
      // Propriedade não suportada por esta camada
    }
  }

  for (const layer of style.layers) {
    const id = layer.id
    const name = id.toLowerCase()
    switch (layer.type) {
      case 'background':
        set(id, 'background-color', surface)
        break
      case 'fill':
        if (name.includes('water')) set(id, 'fill-color', water)
        else if (name.includes('building')) set(id, 'fill-opacity', 0)
        else {
          set(id, 'fill-color', surface1)
          set(id, 'fill-opacity', 0.5)
        }
        set(id, 'fill-outline-color', 'rgba(0,0,0,0)')
        break
      case 'line':
        if (name.includes('water')) set(id, 'line-color', water)
        else if (name.includes('boundary') || name.includes('admin')) {
          set(id, 'line-color', faint)
          set(id, 'line-opacity', 0.6)
        } else if (name.includes('rail')) set(id, 'line-opacity', 0)
        else set(id, 'line-color', name.includes('motorway') || name.includes('trunk') ? line : lineSoft)
        break
      case 'symbol':
        set(id, 'text-color', muted)
        set(id, 'text-halo-color', surface)
        set(id, 'text-halo-width', 1.2)
        set(id, 'icon-opacity', 0)
        // Ruas e POIs competem com os dados; mantém só nomes de lugares e água
        if (!(name.includes('place') || name.includes('water') || name.includes('country') || name.includes('state'))) {
          set(id, 'visibility', 'none', true)
        }
        break
      default:
        break
    }
  }
}
