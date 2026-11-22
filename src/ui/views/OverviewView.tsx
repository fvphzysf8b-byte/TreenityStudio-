import { addExamples } from '../../domain/seed'
import { focusProjects, openTasksOverview, otherActiveProjects, overdueSessions, upcomingSessions } from '../../domain/selectors'
import { MAX_PINNED } from '../../domain/operations'
import { useStore } from '../../state/store'
import { ProjectCard, SessionRow, TaskItem } from '../components/items'
import { Button, ButtonLink, EmptyState, PageHeader, Section } from '../components/ui'
import { Link } from 'react-router'

export function OverviewView() {
  const { data, apply } = useStore()
  const focus = focusProjects(data)
  const others = otherActiveProjects(data).slice(0, 6)
  const upcoming = upcomingSessions(data).slice(0, 5)
  const overdue = overdueSessions(data)
  const tasks = openTasksOverview(data)
  const shownTasks = tasks.slice(0, 10)

  const actions = (
    <>
      <ButtonLink to="/projekte/neu" variant="primary">
        + Projekt anlegen
      </ButtonLink>
      <ButtonLink to="/sessions/neu">+ Session planen</ButtonLink>
    </>
  )

  if (data.projects.length === 0) {
    return (
      <>
        <PageHeader title="Studio-Übersicht" intro="Woran arbeiten wir gerade, und was brauchen wir für die nächste Session?" />
        <EmptyState
          title="Willkommen im TreenityStudio"
          text="Hier organisierst du Musik-, Recording- und Podcastprojekte: Projekt anlegen → Session vorbereiten → Ergebnis festhalten → Versionen besprechen → nächste Schritte. Leg dein erstes Projekt an oder schau dir zuerst klar markierte Beispieldaten an."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <ButtonLink to="/projekte/neu" variant="primary">
                + Erstes Projekt anlegen
              </ButtonLink>
              <Button onClick={() => apply(addExamples, { success: 'Beispieldaten geladen. Entfernen unter „Daten“.' })}>
                Beispieldaten ansehen
              </Button>
            </div>
          }
        />
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Studio-Übersicht"
        intro="Woran arbeiten wir gerade, und was brauchen wir für die nächste Session?"
        actions={actions}
      />

      {overdue.length > 0 && (
        <Section title="Noch abzuschließen">
          <p className="mb-2 text-sm text-muted">
            Diese Sessions liegen in der Vergangenheit. Halte das Ergebnis fest oder markiere sie als abgesagt.
          </p>
          <ul className="space-y-2">
            {overdue.map((s) => (
              <SessionRow key={s.id} session={s} />
            ))}
          </ul>
        </Section>
      )}

      <Section title={`Fokusprojekte (${focus.length}/${MAX_PINNED})`}>
        {focus.length === 0 ? (
          <EmptyState
            title="Noch kein Fokus gesetzt"
            text={`Hefte bis zu ${MAX_PINNED} Projekte mit „☆ Fokus“ an, damit sie hier oben stehen.`}
            action={<ButtonLink to="/projekte">Zu den Projekten</ButtonLink>}
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-3">
            {focus.map((p) => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </div>
        )}
      </Section>

      <div className="grid gap-x-8 lg:grid-cols-2">
        <Section title="Nächste Sessions" action={<Link to="/sessions" className="link text-sm">Alle Sessions</Link>}>
          {upcoming.length === 0 ? (
            <EmptyState
              title="Keine Session geplant"
              text="Plane die nächste Session mit einem klaren Ziel und einer kurzen Vorbereitungsliste."
              action={<ButtonLink to="/sessions/neu">+ Session planen</ButtonLink>}
            />
          ) : (
            <ul className="space-y-2">
              {upcoming.map((s) => (
                <SessionRow key={s.id} session={s} />
              ))}
            </ul>
          )}
        </Section>

        <Section title="Offene nächste Schritte">
          {tasks.length === 0 ? (
            <EmptyState
              title="Keine offenen Schritte"
              text="Lege in einem Projekt die nächste konkrete Handlung fest – sie erscheint dann hier."
            />
          ) : (
            <>
              <ul className="space-y-2">
                {shownTasks.map(({ task, project, isNext }) => (
                  <TaskItem key={task.id} task={task} isNext={isNext} projectLabel={{ id: project.id, title: project.title }} />
                ))}
              </ul>
              {tasks.length > shownTasks.length && (
                <p className="mt-2 text-sm text-faint">
                  + {tasks.length - shownTasks.length} weitere offene Schritte in den Projekten.
                </p>
              )}
            </>
          )}
        </Section>
      </div>

      {others.length > 0 && (
        <Section title="Weitere aktive Projekte" action={<Link to="/projekte" className="link text-sm">Alle Projekte</Link>}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {others.map((p) => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </div>
        </Section>
      )}
    </>
  )
}
