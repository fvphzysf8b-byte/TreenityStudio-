import { HashRouter, Route, Routes } from 'react-router'
import { StoreProvider } from './state/store'
import { Layout } from './ui/Layout'
import { AudioDetailView } from './ui/views/AudioDetailView'
import { AudioFormView } from './ui/views/AudioFormView'
import { AudioView } from './ui/views/AudioView'
import { DataView } from './ui/views/DataView'
import { NotFound } from './ui/views/NotFound'
import { OverviewView } from './ui/views/OverviewView'
import { ProjectDetailView } from './ui/views/ProjectDetailView'
import { ProjectFormView } from './ui/views/ProjectFormView'
import { ProjectsView } from './ui/views/ProjectsView'
import { SessionDetailView } from './ui/views/SessionDetailView'
import { SessionFormView } from './ui/views/SessionFormView'
import { SessionsView } from './ui/views/SessionsView'

export default function App() {
  return (
    <StoreProvider>
      {/* HashRouter: funktioniert ohne Server-Konfiguration, auch bei statischem Hosting. */}
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<OverviewView />} />
            <Route path="projekte" element={<ProjectsView />} />
            <Route path="projekte/neu" element={<ProjectFormView />} />
            <Route path="projekte/:id" element={<ProjectDetailView />} />
            <Route path="projekte/:id/bearbeiten" element={<ProjectFormView />} />
            <Route path="sessions" element={<SessionsView />} />
            <Route path="sessions/neu" element={<SessionFormView />} />
            <Route path="sessions/:id" element={<SessionDetailView />} />
            <Route path="sessions/:id/bearbeiten" element={<SessionFormView />} />
            <Route path="audio" element={<AudioView />} />
            <Route path="audio/neu" element={<AudioFormView />} />
            <Route path="audio/:id" element={<AudioDetailView />} />
            <Route path="audio/:id/bearbeiten" element={<AudioFormView />} />
            <Route path="daten" element={<DataView />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </HashRouter>
    </StoreProvider>
  )
}
