import { useMemo, useState } from 'react'
import type { TabId } from './types'
import { computeSchedule } from './lib/scheduler'
import { exportState, renameProject, replaceState, resetDemo, setUi, useProject } from './lib/store'
import { notify, useToasts, dismissToast } from './lib/toast'
import TopBar from './components/TopBar'
import StatsBar from './components/StatsBar'
import TasksTab from './components/TasksTab'
import GanttTab from './components/GanttTab'
import ResourcesTab from './components/ResourcesTab'
import CalendarTab from './components/CalendarTab'
import AnalysisTab from './components/AnalysisTab'
import TaskModal from './components/TaskModal'
import MemberModal from './components/MemberModal'

export type ModalState = { kind: 'task'; id: string | null } | { kind: 'member'; id: string | null } | null

export default function App() {
  const state = useProject()
  const sched = useMemo(() => computeSchedule(state.tasks, state.calendar), [state.tasks, state.calendar])
  const [modal, setModal] = useState<ModalState>(null)
  const toasts = useToasts()

  const openTask = (id: string | null) => setModal({ kind: 'task', id })
  const openMember = (id: string | null) => setModal({ kind: 'member', id })

  const handleImport = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        replaceState(JSON.parse(String(reader.result)))
        notify('Data proyek berhasil diimpor', 'ok')
      } catch {
        notify('Impor gagal: file tidak valid', 'err')
      }
    }
    reader.onerror = () => notify('Impor gagal: file tidak dapat dibaca', 'err')
    reader.readAsText(file)
  }

  const handleExport = () => {
    try {
      const blob = new Blob([exportState()], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'manajemen-proyek-gantt.json'
      a.click()
      URL.revokeObjectURL(url)
      notify('Data proyek diekspor (JSON)', 'ok')
    } catch {
      notify('Ekspor gagal', 'err')
    }
  }

  const handleReset = () => {
    if (!window.confirm('Muat ulang data contoh? Semua perubahan lokal akan hilang.')) return
    resetDemo()
    notify('Data contoh dimuat ulang', 'ok')
  }

  const tabs: { id: TabId; label: string }[] = [
    { id: 'tasks', label: '📋 Daftar Tugas' },
    { id: 'gantt', label: '📊 Gantt Chart' },
    { id: 'resources', label: '👥 Sumber Daya' },
    { id: 'calendar', label: '🗓️ Kalender' },
    { id: 'analysis', label: '📈 Analisis' },
  ]

  return (
    <>
      <TopBar
        tabs={tabs}
        active={state.ui.tab}
        onTab={(id) => setUi({ tab: id })}
        projectName={state.project.name}
        onRename={renameProject}
        onExport={handleExport}
        onImport={handleImport}
        onReset={handleReset}
      />

      <StatsBar state={state} sched={sched} />

      <main>
        {state.ui.tab === 'tasks' && <TasksTab state={state} sched={sched} onOpenTask={openTask} />}
        {state.ui.tab === 'gantt' && <GanttTab state={state} sched={sched} onOpenTask={openTask} />}
        {state.ui.tab === 'resources' && (
          <ResourcesTab state={state} sched={sched} onOpenMember={openMember} />
        )}
        {state.ui.tab === 'calendar' && <CalendarTab state={state} />}
        {state.ui.tab === 'analysis' && (
          <AnalysisTab state={state} sched={sched} onJumpGantt={() => setUi({ tab: 'gantt' })} />
        )}
      </main>

      {modal?.kind === 'task' && (
        <TaskModal state={state} sched={sched} taskId={modal.id} onClose={() => setModal(null)} />
      )}
      {modal?.kind === 'member' && (
        <MemberModal state={state} sched={sched} memberId={modal.id} onClose={() => setModal(null)} />
      )}

      <div className="toast-wrap">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`} onClick={() => dismissToast(t.id)}>
            {t.msg}
          </div>
        ))}
      </div>
    </>
  )
}
