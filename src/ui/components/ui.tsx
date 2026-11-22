/** Grundlegende, wiederverwendbare UI-Bausteine. */
import { useEffect, useId, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router'
import {
  PROJECT_STATUS_LABEL,
  PROJECT_STATUS_SYMBOL,
  SESSION_STATUS_LABEL,
  SESSION_STATUS_SYMBOL,
} from '../../domain/labels'
import type { ProjectStatus, SessionStatus } from '../../domain/types'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

const variants: Record<Variant, string> = {
  primary: 'bg-gold-400 text-ink-950 hover:bg-gold-300 font-semibold',
  secondary: 'border border-ink-600 bg-ink-850 text-text hover:border-forest-500 hover:bg-ink-800',
  ghost: 'text-muted hover:text-text hover:bg-ink-800',
  danger: 'border border-danger/60 text-danger hover:bg-danger-bg',
}

export function btnClass(variant: Variant = 'secondary', size: 'sm' | 'md' = 'md') {
  return `inline-flex items-center justify-center gap-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
    size === 'sm' ? 'min-h-9 px-3 text-sm' : 'min-h-11 px-4 text-sm'
  } ${variants[variant]}`
}

export function Button({
  variant = 'secondary',
  size = 'md',
  className = '',
  type = 'button',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' }) {
  return <button type={type} className={`${btnClass(variant, size)} ${className}`} {...rest} />
}

export function ButtonLink({
  variant = 'secondary',
  size = 'md',
  className = '',
  ...rest
}: LinkProps & { variant?: Variant; size?: 'sm' | 'md' }) {
  return <Link className={`${btnClass(variant, size)} ${className}`} {...rest} />
}

export function PageHeader({ title, intro, actions }: { title: string; intro?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-text sm:text-3xl">{title}</h1>
        {intro && <p className="mt-1 max-w-2xl text-muted">{intro}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  )
}

export function Section({
  title,
  action,
  children,
  id,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
  id?: string
}) {
  const hid = useId()
  return (
    <section aria-labelledby={hid} id={id} className="mb-8 scroll-mt-20">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id={hid} className="text-sm font-semibold tracking-wider text-gold-300 uppercase">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  )
}

export function EmptyState({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return (
    <div className="card border-dashed p-6 text-center">
      <p className="font-medium text-text">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted">{text}</p>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  )
}

const projectStatusTone: Record<ProjectStatus, string> = {
  idee: 'border-ink-600 text-muted',
  vorbereitung: 'border-forest-500/60 text-forest-300',
  aufnahme: 'border-gold-500/70 text-gold-300',
  bearbeitung: 'border-forest-500/60 text-forest-300',
  bereit: 'border-gold-500/70 text-gold-300',
  veroeffentlicht: 'border-forest-300/60 text-forest-300',
  archiviert: 'border-ink-600 text-faint',
}

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${projectStatusTone[status]}`}>
      <span aria-hidden="true">{PROJECT_STATUS_SYMBOL[status]}</span>
      {PROJECT_STATUS_LABEL[status]}
    </span>
  )
}

const sessionTone: Record<SessionStatus, string> = {
  geplant: 'border-gold-500/70 text-gold-300',
  abgeschlossen: 'border-forest-500/60 text-forest-300',
  abgesagt: 'border-ink-600 text-faint line-through decoration-faint/60',
}

export function SessionStatusBadge({ status }: { status: SessionStatus }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${sessionTone[status]}`}>
      <span aria-hidden="true">{SESSION_STATUS_SYMBOL[status]}</span>
      <span className="no-underline">{SESSION_STATUS_LABEL[status]}</span>
    </span>
  )
}

export function Tag({ children }: { children: ReactNode }) {
  return <span className="inline-flex rounded-md bg-ink-800 px-2 py-0.5 text-xs text-muted">{children}</span>
}

/** Bestätigungsdialog auf Basis von <dialog> (Fokusfalle und Escape inklusive). */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  danger = true,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  children: ReactNode
  confirmLabel: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault()
        onCancel()
      }}
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-xl border border-ink-600 bg-ink-900 p-0 text-text shadow-2xl"
    >
      <div className="p-5">
        <h2 id={titleId} className="text-lg font-semibold">
          {title}
        </h2>
        <div className="mt-2 space-y-2 text-sm text-muted">{children}</div>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button onClick={onCancel} autoFocus>
            Abbrechen
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`card p-4 ${className}`}>{children}</div>
}
