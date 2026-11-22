/** Formularbausteine mit zugänglicher Fehleranzeige. */
import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from 'react'
import type { ID, Person } from '../../domain/types'

interface FieldProps {
  label: string
  error?: string
  hint?: ReactNode
  required?: boolean
  children: ReactElement<Record<string, unknown>>
  className?: string
}

/** Verbindet Label, Hinweis und Fehlermeldung per id/aria mit dem Eingabefeld. */
export function Field({ label, error, hint, required, children, className = '' }: FieldProps) {
  const id = useId()
  const hintId = `${id}-hint`
  const errId = `${id}-err`
  const describedBy = [hint ? hintId : null, error ? errId : null].filter(Boolean).join(' ') || undefined
  const control = isValidElement(children)
    ? cloneElement(children, {
        id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': describedBy,
        'aria-required': required || undefined,
      })
    : children
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-text">
        {label}
        {required ? (
          <span className="text-gold-300"> *<span className="sr-only"> (Pflichtfeld)</span></span>
        ) : (
          <span className="font-normal text-faint"> (optional)</span>
        )}
      </label>
      {control}
      {hint && (
        <p id={hintId} className="mt-1 text-xs text-faint">
          {hint}
        </p>
      )}
      {error && (
        <p id={errId} className="mt-1 text-sm text-danger">
          <span aria-hidden="true">⚠ </span>
          {error}
        </p>
      )}
    </div>
  )
}

/** Mehrfachauswahl von Personen als Checkbox-Gruppe. */
export function PersonPicker({
  legend,
  people,
  value,
  onChange,
  hint,
}: {
  legend: string
  people: Person[]
  value: ID[]
  onChange: (ids: ID[]) => void
  hint?: string
}) {
  return (
    <fieldset>
      <legend className="mb-1 text-sm font-medium text-text">
        {legend} <span className="font-normal text-faint">(optional)</span>
      </legend>
      {people.length === 0 ? (
        <p className="text-sm text-faint">Noch keine Personen angelegt. Personen verwaltest du unter „Daten“.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {people.map((p) => {
            const checked = value.includes(p.id)
            return (
              <label
                key={p.id}
                className={`flex min-h-10 cursor-pointer items-center gap-2 rounded-full border px-3 text-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-gold-400 ${
                  checked ? 'border-gold-400 bg-forest-800 text-text' : 'border-ink-600 text-muted hover:border-forest-500'
                }`}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={checked}
                  onChange={() => onChange(checked ? value.filter((x) => x !== p.id) : [...value, p.id])}
                />
                <span aria-hidden="true">{checked ? '✓' : '+'}</span>
                {p.name}
              </label>
            )
          })}
        </div>
      )}
      {hint && <p className="mt-1 text-xs text-faint">{hint}</p>}
    </fieldset>
  )
}

/** Fokussiert nach einer fehlgeschlagenen Validierung das erste fehlerhafte Feld. */
export function focusFirstError(form: HTMLFormElement | null) {
  requestAnimationFrame(() => {
    const el = form?.querySelector<HTMLElement>('[aria-invalid="true"]')
    el?.focus()
  })
}

export function FormActions({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-16 z-10 -mx-4 mt-6 flex flex-col-reverse gap-2 border-t border-ink-700 bg-ink-950/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:flex-row sm:justify-end sm:border-0 sm:bg-transparent sm:p-0">
      {children}
    </div>
  )
}
