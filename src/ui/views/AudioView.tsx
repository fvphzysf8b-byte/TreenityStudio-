import { Link } from 'react-router'
import { feedbackOf, versionsOf } from '../../domain/selectors'
import { formatDate } from '../../domain/util'
import { useStore } from '../../state/store'
import { ButtonLink, EmptyState, PageHeader, Section, Tag } from '../components/ui'

export function AudioView() {
  const { data } = useStore()
  const projects = data.projects
    .filter((p) => data.audioVersions.some((v) => v.projectId === p.id))
    .sort((a, b) => Number(a.status === 'archiviert') - Number(b.status === 'archiviert') || b.updatedAt.localeCompare(a.updatedAt))
  const hasProjects = data.projects.length > 0

  return (
    <>
      <PageHeader
        title="Audio-Versionen & Feedback"
        intro="Demos, Edits und Mixe verlinken und gemeinsam besprechen. Die Dateien selbst bleiben in Drive, Dropbox o. Ä."
        actions={
          hasProjects && (
            <ButtonLink to="/audio/neu" variant="primary">
              + Version verlinken
            </ButtonLink>
          )
        }
      />
      {projects.length === 0 ? (
        <EmptyState
          title="Noch keine Audio-Versionen"
          text={
            hasProjects
              ? 'Verlinke eine Version (z. B. „Mix 01“), um Feedback mit Zeitbezug zu sammeln.'
              : 'Lege zuerst ein Projekt an – Versionen gehören immer zu einem Projekt.'
          }
          action={
            hasProjects ? (
              <ButtonLink to="/audio/neu">+ Version verlinken</ButtonLink>
            ) : (
              <ButtonLink to="/projekte/neu" variant="primary">
                + Projekt anlegen
              </ButtonLink>
            )
          }
        />
      ) : (
        projects.map((p) => (
          <Section
            key={p.id}
            title={p.title + (p.status === 'archiviert' ? ' (archiviert)' : '')}
            action={
              <ButtonLink to={`/audio/neu?projekt=${p.id}`} size="sm">
                + Version
              </ButtonLink>
            }
          >
            <ul className="space-y-2">
              {versionsOf(data, p.id).map((v) => {
                const fb = feedbackOf(data, v.id).length
                return (
                  <li key={v.id} className="card relative flex flex-col gap-1 p-3 hover:border-forest-500 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <Link to={`/audio/${v.id}`} className="font-medium after:absolute after:inset-0 hover:underline">
                        {v.name}
                      </Link>
                      <p className="text-sm text-muted">
                        {formatDate(v.date)}
                        {v.changes && ` · ${v.changes.length > 80 ? v.changes.slice(0, 80) + '…' : v.changes}`}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      {v.isCurrent && <Tag>◉ Aktueller Arbeitsstand</Tag>}
                      <Tag>{fb === 1 ? '1 Feedback' : `${fb} Feedback`}</Tag>
                    </div>
                  </li>
                )
              })}
            </ul>
          </Section>
        ))
      )}
    </>
  )
}
