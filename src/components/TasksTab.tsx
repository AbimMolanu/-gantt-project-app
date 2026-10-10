import { useMemo } from 'react'
import type { ProjectState } from '../types'
import { priorityOf } from '../types'
import type { Schedule } from '../lib/scheduler'
import { buildRows } from '../lib/rows'
import { childrenOf, findTask } from '../lib/tree'
import { fmtDate, fmtShort } from '../lib/calendar'
import { deleteTask, setUi } from '../lib/store'
import { notify } from '../lib/toast'
import { avatarColor, initials, withAlpha } from '../lib/format'

interface Props {
  state: ProjectState
  sched: Schedule
  onOpenTask: (id: string | null) => void
}

export default function TasksTab({ state, sched, onOpenTask }: Props) {
  const rows = useMemo(() => buildRows(state), [state])

  const expandAll = () => setUi({ collapsed: {} })
  const collapseAll = () => {
    const collapsed: Record<string, boolean> = {}
    state.tasks.forEach((t) => {
      if (childrenOf(state.tasks, t.id).length) collapsed[t.id] = true
    })
    setUi({ collapsed })
  }

  const removeTask = (id: string, name: string) => {
    const kids = childrenOf(state.tasks, id).length
    const msg = kids
      ? `Hapus tugas "${name}" beserta ${kids} sub-tugasnya?`
      : `Hapus tugas "${name}"?`
    if (!window.confirm(msg)) return
    const n = deleteTask(id)
    notify(`${n} tugas dihapus`, 'ok')
  }

  return (
    <section>
      <div className="toolbar">
        <div className="toolbar-left">
          <input
            type="search"
            className="search"
            placeholder="Cari tugas…"
            value={state.ui.search}
            onChange={(e) => setUi({ search: e.target.value })}
          />
        </div>
        <div className="toolbar-right">
          <button className="btn ghost" type="button" onClick={expandAll}>
            Buka Semua
          </button>
          <button className="btn ghost" type="button" onClick={collapseAll}>
            Tutup Semua
          </button>
          <button className="btn primary" type="button" onClick={() => onOpenTask(null)}>
            + Tugas Baru
          </button>
        </div>
      </div>

      <div className="card table-card">
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th className="col-name">Tugas</th>
                <th>Mulai</th>
                <th>Selesai</th>
                <th className="num">Durasi</th>
                <th>Prioritas</th>
                <th>Pendahulu</th>
                <th>Alokasi Anggota</th>
                <th className="col-act">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const t = row.task
                const s = sched.sched.get(t.id)
                const prio = priorityOf(t.priority)
                const collapsed = !!state.ui.collapsed[t.id]
                const cls = [
                  'task-row',
                  row.summary ? 'summary-row' : '',
                  s?.critical ? 'critical-row' : '',
                ]
                  .filter(Boolean)
                  .join(' ')
                return (
                  <tr key={t.id} className={cls} onClick={() => onOpenTask(t.id)}>
                    <td>
                      <div className="name-cell" style={{ paddingLeft: row.depth * 18 }}>
                        {row.summary ? (
                          <button
                            type="button"
                            className="chev"
                            title="Buka/tutup sub-tugas"
                            onClick={(e) => {
                              e.stopPropagation()
                              const next = { ...state.ui.collapsed }
                              if (next[t.id]) delete next[t.id]
                              else next[t.id] = true
                              setUi({ collapsed: next })
                            }}
                          >
                            {collapsed ? '▶' : '▼'}
                          </button>
                        ) : (
                          <button type="button" className="chev placeholder" tabIndex={-1} aria-hidden>
                            •
                          </button>
                        )}
                        <i className="dot" style={{ background: t.color || prio.color }} />
                        <span className="t-name" title={t.name}>
                          {t.name}
                        </span>
                        {row.summary && <span className="badge-sub">ringkasan</span>}
                        {s?.critical && (
                          <span className="crit-star" title="Jalur kritis">
                            ★
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="date-cell" title={fmtDate(s?.es ?? t.start)}>
                      {fmtShort(s?.es ?? t.start)}
                    </td>
                    <td className="date-cell" title={fmtDate(s?.ef ?? null)}>
                      {fmtShort(s?.ef ?? null)}
                    </td>
                    <td className="num dur">{s ? `${s.dur} hr` : '—'}</td>
                    <td>
                      <span
                        className="prio"
                        style={{ background: withAlpha(prio.color, 0.15), color: prio.color }}
                      >
                        {prio.label}
                      </span>
                    </td>
                    <td>
                      {t.preds.length === 0 ? (
                        <span className="chip none">—</span>
                      ) : (
                        t.preds.map((p, i) => {
                          const pt = findTask(state.tasks, p.taskId)
                          return (
                            <span className="chip" key={`${p.taskId}-${i}`} title={`${p.type} + ${p.lag} hari`}>
                              {pt ? pt.name : '?'} ({p.type}
                              {p.lag > 0 ? `+${p.lag}` : ''})
                            </span>
                          )
                        })
                      )}
                    </td>
                    <td>
                      <div className="avatars">
                        {t.members.slice(0, 4).map((mid) => {
                          const m = state.members.find((x) => x.id === mid)
                          if (!m) return null
                          return (
                            <span
                              className="avatar"
                              key={mid}
                              title={`${m.name} — ${m.role}`}
                              style={{ background: avatarColor(m.id) }}
                            >
                              {initials(m.name)}
                            </span>
                          )
                        })}
                        {t.members.length > 4 && (
                          <span className="avatar more">+{t.members.length - 4}</span>
                        )}
                        {t.members.length === 0 && <span className="chip none">—</span>}
                      </div>
                    </td>
                    <td className="col-act" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="row-btn"
                        title="Edit"
                        onClick={() => onOpenTask(t.id)}
                      >
                        ✎
                      </button>
                      <button
                        type="button"
                        className="row-btn del"
                        title="Hapus"
                        onClick={() => removeTask(t.id, t.name)}
                      >
                        🗑
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {rows.length === 0 && (
          <div className="empty">
            <p>
              {state.tasks.length === 0
                ? 'Belum ada tugas.'
                : 'Tidak ada tugas yang cocok dengan pencarian.'}
            </p>
            {state.tasks.length === 0 && (
              <button className="btn primary" type="button" onClick={() => onOpenTask(null)}>
                + Tambah Tugas Pertama
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
