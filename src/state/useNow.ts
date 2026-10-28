import { useEffect, useState } from 'react'

/** Relógio que avança a cada minuto (alinhado ao minuto cheio). */
export function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const tick = () => {
      setNow(Date.now())
      timer = setTimeout(tick, intervalMs - (Date.now() % intervalMs))
    }
    timer = setTimeout(tick, intervalMs - (Date.now() % intervalMs))
    return () => clearTimeout(timer)
  }, [intervalMs])
  return now
}
