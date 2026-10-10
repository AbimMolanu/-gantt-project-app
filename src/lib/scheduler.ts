/* ============================================================
   scheduler.ts — Penjadwalan otomatis + CPM (Critical Path Method)
   - Forward pass  : tanggal tercepat (ES/EF) mengikuti pendahulu
                     (FS/SS + lag) dan kalender hari kerja.
   - Backward pass : tanggal terlambat (LS/LF) + total float.
   - Rollup        : tugas induk (ringkasan) dihitung dari sub-tugas.
   - Jalur kritis  : float <= 0.
   ============================================================ */
import type { CalendarConfig, LinkType, Task } from '../types'
import { back, cmp, countWorking, fwd, fromISO, nextWorking, toISO, today } from './calendar'

export interface SchedEntry {
  es: Date
  ef: Date
  ls: Date | null
  lf: Date | null
  float: number
  dur: number
  summary: boolean
  critical: boolean
  infeasible: boolean
}

export interface Edge {
  from: string
  to: string
  type: LinkType
  lag: number
}

export interface Schedule {
  ok: boolean
  cycleIds: string[]
  children: Map<string, Task[]>
  kidsOf: (id: string) => Task[]
  isSummary: (id: string) => boolean
  order: string[]
  edges: Edge[]
  outEdges: Map<string, Edge[]>
  inEdges: Map<string, Edge[]>
  sched: Map<string, SchedEntry>
  criticalIds: Record<string, boolean>
  criticalCount: number
  project: { start: string; finish: string; duration: number }
}

function minDate(a: Date | null, b: Date): Date {
  return !a || cmp(b, a) < 0 ? b : a
}

function maxDate(a: Date | null, b: Date): Date {
  return !a || cmp(b, a) > 0 ? b : a
}

export function computeSchedule(tasks: Task[], cal: CalendarConfig): Schedule {
  const byId = new Map<string, Task>()
  tasks.forEach((t) => byId.set(t.id, t))

  /* --- peta hierarki --- */
  const children = new Map<string, Task[]>()
  tasks.forEach((t) => {
    if (t.parentId) children.set(t.id, [])
  })
  tasks.forEach((t) => {
    if (t.parentId && byId.has(t.parentId)) {
      if (!children.has(t.parentId)) children.set(t.parentId, [])
      children.get(t.parentId)!.push(t)
    }
  })
  const kidsOf = (id: string): Task[] => children.get(id) ?? []
  const isSummary = (id: string): boolean => kidsOf(id).length > 0

  /* --- daftar keterkaitan (edges: pendahulu -> tugas) --- */
  const edges: Edge[] = []
  const isAncestor = (a: string, b: string): boolean => {
    let cur = byId.get(b)
    let guard = 0
    while (cur && cur.parentId && guard++ < 1000) {
      if (cur.parentId === a) return true
      cur = byId.get(cur.parentId)
    }
    return false
  }
  tasks.forEach((t) => {
    t.preds.forEach((p) => {
      if (!p || !byId.has(p.taskId) || p.taskId === t.id) return
      if (isAncestor(p.taskId, t.id)) return // induk tidak bisa jadi pendahulu sub-tugasnya
      const dup = edges.some((e) => e.from === p.taskId && e.to === t.id && e.type === (p.type || 'FS'))
      if (dup) return
      edges.push({
        from: p.taskId,
        to: t.id,
        type: p.type === 'SS' ? 'SS' : 'FS',
        lag: Math.max(0, Math.floor(Number(p.lag) || 0)),
      })
    })
  })
  const outEdges = new Map<string, Edge[]>()
  const inEdges = new Map<string, Edge[]>()
  tasks.forEach((t) => {
    outEdges.set(t.id, [])
    inEdges.set(t.id, [])
  })
  edges.forEach((e) => {
    outEdges.get(e.from)!.push(e)
    inEdges.get(e.to)!.push(e)
  })

  /* --- urutan topologis (Kahn) --- */
  const indeg = new Map<string, number>()
  tasks.forEach((t) => indeg.set(t.id, 0))
  edges.forEach((e) => indeg.set(e.to, (indeg.get(e.to) ?? 0) + 1))
  const order: string[] = []
  const placed: Record<string, boolean> = {}
  const queue: string[] = []
  tasks.forEach((t) => {
    if ((indeg.get(t.id) ?? 0) === 0) queue.push(t.id)
  })
  while (queue.length) {
    const id = queue.shift()!
    if (placed[id]) continue
    placed[id] = true
    order.push(id)
    outEdges.get(id)!.forEach((e) => {
      indeg.set(e.to, (indeg.get(e.to) ?? 0) - 1)
      if ((indeg.get(e.to) ?? 0) <= 0 && !placed[e.to]) queue.push(e.to)
    })
  }
  const cycleIds: string[] = []
  tasks.forEach((t) => {
    if (!placed[t.id]) {
      cycleIds.push(t.id)
      order.push(t.id)
    }
  })

  /* --- FORWARD PASS (dengan memo + rekursi untuk rollup) --- */
  const sched = new Map<string, SchedEntry>()
  const todayIso = toISO(today())

  const forward = (id: string, stack: Set<string>): SchedEntry | null => {
    if (sched.has(id)) return sched.get(id)!
    if (stack.has(id)) return null // siklus campuran hierarki/keterkaitan
    const t = byId.get(id)
    if (!t) return null
    stack.add(id)

    let entry: SchedEntry | null = null
    const kids = kidsOf(id)
    if (kids.length) {
      let es: Date | null = null
      let ef: Date | null = null
      kids.forEach((k) => {
        const e = forward(k.id, stack)
        if (e) {
          es = minDate(es, e.es)
          ef = maxDate(ef, e.ef)
        }
      })
      if (es && ef) {
        entry = {
          es,
          ef,
          ls: null,
          lf: null,
          float: 0,
          dur: Math.max(1, countWorking(cal, es, ef)),
          summary: true,
          critical: false,
          infeasible: false,
        }
      }
    } else {
      const dur = Math.max(1, Math.floor(Number(t.duration) || 1))
      let es = nextWorking(cal, fromISO(t.start || todayIso))
      inEdges.get(id)!.forEach((e) => {
        const p = forward(e.from, stack)
        if (!p) return
        const cand = e.type === 'SS' ? fwd(cal, p.es, e.lag) : fwd(cal, p.ef, e.lag + 1)
        if (cmp(cand, es) > 0) es = cand
      })
      entry = {
        es,
        ef: fwd(cal, es, dur - 1),
        ls: null,
        lf: null,
        float: 0,
        dur,
        summary: false,
        critical: false,
        infeasible: false,
      }
    }
    stack.delete(id)
    if (!entry) {
      // cadangan bila terdeteksi siklus
      const dur = Math.max(1, Math.floor(Number(t.duration) || 1))
      const es = nextWorking(cal, fromISO(t.start || todayIso))
      entry = {
        es,
        ef: fwd(cal, es, dur - 1),
        ls: null,
        lf: null,
        float: 0,
        dur,
        summary: isSummary(id),
        critical: false,
        infeasible: false,
      }
    }
    sched.set(id, entry)
    return entry
  }
  order.forEach((id) => forward(id, new Set()))

  /* --- proyek --- */
  let projectStart: Date | null = null
  let projectFinish: Date | null = null
  sched.forEach((s) => {
    projectStart = minDate(projectStart, s.es)
    projectFinish = maxDate(projectFinish, s.ef)
  })
  if (!projectStart || !projectFinish) {
    projectStart = fromISO(todayIso)
    projectFinish = projectStart
  }

  /* --- BACKWARD PASS --- */
  const projectEnd = projectFinish
  sched.forEach((s) => {
    if (s.summary) return
    s.lf = projectEnd
    s.ls = back(cal, projectEnd, s.dur - 1)
  })

  const relaxLeaf = (id: string): void => {
    const s = sched.get(id)
    if (!s || s.summary) return
    let ls = s.ls!
    let lf = s.lf!
    outEdges.get(id)!.forEach((e) => {
      const ts = sched.get(e.to)
      if (!ts || !ts.ls) return
      if (e.type === 'SS') {
        ls = minDate(ls, back(cal, ts.ls, e.lag))
      } else {
        lf = minDate(lf, back(cal, ts.ls, e.lag + 1))
      }
    })
    const lsFromLf = back(cal, lf, s.dur - 1)
    if (cmp(lsFromLf, ls) < 0) ls = lsFromLf
    const lfFromLs = fwd(cal, ls, s.dur - 1)
    if (cmp(lfFromLs, lf) < 0) lf = lfFromLs
    s.ls = ls
    s.lf = lf
  }

  /* batasan yang menempel pada tugas ringkasan diterapkan ke seluruh daun di bawahnya */
  const pushSummaryConstraint = (id: string, apply: (leafId: string, s: SchedEntry) => void): void => {
    kidsOf(id).forEach((k) => {
      if (kidsOf(k.id).length) pushSummaryConstraint(k.id, apply)
      else {
        const ks = sched.get(k.id)
        if (ks) apply(k.id, ks)
      }
    })
  }
  const relaxSummaryEdges = (id: string): void => {
    const s = sched.get(id)
    if (!s || !s.summary) return
    outEdges.get(id)!.forEach((e) => {
      const ts = sched.get(e.to)
      if (!ts || !ts.ls) return
      pushSummaryConstraint(id, (_leafId, leaf) => {
        if (e.type === 'SS') {
          leaf.ls = minDate(leaf.ls, back(cal, ts.ls!, e.lag))
        } else {
          leaf.lf = minDate(leaf.lf, back(cal, ts.ls!, e.lag + 1))
        }
        const lsf = back(cal, leaf.lf!, leaf.dur - 1)
        if (cmp(lsf, leaf.ls!) < 0) leaf.ls = lsf
      })
    })
  }

  const rollupBackward = (): void => {
    sched.forEach((s, id) => {
      if (!s.summary) return
      let ls: Date | null = null
      let lf: Date | null = null
      kidsOf(id).forEach((k) => {
        const ks = sched.get(k.id)
        if (!ks) return
        ls = minDate(ls, ks.ls!)
        lf = maxDate(lf, ks.lf!)
      })
      if (ls) s.ls = ls
      if (lf) s.lf = lf
    })
  }

  for (let pass = 0; pass < 3; pass++) {
    for (let i = order.length - 1; i >= 0; i--) relaxLeaf(order[i])
    for (let i = order.length - 1; i >= 0; i--) relaxSummaryEdges(order[i])
    rollupBackward()
  }

  /* --- float + status kritis --- */
  const criticalIds: Record<string, boolean> = {}
  let criticalCount = 0
  sched.forEach((s) => {
    if (!s.ls || !s.lf) {
      s.ls = s.es
      s.lf = s.ef
    }
    if (cmp(s.ls, s.es) >= 0) {
      s.float = Math.max(0, countWorking(cal, s.es, s.ls) - 1)
      s.infeasible = false
    } else {
      s.float = 0
      s.infeasible = true // batasan tak dapat dipenuhi → dianggap kritis
    }
    s.critical = s.float <= 0
  })
  // ringkasan: float = float anak paling kecil; kritis bila ada anak kritis
  sched.forEach((s, id) => {
    if (!s.summary) return
    let f: number | null = null
    let anyCrit = false
    kidsOf(id).forEach((k) => {
      const ks = sched.get(k.id)
      if (!ks) return
      f = f === null ? ks.float : Math.min(f, ks.float)
      if (ks.critical) anyCrit = true
    })
    if (f !== null) s.float = f
    s.critical = anyCrit || s.float <= 0
  })
  sched.forEach((s, id) => {
    if (s.critical) {
      criticalCount++
      criticalIds[id] = true
    }
  })

  const projectDuration = Math.max(1, countWorking(cal, projectStart, projectFinish))

  return {
    ok: cycleIds.length === 0,
    cycleIds,
    children,
    kidsOf,
    isSummary,
    order,
    edges,
    outEdges,
    inEdges,
    sched,
    criticalIds,
    criticalCount,
    project: {
      start: toISO(projectStart),
      finish: toISO(projectFinish),
      duration: projectDuration,
    },
  }
}
