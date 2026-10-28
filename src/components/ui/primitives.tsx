import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react'
import { Icon, type IconName } from './Icon'
import s from './ui.module.css'

const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(' ')

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: IconName
  iconFilled?: boolean
  variant?: 'outline' | 'quiet'
  size?: 'md' | 'sm'
  /** Botão só com ícone: exige `label` para leitores de tela. */
  label?: string
  busy?: boolean
  ref?: Ref<HTMLButtonElement>
}

export function Button({ icon, iconFilled, variant = 'outline', size = 'md', label, busy, children, className, ref, ...rest }: ButtonProps) {
  const iconOnly = !children
  return (
    <button
      ref={ref}
      type="button"
      aria-label={iconOnly ? label : undefined}
      title={iconOnly ? label : undefined}
      aria-busy={busy || undefined}
      className={cx(s.button, variant === 'quiet' && s.quiet, size === 'sm' && s.small, iconOnly && s.iconOnly, busy && s.spin, className)}
      {...rest}
    >
      {icon && <Icon name={icon} filled={iconFilled} />}
      {children}
    </button>
  )
}

interface SegmentedProps<T extends string> {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  className?: string
}

/** Grupo de opções exclusivas com navegação por setas (padrão radiogroup). */
export function Segmented<T extends string>({ label, value, options, onChange, className }: SegmentedProps<T>) {
  const onKeyDown = (e: React.KeyboardEvent) => {
    const i = options.findIndex((o) => o.value === value)
    let next = i
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1) % options.length
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (i - 1 + options.length) % options.length
    else return
    e.preventDefault()
    onChange(options[next].value)
    const group = e.currentTarget as HTMLElement
    requestAnimationFrame(() => (group.querySelector('[aria-checked="true"]') as HTMLElement | null)?.focus())
  }
  return (
    <div role="radiogroup" aria-label={label} className={cx(s.segmented, className)} onKeyDown={onKeyDown}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          tabIndex={o.value === value ? 0 : -1}
          className={s.segment}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

interface NoticeProps {
  tone?: 'warning' | 'danger' | 'info'
  icon?: IconName
  children: ReactNode
  actions?: ReactNode
  live?: boolean
}

export function Notice({ tone = 'warning', icon = 'alert', children, actions, live = true }: NoticeProps) {
  return (
    <div className={s.notice} data-tone={tone} role={live ? (tone === 'danger' ? 'alert' : 'status') : undefined}>
      <Icon name={icon} />
      <div className={s.noticeBody}>{children}</div>
      {actions && <div className={s.noticeActions}>{actions}</div>}
    </div>
  )
}

export function PanelTitle({ title, context, id }: { title: string; context?: string; id?: string }) {
  return (
    <h2 className={s.panelTitle} id={id}>
      {title}
      {context && <span>{context}</span>}
    </h2>
  )
}
