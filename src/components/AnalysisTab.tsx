import { useMemo } from 'react'
import type { ProjectState } from '../types'
import { priorityOf } from '../types'
import type { Schedule } from '../lib/scheduler'
import { buildRows } from '../lib/rows'
import { fmtDate, fmtShort } from '../lib/calendar'
import { setUi } from '../lib/store'
import { withAlpha } from '../lib/format'
import PertDiagram from './PertDiagram'

interface Props {
  state: ProjectState
  sched: Schedule
  onJumpGantt: () => void
}

export default function AnalysisTab({ state, sched, onJumpGantt }: Props) {
  const rows = useMemo(() => buildRows(state), [state])
  const visible = state.ui.critOnly
    ? rows.filter((r) => sched.sched.get(r.task.id)?.critical)
    : rows

  return (
    <section>
      <div className="stats stats-sub">
        <div className="stat">
          <div className="k">Durasi Proyek</div>
          <div className="v">
            {sched.project.duration} <small>hari kerja</small>
          </div>
        </div>
        <div className="stat">
          <div className="k">Mulai Tercepat</div>
          <div className="v" style={{ fontSize: 15 }}>
            {fmtDate(sched.project.start)}
          </div>
        </div>
        <div className="stat">
          <div className="k">Selesai Tercepat</div>
          <div className="v" style={{ fontSize: 15 }}>
            {fmtDate(sched.project.finish)}
          </div>
        </div>
        <div className="stat alert">
          <div className="k">Tugas Kritis</div>
          <div className="v">
            {sched.criticalCount} <small>dari {state.tasks.length}</small>
          </div>
        </div>
        <div className={`stat${sched.ok ? ' ok' : ' alert'}`}>
          <div className="k">Status Jaringan</div>
          <div className="v" style={{ fontSize: 15 }}>
            {sched.ok ? 'Sehat ✓' : 'Siklus terdeteksi!'}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h3>Analisis Jalur Kritis &amp; CPM</h3>
          <div className="card-actions">
            <label className="check">
              <input
                type="checkbox"
                checked={state.ui.critOnly}
                onChange={(e) => setUi({ critOnly: e.target.checked })}
              />
              Hanya jalur kritis
            </label>
            <button className="btn ghost small" type="button" onClick={onJumpGantt}>
              Lihat di Gantt →
            </button>
          </div>
        </div>
        <p className="hint">
          ES = mulai tercepat · EF = selesai tercepat · LS = mulai terlambat · LF = selesai terlambat ·
          Float = kelonggaran (hari kerja). Float 0 = jalur kritis.
        </p>
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th className="col-name">Tugas</th>
                <th className="num">Durasi</th>
                <th>ES</th>
                <th>EF</th>
                <th>LS</th>
                <th>LF</th>
                <th className="num">Float</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => {
                const t = r.task
                const s = sched.sched.get(t.id)
                if (!s) return null
                const prio = priorityOf(t.priority)
                return (
                  <tr
                    key={t.id}
                    className={`task-row${r.summary ? ' summary-row' : ''}${s.critical ? ' critical-row' : ''}`}
                  >
                    <td>
                      <div className="name-cell" style={{ paddingLeft: r.depth * 18 }}>
                        <i className="dot" style={{ background: t.color || prio.color }} />
                        <span className="t-name">{t.name}</span>
                        {r.summary && <span className="badge-sub">ringkasan</span>}
                      </div>
                    </td>
                    <td className="num dur">{s.dur} hr</td>
                    <td className="date-cell" title={fmtDate(s.es)}>
                      {fmtShort(s.es)}
                    </td>
                    <td className="date-cell" title={fmtDate(s.ef)}>
                      {fmtShort(s.ef)}
                    </td>
                    <td className="date-cell" title={fmtDate(s.ls)}>
                      {fmtShort(s.ls)}
                    </td>
                    <td className="date-cell" title={fmtDate(s.lf)}>
                      {fmtShort(s.lf)}
                    </td>
                    <td className={`num ${s.critical ? 'cpm-crit' : 'cpm-ok'}`}>{s.float} hr</td>
                    <td>
                      {s.critical ? (
                        <span className="prio" style={{ background: withAlpha('#dc2626', 0.14), color: '#dc2626' }}>
                          ★ Kritis
                        </span>
                      ) : (
                        <span className="prio" style={{ background: withAlpha('#16a34a', 0.14), color: '#16a34a' }}>
                          Aman
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {visible.length === 0 && (
          <div className="empty">
            <p>
              {state.tasks.length === 0
                ? 'Belum ada tugas untuk dianalisis.'
                : 'Tidak ada tugas pada filter ini.'}
            </p>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-head">
          <h3>Diagram PERT</h3>
          <span className="hint" style={{ margin: 0 }}>
            Node: durasi &amp; waktu ES/EF/LS/LF/TF · Panah: hubungan FS/SS beserta jeda (lag)
          </span>
        </div>
        <PertDiagram state={state} sched={sched} />
      </div>
    </section>
  )
}
