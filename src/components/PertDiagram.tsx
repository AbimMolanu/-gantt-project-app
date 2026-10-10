import { useMemo } from 'react'
import type { ProjectState, Task } from '../types'
import { priorityOf } from '../types'
import type { Schedule } from '../lib/scheduler'
import { cmp, fmtShort } from '../lib/calendar'

const W = 184
const H = 104
const COL_GAP = 76
const ROW_GAP = 30

interface Props {
  state: ProjectState
  sched: Schedule
}

function trunc(s: string, n: number): string {
  const str = String(s || '')
  return str.length > n ? `${str.slice(0, n - 1)}…` : str
}

export default function PertDiagram({ state, sched }: Props) {
  const layout = useMemo(() => {
    const leaves = state.tasks.filter((t) => !sched.kidsOf(t.id).length)

    /* --- tingkat (kolom) --- */
    const rankMemo = new Map<string, number>()
    const rank = (id: string, stack: Set<string>): number => {
      const memo = rankMemo.get(id)
      if (memo !== undefined) return memo
      if (stack.has(id)) return 0
      stack.add(id)
      let r = 0
      const kids = sched.kidsOf(id)
      if (kids.length) {
        kids.forEach((k) => {
          r = Math.max(r, rank(k.id, stack))
        })
      } else {
        sched.inEdges.get(id)?.forEach((e) => {
          r = Math.max(r, rank(e.from, stack) + 1)
        })
      }
      stack.delete(id)
      rankMemo.set(id, r)
      return r
    }

    const cols = new Map<number, Task[]>()
    leaves.forEach((t) => {
      const r = rank(t.id, new Set())
      const list = cols.get(r) ?? []
      list.push(t)
      cols.set(r, list)
    })
    const ranks = Array.from(cols.keys()).sort((a, b) => a - b)
    ranks.forEach((r) => {
      cols.get(r)!.sort((a, b) => {
        const sa = sched.sched.get(a.id)
        const sb = sched.sched.get(b.id)
        if (!sa || !sb) return 0
        return cmp(sa.es, sb.es)
      })
    })

    /* --- posisi --- */
    const pos = new Map<string, { x: number; y: number }>()
    let maxRows = 1
    ranks.forEach((r, ci) => {
      const list = cols.get(r)!
      maxRows = Math.max(maxRows, list.length)
      list.forEach((t, ri) => {
        pos.set(t.id, { x: 16 + ci * (W + COL_GAP), y: 16 + ri * (H + ROW_GAP) })
      })
    })

    /* perwakilan aktivitas bila pendahulu berupa ringkasan */
    const repOf = (id: string): string | null => {
      const kids = sched.kidsOf(id)
      if (!kids.length) return id
      let best: string | null = null
      let bestEf: Date | null = null
      kids.forEach((k) => {
        const r = repOf(k.id)
        if (!r) return
        const s = sched.sched.get(r)
        if (!s) return
        if (!bestEf || cmp(s.ef, bestEf) > 0) {
          best = r
          bestEf = s.ef
        }
      })
      return best
    }

    const svgW = Math.max(400, 16 + ranks.length * (W + COL_GAP) - COL_GAP + 24)
    const svgH = Math.max(240, 16 + maxRows * (H + ROW_GAP) - ROW_GAP + 24)

    return { leaves, pos, repOf, svgW, svgH }
  }, [state.tasks, sched])

  if (!layout.leaves.length) {
    return <div className="empty">Belum ada aktivitas untuk diagram PERT.</div>
  }

  const { pos, repOf, svgW, svgH } = layout

  const cell = (key: string, lx: number, ly: number, label: string, val: string, valX: number) => (
    <g key={key}>
      <text x={lx} y={ly} fontSize={10} fill="#64748b" fontWeight={700}>
        {label}
      </text>
      <text x={valX} y={ly} fontSize={11} fill="#0f172a" fontWeight={600}>
        {val}
      </text>
    </g>
  )

  const nodes = layout.leaves.map((t) => {
    const p = pos.get(t.id)
    const s = sched.sched.get(t.id)
    if (!p || !s) return null
    const prio = priorityOf(t.priority)
    const color = t.color || prio.color
    const stroke = s.critical ? '#dc2626' : '#cbd5e1'
    const sw = s.critical ? 2.4 : 1.4
    return (
      <g key={t.id} transform={`translate(${p.x},${p.y})`}>
        <rect x={0} y={0} width={W} height={H} rx={9} fill="#ffffff" stroke={stroke} strokeWidth={sw} />
        <rect x={2} y={3} width={6} height={H - 6} rx={3} fill={color} />
        <text x={16} y={21} fontSize={12.5} fontWeight={700} fill="#0f172a">
          {trunc(t.name, 21)}
        </text>
        <line x1={12} y1={30} x2={W - 12} y2={30} stroke="#e2e8f0" />
        {cell(`es${t.id}`, 16, 46, 'ES', fmtShort(s.es), 44)}
        {cell(`ef${t.id}`, 104, 46, 'EF', fmtShort(s.ef), 132)}
        {cell(`ls${t.id}`, 16, 64, 'LS', fmtShort(s.ls), 44)}
        {cell(`lf${t.id}`, 104, 64, 'LF', fmtShort(s.lf), 132)}
        {cell(`dur${t.id}`, 16, 82, 'Dur', `${s.dur} hr`, 44)}
        {cell(`tf${t.id}`, 104, 82, 'TF', `${s.float} hr`, 132)}
        <text
          x={16}
          y={H - 8}
          fontSize={9.5}
          fontWeight={800}
          fill={s.critical ? '#dc2626' : '#94a3b8'}
        >
          {s.critical ? '★ JALUR KRITIS' : prio.label.toUpperCase()}
        </text>
        <text x={W - 14} y={H - 8} fontSize={9.5} fill="#94a3b8" textAnchor="end">
          {t.members.length ? `${t.members.length} anggota` : 'tanpa alokasi'}
        </text>
      </g>
    )
  })

  const arrows = sched.edges.map((e, i) => {
    const from = repOf(e.from)
    const to = repOf(e.to)
    if (!from || !to || from === to) return null
    const a = pos.get(from)
    const b = pos.get(to)
    if (!a || !b) return null
    const sa = sched.sched.get(from)
    const sb = sched.sched.get(to)
    const crit = !!sa && !!sb && sa.critical && sb.critical
    const stroke = crit ? '#dc2626' : '#64748b'
    const x1 = a.x + W
    const y1 = a.y + H / 2
    const x2 = b.x
    const y2 = b.y + H / 2
    const mid = x1 + Math.max(20, (x2 - x1) / 2)
    const d = `M${x1},${y1} H${mid} V${y2} H${x2 - 8}`
    const label = `${e.type}${e.lag > 0 ? `+${e.lag}` : ''}`
    return (
      <g key={i}>
        <path
          d={d}
          fill="none"
          stroke={stroke}
          strokeWidth={1.6}
          markerEnd={`url(#${crit ? 'pArrowC' : 'pArrow'})`}
        />
        <text
          x={mid}
          y={(y1 + y2) / 2 - 4}
          fontSize={9.5}
          fontWeight={700}
          fill={stroke}
          textAnchor="middle"
          style={{ paintOrder: 'stroke', stroke: '#fcfdff', strokeWidth: 4 }}
        >
          {label}
        </text>
      </g>
    )
  })

  return (
    <div className="pert-wrap">
      <svg width={svgW} height={svgH} style={{ fontFamily: 'inherit' }} xmlns="http://www.w3.org/2000/svg">
        <defs>
          <marker id="pArrow" viewBox="0 0 10 10" refX={8} refY={5} markerWidth={6.5} markerHeight={6.5} orient="auto">
            <path d="M0,0 L10,5 L0,10 z" fill="#64748b" />
          </marker>
          <marker id="pArrowC" viewBox="0 0 10 10" refX={8} refY={5} markerWidth={6.5} markerHeight={6.5} orient="auto">
            <path d="M0,0 L10,5 L0,10 z" fill="#dc2626" />
          </marker>
        </defs>
        {arrows}
        {nodes}
      </svg>
    </div>
  )
}
