import { useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import type { ProjectState, Task, ZoomLevel } from '../types'
import { priorityOf } from '../types'
import type { Schedule } from '../lib/scheduler'
import {
  MONTHS_LONG,
  addDays,
  cmp,
  dayNumber,
  daySpan,
  fmtDate,
  isHoliday,
  isWorking,
  toISO,
  today,
} from '../lib/calendar'
import { projectBar } from '../lib/ganttDrag'
import { setUi, updateTask } from '../lib/store'
import { buildRows } from '../lib/rows'
import { findTask } from '../lib/tree'

const ROW_H = 36
const ZOOM: Record<ZoomLevel, number> = { day: 30, week: 15, month: 8 }

interface Props {
  state: ProjectState
  sched: Schedule
  onOpenTask: (id: string | null) => void
}

interface DragState {
  id: string
  mode: 'move' | 'l' | 'r'
  startClientX: number
  startDayIdx: number
  es: Date
  ef: Date
  duration: number
  delta: number
  moved: boolean
}


function BarTooltip({
  task,
  state,
  sched,
  x,
  y,
}: {
  task: Task
  state: ProjectState
  sched: Schedule
  x: number
  y: number
}): ReactNode {
  const s = sched.sched.get(task.id)
  const prio = priorityOf(task.priority)
  const kids = sched.kidsOf(task.id)
  const preds = task.preds.filter((p) => findTask(state.tasks, p.taskId))
  const allocs = task.members
    .map((mid) => state.members.find((m) => m.id === mid))
    .filter((m): m is NonNullable<typeof m> => !!m)
  const hol = s ? isHoliday(state.calendar, s.es) : null
  if (!s) return null

  return (
    <div className="tooltip" style={{ left: x, top: y }}>
      <span className="tt-title">{task.name}</span>
      Mulai: <b>{fmtDate(s.es)}</b>
      <br />
      Selesai: <b>{fmtDate(s.ef)}</b>
      <br />
      Durasi: <b>{s.dur} hari kerja</b>
      {kids.length ? <i> (ringkasan {kids.length} sub-tugas)</i> : null}
      <br />
      Prioritas: <b>{prio.label}</b>
      {preds.length > 0 && (
        <>
          <br />
          Pendahulu:{' '}
          {preds.map((p, i) => (
            <span key={i}>
              {i > 0 && ', '}
              {findTask(state.tasks, p.taskId)?.name} ({p.type}+{p.lag})
            </span>
          ))}
        </>
      )}
      {allocs.length > 0 && (
        <>
          <br />
          Alokasi: {allocs.map((m) => m.name).join(', ')}
        </>
      )}
      <br />
      Float: <b>{s.float} hari kerja</b>
      {s.critical && (
        <>
          {' '}
          · <span className="tt-crit">JALUR KRITIS</span>
        </>
      )}
      {hol && (
        <>
          <br />
          <i>Mulai digeser karena libur: {hol.name}</i>
        </>
      )}
    </div>
  )
}

export default function GanttTab({ state, sched, onOpenTask }: Props) {
  const cal = state.calendar
  const rows = useMemo(() => buildRows(state), [state])
  const zoom = state.ui.zoom
  const col = ZOOM[zoom]

  /* ---------- rentang timeline ---------- */
  const range = useMemo(() => {
    let minD: Date | null = null
    let maxD: Date | null = null
    state.tasks.forEach((t) => {
      const s = sched.sched.get(t.id)
      if (!s) return
      if (!minD || cmp(s.es, minD) < 0) minD = s.es
      if (!maxD || cmp(s.ef, maxD) > 0) maxD = s.ef
    })
    const now = today()
    if (!minD || !maxD) {
      minD = addDays(now, -7)
      maxD = addDays(now, 14)
    }
    if (cmp(now, minD) < 0 && daySpan(now, minD) <= 45) minD = now
    if (cmp(now, maxD) > 0 && daySpan(maxD, now) <= 45) maxD = now
    let start = addDays(minD, -3)
    while (start.getDay() !== 1) start = addDays(start, -1) // Senin
    let end = addDays(maxD, 3)
    while (end.getDay() !== 0) end = addDays(end, 1) // Minggu
    if (daySpan(start, end) > 1500) end = addDays(start, 1500)
    return { start, end, days: daySpan(start, end) + 1, startNum: dayNumber(start) }
  }, [state.tasks, sched])

  const idxOf = (d: Date): number => dayNumber(d) - range.startNum
  const totalW = range.days * col
  const bodyH = Math.max(rows.length * ROW_H, ROW_H)

  /* ---------- drag state ---------- */
  const [drag, setDrag] = useState<DragState | null>(null)
  const [tip, setTip] = useState<{ x: number; y: number; task: Task } | null>(null)
  const ganttRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<DragState | null>(null)
  dragRef.current = drag

  const scrollToToday = () => {
    const el = ganttRef.current
    if (!el) return
    const i = dayNumber(today()) - range.startNum
    el.scrollLeft = Math.max(0, i * col - Math.round(el.clientWidth / 2.5))
  }

  useEffect(() => {
    scrollToToday()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!drag) return
    const onMove = (e: PointerEvent) => {
      const body = bodyRef.current
      if (!body) return
      const rect = body.getBoundingClientRect()
      const curDay = Math.round((e.clientX - rect.left) / col)
      setDrag((d) => {
        if (!d) return d
        const delta = curDay - d.startDayIdx
        const moved = d.moved || delta !== 0 || Math.abs(e.clientX - d.startClientX) > 3
        return { ...d, delta, moved }
      })
    }
    const onUp = () => {
      const d = dragRef.current
      setDrag(null)
      if (!d) return
      if (!d.moved) {
        onOpenTask(d.id)
        return
      }
      const p = projectBar(cal, d.mode, d, d.delta)
      if (d.mode === 'move') updateTask(d.id, { start: toISO(p.start) })
      else if (d.mode === 'r') updateTask(d.id, { duration: p.duration })
      else updateTask(d.id, { start: toISO(p.start), duration: p.duration })
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [drag, col, cal, onOpenTask])

  const startDrag = (e: ReactPointerEvent, task: Task, mode: DragState['mode']) => {
    if (e.button !== 0) return
    const s = sched.sched.get(task.id)
    const body = bodyRef.current
    if (!s || !body) return
    e.preventDefault()
    const rect = body.getBoundingClientRect()
    setDrag({
      id: task.id,
      mode,
      startClientX: e.clientX,
      startDayIdx: Math.round((e.clientX - rect.left) / col),
      es: s.es,
      ef: s.ef,
      duration: s.dur,
      delta: 0,
      moved: false,
    })
  }

  const toggleCollapse = (id: string) => {
    const next = { ...state.ui.collapsed }
    if (next[id]) delete next[id]
    else next[id] = true
    setUi({ collapsed: next })
  }

  /* ---------- header timeline ---------- */
  const header = useMemo(() => {
    const months: { label: string; width: number }[] = []
    let cur = new Date(range.start.getFullYear(), range.start.getMonth(), 1)
    while (cmp(cur, range.end) <= 0) {
      const nextM = new Date(cur.getFullYear(), cur.getMonth() + 1, 1)
      const s = Math.max(0, idxOf(cur))
      const e = Math.min(range.days, idxOf(nextM))
      const w = Math.max(0, (e - s) * col)
      if (w > 0) months.push({ label: `${MONTHS_LONG[cur.getMonth()]} ${cur.getFullYear()}`, width: w })
      cur = nextM
    }

    const days: { n: number; cls: string }[] = []
    for (let i = 0; i < range.days; i++) {
      const d = addDays(range.start, i)
      const hol = isHoliday(cal, d)
      const cls = ['g-day']
      if (hol) cls.push('holi')
      else if (!isWorking(cal, d)) cls.push('wend')
      if (d.getDate() === 1) cls.push('first-month')
      if (d.getDay() === 1) cls.push('wkstart')
      days.push({ n: d.getDate(), cls: cls.join(' ') })
    }
    return { months, days }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, col, cal])

  /* ---------- latar (shade / garis minggu / hari ini) ---------- */
  const shades: ReactNode[] = []
  for (let i = 0; i < range.days; i++) {
    const d = addDays(range.start, i)
    const hol = isHoliday(cal, d)
    if (hol) {
      shades.push(
        <div key={`h${i}`} className="g-shade holi" style={{ left: i * col, width: col }} title={hol.name} />,
      )
    } else if (!isWorking(cal, d)) {
      shades.push(<div key={`w${i}`} className="g-shade" style={{ left: i * col, width: col }} />)
    } else if (d.getDay() === 1) {
      shades.push(<div key={`l${i}`} className="g-weekline" style={{ left: i * col }} />)
    }
  }
  const todayIdx = idxOf(today())
  const showToday = todayIdx >= 0 && todayIdx < range.days

  /* ---------- panah keterkaitan ---------- */
  const rowIndex = useMemo(() => {
    const m = new Map<string, number>()
    rows.forEach((r, i) => m.set(r.task.id, i))
    return m
  }, [rows])

  const linksSvg = (() => {
    if (!state.ui.showLinks) return null
    const paths: ReactNode[] = []
    sched.edges.forEach((e, i) => {
      const a = rowIndex.get(e.from)
      const b = rowIndex.get(e.to)
      if (a === undefined || b === undefined) return
      const sa = sched.sched.get(e.from)
      const sb = sched.sched.get(e.to)
      if (!sa || !sb) return
      const x1 = (e.type === 'SS' ? idxOf(sa.es) : idxOf(sa.ef) + 1) * col
      const y1 = a * ROW_H + ROW_H / 2
      const xe = idxOf(sb.es) * col
      const y2 = b * ROW_H + ROW_H / 2
      const end = xe - 6
      const crit = sa.critical && sb.critical
      const stroke = crit ? '#dc2626' : '#64748b'
      const marker = crit ? 'garrowC' : 'garrow'
      const d =
        end >= x1 + 16
          ? `M${x1},${y1} H${x1 + 9} V${y2} H${end}`
          : `M${x1},${y1} H${Math.min(x1, end) - 16} V${y2} H${end}`
      paths.push(
        <path
          key={i}
          d={d}
          fill="none"
          stroke={stroke}
          strokeWidth={1.6}
          markerEnd={`url(#${marker})`}
        />,
      )
    })
    return (
      <svg className="glinks" width={totalW} height={bodyH} style={{ overflow: 'visible' }}>
        <defs>
          <marker id="garrow" viewBox="0 0 10 10" refX={9} refY={5} markerWidth={6} markerHeight={6} orient="auto">
            <path d="M0,0 L10,5 L0,10 z" fill="#64748b" />
          </marker>
          <marker id="garrowC" viewBox="0 0 10 10" refX={9} refY={5} markerWidth={6} markerHeight={6} orient="auto">
            <path d="M0,0 L10,5 L0,10 z" fill="#dc2626" />
          </marker>
        </defs>
        {paths}
      </svg>
    )
  })()

  const dragProjection =
    drag && rows.some((r) => r.task.id === drag.id)
      ? projectBar(cal, drag.mode, drag, drag.delta)
      : null

  return (
    <section>
      <div className="toolbar">
        <div className="toolbar-left">
          <div className="seg">
            {(['day', 'week', 'month'] as ZoomLevel[]).map((z) => (
              <button
                key={z}
                type="button"
                className={zoom === z ? 'active' : ''}
                onClick={() => setUi({ zoom: z })}
              >
                {z === 'day' ? 'Hari' : z === 'week' ? 'Minggu' : 'Bulan'}
              </button>
            ))}
          </div>
          <label className="check">
            <input
              type="checkbox"
              checked={state.ui.showLinks}
              onChange={(e) => setUi({ showLinks: e.target.checked })}
            />
            Tampilkan panah keterkaitan
          </label>
        </div>
        <div className="toolbar-right">
          <button className="btn ghost" type="button" onClick={scrollToToday}>
            ▶ Hari Ini
          </button>
          <button className="btn primary" type="button" onClick={() => onOpenTask(null)}>
            + Tugas Baru
          </button>
        </div>
      </div>

      <div className={`card gantt-card`}>
        <div className={`gantt${drag ? ' dragging' : ''}`} ref={ganttRef}>
          {rows.length === 0 ? (
            <div className="empty" style={{ padding: '60px 20px' }}>
              <p>Tidak ada tugas untuk ditampilkan.</p>
            </div>
          ) : (
            <div className="gantt-inner">
              <div className="g-left">
                <div className="g-left-head">Tugas ({rows.length})</div>
                {rows.map((r) => {
                  const t = r.task
                  const s = sched.sched.get(t.id)
                  const prio = priorityOf(t.priority)
                  const collapsed = !!state.ui.collapsed[t.id]
                  return (
                    <div
                      key={t.id}
                      className={`g-row${r.summary ? ' summary' : ''}${s?.critical ? ' crit' : ''}`}
                      style={{ height: ROW_H, paddingLeft: 8 + r.depth * 16 }}
                      onClick={() => onOpenTask(t.id)}
                    >
                      {r.summary ? (
                        <button
                          type="button"
                          className="chev"
                          title="Buka/tutup sub-tugas"
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleCollapse(t.id)
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
                      <span className="g-name" title={t.name}>
                        {t.name}
                      </span>
                      <span className="g-dur">{s ? `${s.dur} hr` : '—'}</span>
                    </div>
                  )
                })}
              </div>

              <div className="g-right">
                <div className="g-head">
                  <div className="g-months" style={{ width: totalW }}>
                    {header.months.map((m, i) => (
                      <div className="g-month" key={i} style={{ width: m.width }}>
                        {m.label}
                      </div>
                    ))}
                  </div>
                  <div className="g-days" style={{ width: totalW }}>
                    {header.days.map((d, i) => {
                      const showNum = col >= 16 || (col >= 10 && d.n === 1)
                      return (
                        <div className={d.cls} key={i} style={{ width: col }}>
                          {showNum ? d.n : ''}
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div
                  className="g-body"
                  ref={bodyRef}
                  style={{ width: totalW, height: bodyH }}
                  onPointerLeave={() => setTip(null)}
                >
                  {shades}
                  {showToday && (
                    <div className="g-today" style={{ left: todayIdx * col }} />
                  )}
                  {linksSvg}

                  {rows.map((r, i) => {
                    const t = r.task
                    const s = sched.sched.get(t.id)
                    if (!s) return null
                    const dragging = drag?.id === t.id
                    const p = dragging && dragProjection ? dragProjection : null
                    const es = p ? p.start : s.es
                    const ef = p ? p.ef : s.ef
                    const x = idxOf(es) * col
                    const w = Math.max(4, (idxOf(ef) + 1) * col - x)
                    const h = r.summary ? 12 : 21
                    const top = i * ROW_H + Math.round((ROW_H - h) / 2)
                    const prio = priorityOf(t.priority)
                    const showLabel = w >= 74 && !r.summary
                    const cls = [
                      'gbar',
                      r.summary ? 'summary' : '',
                      s.critical ? 'critical' : '',
                      dragging ? (drag?.mode === 'move' ? 'moving' : 'resizing') : '',
                    ]
                      .filter(Boolean)
                      .join(' ')
                    return (
                      <div
                        key={t.id}
                        className={cls}
                        style={{
                          left: x,
                          width: w,
                          top,
                          height: h,
                          background: t.color || prio.color,
                        }}
                        onPointerDown={
                          r.summary
                            ? undefined
                            : (e) => startDrag(e, t, 'move')
                        }
                        onPointerMove={(e) => {
                          if (drag) return
                          const pad = 14
                          setTip({
                            x: Math.min(e.clientX + pad, window.innerWidth - 345),
                            y: Math.min(e.clientY + pad, window.innerHeight - 210),
                            task: t,
                          })
                        }}
                        onPointerLeave={() => setTip((old) => (old?.task.id === t.id ? null : old))}
                        onClick={r.summary ? () => onOpenTask(t.id) : undefined}
                        title={undefined}
                      >
                        {!r.summary && (
                          <>
                            <button
                              type="button"
                              className="handle l"
                              aria-label="Ubah tanggal mulai"
                              onPointerDown={(e) => {
                                e.stopPropagation()
                                startDrag(e, t, 'l')
                              }}
                            />
                            <button
                              type="button"
                              className="handle r"
                              aria-label="Ubah durasi"
                              onPointerDown={(e) => {
                                e.stopPropagation()
                                startDrag(e, t, 'r')
                              }}
                            />
                          </>
                        )}
                        {showLabel && <span className="gbar-label">{t.name}</span>}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="legend">
        <span className="lg-title">Legenda:</span>
        <span className="lg">
          <i className="lg-box" style={{ background: '#2563eb' }} /> Bar tugas
        </span>
        <span className="lg">
          <i className="lg-box lg-summary" /> Tugas ringkasan
        </span>
        <span className="lg">
          <i className="lg-box lg-critical" /> Jalur kritis
        </span>
        <span className="lg">
          <i className="lg-box lg-weekend" /> Akhir pekan / libur
        </span>
        <span className="lg">
          <i className="lg-line" /> Hari ini
        </span>
        <span className="lg">Seret bar untuk memindah · seret tepi bar untuk ubah durasi · klik untuk edit</span>
      </div>

      {tip && (
        <BarTooltip task={tip.task} state={state} sched={sched} x={tip.x} y={tip.y} />
      )}
    </section>
  )
}
