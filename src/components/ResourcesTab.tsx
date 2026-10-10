import { useMemo } from 'react'
import type { ProjectState } from '../types'
import type { Schedule } from '../lib/scheduler'
import { deleteMember } from '../lib/store'
import { notify } from '../lib/toast'
import { dailyRate, memberMetrics } from '../lib/metrics'
import { avatarColor, fmtCompact, fmtRp, initials } from '../lib/format'
import { buildRows } from '../lib/rows'
import { findTask } from '../lib/tree'

interface Props {
  state: ProjectState
  sched: Schedule
  onOpenMember: (id: string | null) => void
}

export default function ResourcesTab({ state, sched, onOpenMember }: Props) {
  const metrics = useMemo(() => memberMetrics(state.members, state.tasks, sched), [state, sched])
  const rows = useMemo(() => buildRows(state), [state])
  const maxDays = Math.max(1, ...Array.from(metrics.values()).map((m) => m.days))

  const removeMember = (id: string, name: string) => {
    if (!window.confirm(`Hapus anggota "${name}"? Alokasinya ikut dihapus dari tugas.`)) return
    deleteMember(id)
    notify(`Anggota "${name}" dihapus`, 'ok')
  }

  return (
    <section>
      <div className="toolbar">
        <div className="toolbar-left">
          <h2 className="view-title">Anggota Tim</h2>
        </div>
        <div className="toolbar-right">
          <button className="btn primary" type="button" onClick={() => onOpenMember(null)}>
            + Tambah Anggota
          </button>
        </div>
      </div>

      <div className="card table-card">
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th className="col-name">Nama</th>
                <th>Email</th>
                <th>Peran</th>
                <th className="num">Gaji / Bulan</th>
                <th className="num">≈ / Hari</th>
                <th className="num">Beban (hari kerja)</th>
                <th className="num">Estimasi Biaya</th>
                <th className="col-act">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {state.members.map((m) => {
                const agg = metrics.get(m.id)
                return (
                  <tr key={m.id} className="task-row" onClick={() => onOpenMember(m.id)}>
                    <td>
                      <div className="name-cell">
                        <span className="avatar" style={{ background: avatarColor(m.id) }}>
                          {initials(m.name)}
                        </span>
                        <span className="t-name">{m.name}</span>
                      </div>
                    </td>
                    <td className="date-cell">{m.email}</td>
                    <td>
                      <span className="chip">{m.role || '—'}</span>
                    </td>
                    <td className="num date-cell">{fmtRp(m.salary)}</td>
                    <td className="num date-cell">{fmtRp(dailyRate(m))}</td>
                    <td className="num dur">{agg?.days ?? 0} hr</td>
                    <td className="num dur">{fmtRp(agg?.cost ?? 0)}</td>
                    <td className="col-act" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="row-btn"
                        title="Edit"
                        onClick={() => onOpenMember(m.id)}
                      >
                        ✎
                      </button>
                      <button
                        type="button"
                        className="row-btn del"
                        title="Hapus"
                        onClick={() => removeMember(m.id, m.name)}
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
        {state.members.length === 0 && (
          <div className="empty">
            <p>Belum ada anggota tim.</p>
            <button className="btn primary" type="button" onClick={() => onOpenMember(null)}>
              + Tambah Anggota
            </button>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-head">
          <h3>Alokasi Anggota → Tugas</h3>
          <span className="hint" style={{ margin: 0 }}>
            Total estimasi seluruh alokasi: <b>{fmtCompact(Array.from(metrics.values()).reduce((s, m) => s + m.cost, 0))}</b>
          </span>
        </div>
        <div className="alloc-summary">
          {state.members.map((m) => {
            const agg = metrics.get(m.id) ?? { days: 0, cost: 0, taskCount: 0 }
            const assigned = rows.filter((r) => r.task.members.includes(m.id))
            return (
              <div className="alloc-card" key={m.id}>
                <div className="who">
                  <span className="avatar" style={{ background: avatarColor(m.id) }}>
                    {initials(m.name)}
                  </span>
                  <span>{m.name}</span>
                </div>
                <div className="meta">
                  {agg.taskCount === 0 ? (
                    <>Belum dialokasikan ke tugas mana pun.</>
                  ) : (
                    <>
                      {agg.taskCount} tugas · {agg.days} hari kerja · {fmtRp(agg.cost)}
                      <br />
                      {assigned.slice(0, 3).map((r) => findTask(state.tasks, r.task.id)?.name).join(' · ')}
                      {assigned.length > 3 ? ` · +${assigned.length - 3} lagi` : ''}
                    </>
                  )}
                  <div className="bar-track">
                    <div
                      className="bar-fill"
                      style={{ width: `${Math.round((agg.days / maxDays) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            )
          })}
          {state.members.length === 0 && (
            <div className="empty" style={{ gridColumn: '1/-1' }}>
              <p>Tambahkan anggota untuk mengalokasikan sumber daya.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
