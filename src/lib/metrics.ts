/* Metrik sumber daya: beban kerja & estimasi biaya */
import type { Member, Task } from '../types'
import type { Schedule } from './scheduler'

/** Asumsi 22 hari kerja per bulan untuk tarif harian. */
export const WORK_DAYS_PER_MONTH = 22

export function dailyRate(m: Member): number {
  return m.salary / WORK_DAYS_PER_MONTH
}

export interface MemberMetrics {
  days: number
  cost: number
  taskCount: number
}

function emptyMetrics(): MemberMetrics {
  return { days: 0, cost: 0, taskCount: 0 }
}

/** Beban (hari kerja terjadwal) + biaya per anggota. */
export function memberMetrics(members: Member[], tasks: Task[], sched: Schedule): Map<string, MemberMetrics> {
  const out = new Map<string, MemberMetrics>()
  members.forEach((m) => out.set(m.id, emptyMetrics()))
  tasks.forEach((t) => {
    const s = sched.sched.get(t.id)
    const dur = s ? s.dur : t.duration
    t.members.forEach((mid) => {
      const m = members.find((x) => x.id === mid)
      const agg = out.get(mid)
      if (!m || !agg) return
      agg.days += dur
      agg.cost += dailyRate(m) * dur
      agg.taskCount += 1
    })
  })
  return out
}

/** Total estimasi biaya semua alokasi. */
export function totalCost(metrics: Map<string, MemberMetrics>): number {
  let sum = 0
  metrics.forEach((m) => {
    sum += m.cost
  })
  return sum
}

/** Biaya satu tugas (semua anggota yang dialokasikan). */
export function taskCost(t: Task, members: Member[], dur: number): number {
  return t.members.reduce((sum, mid) => {
    const m = members.find((x) => x.id === mid)
    return m ? sum + dailyRate(m) * dur : sum
  }, 0)
}
