import type { ProjectState } from '../types'
import type { Schedule } from '../lib/scheduler'
import { fmtDate } from '../lib/calendar'
import { memberMetrics, totalCost } from '../lib/metrics'
import { fmtCompact } from '../lib/format'

interface Props {
  state: ProjectState
  sched: Schedule
}

export default function StatsBar({ state, sched }: Props) {
  const metrics = memberMetrics(state.members, state.tasks, sched)
  const cost = totalCost(metrics)
  const crit = sched.criticalCount

  return (
    <div className="stats">
      <div className="stat">
        <div className="k">Durasi Proyek</div>
        <div className="v">
          {sched.project.duration} <small>hari kerja</small>
        </div>
      </div>
      <div className="stat">
        <div className="k">Rentang Waktu</div>
        <div className="v" style={{ fontSize: 15 }}>
          {fmtDate(sched.project.start)} <small>→ {fmtDate(sched.project.finish)}</small>
        </div>
      </div>
      <div className="stat">
        <div className="k">Total Tugas</div>
        <div className="v">
          {state.tasks.length} <small>tugas</small>
        </div>
      </div>
      <div className={`stat${crit > 0 ? ' alert' : ' ok'}`}>
        <div className="k">Jalur Kritis</div>
        <div className="v">
          {crit} <small>tugas kritis</small>
        </div>
      </div>
      <div className="stat">
        <div className="k">Sumber Daya</div>
        <div className="v">
          {state.members.length} <small>anggota</small>
        </div>
      </div>
      <div className="stat">
        <div className="k">Estimasi Biaya</div>
        <div className="v" style={{ fontSize: 17 }}>
          {fmtCompact(cost)}
        </div>
      </div>
    </div>
  )
}
