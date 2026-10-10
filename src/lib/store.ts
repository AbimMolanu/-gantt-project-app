/* ============================================================
   store.ts — Penyimpanan state proyek (localStorage) + aksi
   State reaktif memakai useSyncExternalStore (tanpa Redux).
   ============================================================ */
import { useSyncExternalStore } from 'react'
import type {
  CalendarConfig,
  Holiday,
  LinkType,
  Member,
  PriorityId,
  ProjectState,
  Task,
  UiState,
} from '../types'
import { priorityOf } from '../types'
import { createSeedState } from './seed'

const KEY = 'freebuff.pm.gantt.react.v1'

export function uid(prefix: string): string {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

/** Normalisasi/validasi data (dari localStorage atau impor JSON). */
export function normalizeState(obj: unknown): ProjectState {
  if (!isRecord(obj)) throw new Error('Format tidak valid')
  if (!Array.isArray(obj.tasks) || !Array.isArray(obj.members)) {
    throw new Error('Data tugas/anggota tidak valid')
  }
  const base = createSeedState()
  const proj = isRecord(obj.project) ? obj.project : {}
  const cal = isRecord(obj.calendar) ? obj.calendar : {}
  const uiRaw = isRecord(obj.ui) ? obj.ui : {}

  const rawTasks = obj.tasks as unknown[]
  const rawMembers = obj.members as unknown[]

  const out: ProjectState = {
    project: {
      name: typeof proj.name === 'string' && proj.name.trim() ? proj.name : base.project.name,
    },
    calendar: {
      weekendDays: Array.isArray(cal.weekendDays)
        ? (cal.weekendDays as unknown[]).map(Number).filter((n) => n >= 0 && n <= 6)
        : base.calendar.weekendDays,
      holidays: Array.isArray(cal.holidays)
        ? (cal.holidays as unknown[])
            .filter((h): h is Record<string, unknown> => isRecord(h) && !!h.date)
            .map((h) => ({
              id: typeof h.id === 'string' && h.id ? h.id : uid('h'),
              date: String(h.date),
              name: typeof h.name === 'string' && h.name ? h.name : 'Hari Libur',
            }))
        : [],
    },
    members: rawMembers.map((m) => {
      const mm = isRecord(m) ? m : {}
      return {
        id: typeof mm.id === 'string' && mm.id ? mm.id : uid('m'),
        name: String(mm.name || 'Tanpa Nama'),
        email: String(mm.email || ''),
        role: String(mm.role || ''),
        salary: Math.max(0, Number(mm.salary) || 0),
      } satisfies Member
    }),
    tasks: rawTasks.map((t0) => {
      const t = isRecord(t0) ? t0 : {}
      const prio = priorityOf(typeof t.priority === 'string' ? t.priority : undefined)
      return {
        id: typeof t.id === 'string' && t.id ? t.id : uid('t'),
        name: String(t.name || 'Tanpa Nama'),
        parentId: typeof t.parentId === 'string' && t.parentId ? t.parentId : null,
        start: typeof t.start === 'string' && t.start ? t.start : null,
        duration: Math.max(1, Math.floor(Number(t.duration) || 1)),
        priority: prio.id,
        color: typeof t.color === 'string' && t.color ? t.color : prio.color,
        preds: Array.isArray(t.preds)
          ? (t.preds as unknown[])
              .filter((p): p is Record<string, unknown> => isRecord(p) && !!p.taskId)
              .map((p) => ({
                taskId: String(p.taskId),
                type: (p.type === 'SS' ? 'SS' : 'FS') as LinkType,
                lag: Math.max(0, Math.floor(Number(p.lag) || 0)),
              }))
          : [],
        members: Array.isArray(t.members) ? (t.members as unknown[]).map(String) : [],
      } satisfies Task
    }),
    ui: {
      tab: (['tasks', 'gantt', 'resources', 'calendar', 'analysis'] as const).includes(
        uiRaw.tab as ProjectState['ui']['tab'],
      )
        ? (uiRaw.tab as UiState['tab'])
        : base.ui.tab,
      zoom: uiRaw.zoom === 'week' || uiRaw.zoom === 'month' ? uiRaw.zoom : 'day',
      collapsed: isRecord(uiRaw.collapsed)
        ? (Object.fromEntries(
            Object.entries(uiRaw.collapsed).filter(([, v]) => typeof v === 'boolean'),
          ) as Record<string, boolean>)
        : {},
      search: typeof uiRaw.search === 'string' ? uiRaw.search : '',
      critOnly: uiRaw.critOnly !== false,
      showLinks: uiRaw.showLinks !== false,
      calMonth: typeof uiRaw.calMonth === 'string' ? uiRaw.calMonth : '',
    },
  }

  // buang rujukan yang menggantung
  const ids = new Set(out.tasks.map((t) => t.id))
  out.tasks.forEach((t) => {
    if (t.parentId === t.id) t.parentId = null
    if (t.parentId && !ids.has(t.parentId)) t.parentId = null
    t.preds = t.preds.filter((p) => ids.has(p.taskId) && p.taskId !== t.id)
    t.members = t.members.filter((mid) => out.members.some((m) => m.id === mid))
  })
  return out
}

function loadState(): ProjectState {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return normalizeState(JSON.parse(raw))
  } catch {
    /* rusak → pakai data contoh */
  }
  return createSeedState()
}

let state: ProjectState = loadState()
const listeners = new Set<() => void>()

function persist(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    /* penuh/di-block */
  }
}

function commit(next: ProjectState): void {
  state = next
  persist()
  listeners.forEach((l) => l())
}

export function getState(): ProjectState {
  return state
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Hook utama: seluruh state proyek (perubahan apapun me-render ulang). */
export function useProject(): ProjectState {
  return useSyncExternalStore(subscribe, getState, getState)
}

function mutate(fn: (draft: ProjectState) => void): void {
  const next = structuredClone(state)
  fn(next)
  commit(next)
}

/* ------------------------- Aksi tugas ------------------------- */

export interface TaskInput {
  name: string
  parentId: string | null
  start: string | null
  duration: number
  priority: PriorityId
  color: string
  preds: Task['preds']
  members: string[]
}

export function addTask(input: TaskInput): string {
  const id = uid('t')
  mutate((d) => {
    d.tasks.push({ id, ...input })
  })
  return id
}

export function updateTask(id: string, patch: Partial<Task>): void {
  mutate((d) => {
    const t = d.tasks.find((x) => x.id === id)
    if (t) Object.assign(t, patch)
  })
}

export function deleteTask(id: string): number {
  let removed = 0
  mutate((d) => {
    const ids = new Set<string>([id])
    let grew = true
    while (grew) {
      grew = false
      d.tasks.forEach((t) => {
        if (t.parentId && ids.has(t.parentId) && !ids.has(t.id)) {
          ids.add(t.id)
          grew = true
        }
      })
    }
    removed = ids.size
    d.tasks = d.tasks.filter((t) => !ids.has(t.id))
    d.tasks.forEach((t) => {
      t.preds = t.preds.filter((p) => !ids.has(p.taskId))
    })
    ids.forEach((rid) => {
      delete d.ui.collapsed[rid]
    })
  })
  return removed
}

/* ------------------------- Aksi anggota ------------------------- */

export function addMember(input: Omit<Member, 'id'>): string {
  const id = uid('m')
  mutate((d) => {
    d.members.push({ id, ...input })
  })
  return id
}

export function updateMember(id: string, patch: Partial<Member>): void {
  mutate((d) => {
    const m = d.members.find((x) => x.id === id)
    if (m) Object.assign(m, patch)
  })
}

export function deleteMember(id: string): void {
  mutate((d) => {
    d.members = d.members.filter((m) => m.id !== id)
    d.tasks.forEach((t) => {
      t.members = t.members.filter((mid) => mid !== id)
    })
  })
}

/* ------------------------- Aksi kalender ------------------------- */

export function setWeekendDays(days: number[]): void {
  mutate((d) => {
    d.calendar.weekendDays = days.filter((n) => n >= 0 && n <= 6)
  })
}

export function addHoliday(date: string, name: string): void {
  mutate((d) => {
    const existing = d.calendar.holidays.find((h) => h.date === date)
    if (existing) {
      existing.name = name
      return
    }
    d.calendar.holidays.push({ id: uid('h'), date, name } satisfies Holiday)
    d.calendar.holidays.sort((a, b) => a.date.localeCompare(b.date))
  })
}

export function removeHoliday(id: string): void {
  mutate((d) => {
    d.calendar.holidays = d.calendar.holidays.filter((h) => h.id !== id)
  })
}

/* ------------------------- Aksi UI / proyek ------------------------- */

export function setUi(patch: Partial<UiState>): void {
  mutate((d) => {
    Object.assign(d.ui, patch)
  })
}

export function setCalendar(patch: Partial<CalendarConfig>): void {
  mutate((d) => {
    Object.assign(d.calendar, patch)
  })
}

export function renameProject(name: string): void {
  mutate((d) => {
    d.project.name = name
  })
}

export function resetDemo(): void {
  commit(createSeedState())
}

export function replaceState(obj: unknown): void {
  commit(normalizeState(obj))
}

export function exportState(): string {
  return JSON.stringify(state, null, 2)
}
