import { useSearchParams } from 'react-router'
import { overdueSessions, sortSessionsAsc, upcomingSessions } from '../../domain/selectors'
import { useStore } from '../../state/store'
import { SessionRow } from '../components/items'
import { ButtonLink, EmptyState, PageHeader, Section } from '../components/ui'

type Tab = 'geplant' | 'abgeschlossen' | 'abgesagt'

export function SessionsView() {
  const { data } = useStore()
  const [params, setParams] = useSearchParams()
  const tab = (params.get('ansicht') as Tab) || 'geplant'
  const counts = {
    geplant: data.sessions.filter((s) => s.status === 'geplant').length,
    abgeschlossen: data.sessions.filter((s) => s.status === 'abgeschlossen').length,
    abgesagt: data.sessions.filter((s) => s.status === 'abgesagt').length,
  }
  const tabs: { key: Tab; label: string }[] = [
    { key: 'geplant', label: 'Geplant' },
    { key: 'abgeschlossen', label: 'Abgeschlossen' },
    { key: 'abgesagt', label: 'Abgesagt' },
  ]
  const hasProjects = data.projects.some((p) => p.status !== 'archiviert')

  return (
    <>
      <PageHeader
        title="Sessions"
        intro="Jede Session gehört zu einem Projekt und hat ein klares Ziel."
        actions={
          hasProjects && (
            <ButtonLink to="/sessions/neu" variant="primary">
              + Session planen
            </ButtonLink>
          )
        }
      />
      <div role="group" aria-label="Session-Ansicht" className="mb-5 flex gap-1 overflow-x-auto border-b border-ink-700">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            aria-pressed={tab === t.key}
            onClick={() => setParams(t.key === 'geplant' ? {} : { ansicht: t.key }, { replace: true })}
            className={`-mb-px min-h-11 border-b-2 px-4 text-sm whitespace-nowrap ${
              tab === t.key ? 'border-gold-400 font-semibold text-text' : 'border-transparent text-muted hover:text-text'
            }`}
          >
            {t.label} <span className="text-faint">({counts[t.key]})</span>
          </button>
        ))}
      </div>

      {!hasProjects && data.sessions.length === 0 ? (
        <EmptyState
          title="Zuerst ein Projekt anlegen"
          text="Sessions gehören immer zu einem Projekt. Lege zuerst ein Projekt an."
          action={
            <ButtonLink to="/projekte/neu" variant="primary">
              + Projekt anlegen
            </ButtonLink>
          }
        />
      ) : tab === 'geplant' ? (
        <PlannedSessions />
      ) : (
        <SessionList tab={tab} />
      )}
    </>
  )
}

function PlannedSessions() {
  const { data } = useStore()
  const overdue = overdueSessions(data)
  const upcoming = upcomingSessions(data)
  if (overdue.length === 0 && upcoming.length === 0) {
    return (
      <EmptyState
        title="Keine Session geplant"
        text="Plane die nächste Session mit Ziel, Beteiligten und Vorbereitungsliste."
        action={<ButtonLink to="/sessions/neu">+ Session planen</ButtonLink>}
      />
    )
  }
  return (
    <>
      {overdue.length > 0 && (
        <Section title="Vergangen – noch abzuschließen">
          <ul className="space-y-2">
            {overdue.map((s) => (
              <SessionRow key={s.id} session={s} />
            ))}
          </ul>
        </Section>
      )}
      {upcoming.length > 0 && (
        <Section title="Anstehend">
          <ul className="space-y-2">
            {upcoming.map((s) => (
              <SessionRow key={s.id} session={s} />
            ))}
          </ul>
        </Section>
      )}
    </>
  )
}

function SessionList({ tab }: { tab: Exclude<Tab, 'geplant'> }) {
  const { data } = useStore()
  const list = sortSessionsAsc(data.sessions.filter((s) => s.status === tab)).reverse()
  if (list.length === 0) {
    return (
      <EmptyState
        title={tab === 'abgeschlossen' ? 'Noch keine abgeschlossenen Sessions' : 'Keine abgesagten Sessions'}
        text={
          tab === 'abgeschlossen'
            ? 'Nach einer Session hältst du dort Ergebnis und nächste Schritte fest – sie erscheint dann hier.'
            : 'Abgesagte Sessions bleiben zur Nachvollziehbarkeit hier sichtbar.'
        }
      />
    )
  }
  return (
    <ul className="space-y-2">
      {list.map((s) => (
        <SessionRow key={s.id} session={s} />
      ))}
    </ul>
  )
}
