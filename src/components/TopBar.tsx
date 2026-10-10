import { useRef } from 'react'
import type { TabId } from '../types'

interface Props {
  tabs: { id: TabId; label: string }[]
  active: TabId
  onTab: (id: TabId) => void
  projectName: string
  onRename: (name: string) => void
  onExport: () => void
  onImport: (file: File) => void
  onReset: () => void
}

export default function TopBar({ tabs, active, onTab, projectName, onRename, onExport, onImport, onReset }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)

  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark">◱</span>
        <span>
          Manajemen Proyek <b>Gantt</b>
        </span>
      </div>

      <nav className="tabs">
        {tabs.map((t) => (
          <button
            key={t.id}
            className={`tab${active === t.id ? ' active' : ''}`}
            onClick={() => onTab(t.id)}
            type="button"
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="top-actions">
        <input
          className="project-name"
          title="Nama proyek"
          aria-label="Nama proyek"
          value={projectName}
          onChange={(e) => onRename(e.target.value || 'Proyek Tanpa Nama')}
        />
        <button className="btn ghost small" type="button" title="Ekspor data proyek (JSON)" onClick={onExport}>
          Ekspor
        </button>
        <button
          className="btn ghost small"
          type="button"
          title="Impor data proyek (JSON)"
          onClick={() => fileRef.current?.click()}
        >
          Impor
        </button>
        <button className="btn ghost small" type="button" title="Muat ulang data contoh" onClick={onReset}>
          Reset
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) onImport(f)
            e.target.value = ''
          }}
        />
      </div>
    </header>
  )
}
