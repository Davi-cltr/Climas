/** Ícones de traço fino desenhados para o CLIMAS (sem biblioteca externa). */

const PATHS = {
  search: 'M7 1.8a5.2 5.2 0 1 0 0 10.4A5.2 5.2 0 0 0 7 1.8ZM11 11l3.5 3.5',
  locate: 'M8 5a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM8 .5V3M8 13v2.5M.5 8H3M13 8h2.5',
  refresh: 'M13.5 6.5A5.6 5.6 0 0 0 3 4.6M2.5 9.5A5.6 5.6 0 0 0 13 11.4M13.6 2.2v4.3H9.3M2.4 13.8V9.5h4.3',
  star: 'M8 1.6l1.9 4 4.4.5-3.3 3 .9 4.3L8 11.2l-3.9 2.2.9-4.3-3.3-3 4.4-.5L8 1.6Z',
  close: 'M3.5 3.5l9 9M12.5 3.5l-9 9',
  settings: 'M2 4.5h7M12 4.5h2M2 11.5h2M7 11.5h7M10.5 2.8v3.4M5.5 9.8v3.4',
  pin: 'M5.5 2h5l-.8 4.2 2.3 2.3H4l2.3-2.3L5.5 2ZM8 8.5V14',
  table: 'M2 3h12v10H2zM2 6.5h12M2 10h12M6 3v10',
  offline: 'M1.5 1.5l13 13M3 6.2a8 8 0 0 1 3-1.6M10.2 4.7A8 8 0 0 1 13 6.2M5 8.7a5 5 0 0 1 2-1M9.6 7.9 11 8.7M8 12.4h0',
  alert: 'M8 1.8 15 14H1L8 1.8ZM8 6v4M8 11.8v.2',
  chevron: 'M4 6l4 4 4-4',
} as const

export type IconName = keyof typeof PATHS

export function Icon({ name, size = 16, filled = false }: { name: IconName; size?: number; filled?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path
        d={PATHS[name]}
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
