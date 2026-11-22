import { useSearchParams } from 'react-router'
import { PROJECT_STATUS_LABEL, PROJECT_TYPE_LABEL } from '../../domain/labels'
import { PROJECT_STATUSES, PROJECT_TYPES, type Project } from '../../domain/types'
import { useStore } from '../../state/store'
import { ProjectCard } from '../components/items'
import { ButtonLink, EmptyState, PageHeader } from '../components/ui'

type Tab = 'aktiv' | 'ideen' | 'archiv'

const TABS: { key: Tab; label: string; hint: string }[] = [
  { key: 'aktiv', label: 'Laufend', hint: 'Projekte in Vorbereitung, Aufnahme, Bearbeitung, bereit oder veröffentlicht.' },
  { key: 'ideen', label: 'Ideen', hint: 'Gesammelte Ideen, an denen noch nicht aktiv gearbeitet wird.' },
  { key: 'archiv', label: 'Archiv', hint: 'Archivierte Projekte – alle Daten bleiben erhalten.' },
]

function inTab(p: Project, tab: Tab) {
  if (tab === 'ideen') return p.status === 'idee'
  if (tab === 'archiv') return p.status === 'archiviert'
  return p.status !== 'idee' && p.status !== 'archiviert'
}

export function ProjectsView() {
  const { data } = useStore()
  const [params, setParams] = useSearchParams()
  const tab = (params.get('ansicht') as Tab) || 'aktiv'
  const type = params.get('typ') ?? ''
  const status = params.get('status') ?? ''
  const person = params.get('person') ?? ''

  function set(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key === 'ansicht') next.delete('status')
    setParams(next, { replace: true })
  }

  const memberSet = person
    ? new Set(data.projectMembers.filter((m) => m.personId === person).map((m) => m.projectId))
    : null

  const list = data.projects
    .filter((p) => inTab(p, tab))
    .filter((p) => !type || p.type === type)
    .filter((p) => !status || p.status === status)
    .filter((p) => !memberSet || memberSet.has(p.id))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt))

  const counts = Object.fromEntries(TABS.map((t) => [t.key, data.projects.filter((p) => inTab(p, t.key)).length]))
  const statusOptions = PROJECT_STATUSES.filter((s) =>
    tab === 'aktiv' ? s !== 'idee' && s !== 'archiviert' : false,
  )
  const filtered = Boolean(type || status || person)

  return (
    <>
      <PageHeader
        title="Projekte"
        intro="Alle Musik-, Podcast-, Live- und Soundscape-Projekte."
        actions={
          <ButtonLink to="/projekte/neu" variant="primary">
            + Projekt anlegen
          </ButtonLink>
        }
      />

      <div role="group" aria-label="Projektansicht" className="mb-4 flex gap-1 overflow-x-auto border-b border-ink-700">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            aria-pressed={tab === t.key}
            onClick={() => set('ansicht', t.key === 'aktiv' ? '' : t.key)}
            className={`-mb-px min-h-11 border-b-2 px-4 text-sm whitespace-nowrap ${
              tab === t.key ? 'border-gold-400 font-semibold text-text' : 'border-transparent text-muted hover:text-text'
            }`}
          >
            {t.label} <span className="text-faint">({counts[t.key]})</span>
          </button>
        ))}
      </div>
      <p className="mb-4 text-sm text-faint">{TABS.find((t) => t.key === tab)?.hint}</p>

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <label className="text-sm">
          <span className="mb-1 block text-muted">Typ</span>
          <select className="input" value={type} onChange={(e) => set('typ', e.target.value)}>
            <option value="">Alle Typen</option>
            {PROJECT_TYPES.map((t) => (
              <option key={t} value={t}>
                {PROJECT_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </label>
        {tab === 'aktiv' && (
          <label className="text-sm">
            <span className="mb-1 block text-muted">Status</span>
            <select className="input" value={status} onChange={(e) => set('status', e.target.value)}>
              <option value="">Alle Status</option>
              {statusOptions.map((s) => (
                <option key={s} value={s}>
                  {PROJECT_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="text-sm">
          <span className="mb-1 block text-muted">Beteiligte</span>
          <select className="input" value={person} onChange={(e) => set('person', e.target.value)}>
            <option value="">Alle Personen</option>
            {data.people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="sr-only" aria-live="polite">
        {list.length} Projekte angezeigt
      </p>

      {list.length === 0 ? (
        filtered ? (
          <EmptyState
            title="Keine Treffer"
            text="Mit diesen Filtern gibt es keine Projekte."
            action={
              <button type="button" className="link" onClick={() => setParams(tab === 'aktiv' ? {} : { ansicht: tab }, { replace: true })}>
                Filter zurücksetzen
              </button>
            }
          />
        ) : tab === 'archiv' ? (
          <EmptyState title="Archiv ist leer" text="Archivierte Projekte erscheinen hier. Ihre Sessions, Versionen und Notizen bleiben erhalten." />
        ) : tab === 'ideen' ? (
          <EmptyState
            title="Noch keine Ideen gesammelt"
            text="Lege ein Projekt mit dem Status „Idee“ an, um es hier getrennt von laufenden Projekten zu sammeln."
            action={<ButtonLink to="/projekte/neu?status=idee">+ Idee festhalten</ButtonLink>}
          />
        ) : (
          <EmptyState
            title="Keine laufenden Projekte"
            text="Lege ein Projekt an, um Sessions zu planen und Versionen zu besprechen."
            action={
              <ButtonLink to="/projekte/neu" variant="primary">
                + Projekt anlegen
              </ButtonLink>
            }
          />
        )
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((p) => (
            <ProjectCard key={p.id} project={p} compact={tab === 'archiv'} />
          ))}
        </div>
      )}
    </>
  )
}
