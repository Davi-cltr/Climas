import { useLayoutEffect, useState } from 'react'

/**
 * Mede o elemento e reage a redimensionamentos (gráficos responsivos ao contêiner).
 * Devolve uma ref de callback: funciona mesmo quando o elemento só aparece depois do primeiro render.
 */
export function useSize<T extends HTMLElement>() {
  const [node, setNode] = useState<T | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })

  useLayoutEffect(() => {
    if (!node) return
    const update = () => {
      const r = node.getBoundingClientRect()
      const width = Math.round(r.width)
      const height = Math.round(r.height)
      setSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }))
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(node)
    return () => ro.disconnect()
  }, [node])

  return [setNode, size, node] as const
}
