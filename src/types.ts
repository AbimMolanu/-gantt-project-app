/* Tipe data inti aplikasi Manajemen Proyek — Gantt Chart */

export type PriorityId = 'low' | 'medium' | 'high'
export type LinkType = 'FS' | 'SS'
export type ZoomLevel = 'day' | 'week' | 'month'
export type TabId = 'tasks' | 'gantt' | 'resources' | 'calendar' | 'analysis'

/** Hubungan antar tugas: pendahulu + tipe (Finish-to-Start / Start-to-Start) + jeda hari (lag). */
export interface Predecessor {
  taskId: string
  type: LinkType
  /** Jeda hari kalender setelah aturan FS/SS diterapkan. */
  lag: number
}

export interface Task {
  id: string
  name: string
  parentId: string | null
  /** Tanggal mulai efisien paling awal (bukan hari kerja → digeser otomatis). */
  start: string | null
  /** Durasi dalam hari kerja. */
  duration: number
  priority: PriorityId
  color: string
  preds: Predecessor[]
  /** Id anggota yang dialokasikan ke tugas ini. */
  members: string[]
}

export interface Member {
  id: string
  name: string
  email: string
  role: string
  salary: number
}

export interface Holiday {
  id: string
  date: string
  name: string
}

export interface CalendarConfig {
  /** 0 = Minggu … 6 = Sabtu. Hari yang dicentang BUKAN hari kerja. */
  weekendDays: number[]
  holidays: Holiday[]
}

export interface UiState {
  tab: TabId
  zoom: ZoomLevel
  collapsed: Record<string, boolean>
  search: string
  critOnly: boolean
  showLinks: boolean
  calMonth: string
}

export interface ProjectState {
  project: { name: string }
  calendar: CalendarConfig
  members: Member[]
  tasks: Task[]
  ui: UiState
}

export interface PriorityDef {
  id: PriorityId
  label: string
  color: string
}

export const PRIORITIES: PriorityDef[] = [
  { id: 'low', label: 'Low', color: '#16a34a' },
  { id: 'medium', label: 'Medium', color: '#2563eb' },
  { id: 'high', label: 'High', color: '#ea580c' },
]

export const ROLES = [
  'Project Manager',
  'Analis Bisnis',
  'UI/UX Designer',
  'Frontend Developer',
  'Backend Developer',
  'Fullstack Developer',
  'QA Engineer',
  'DevOps Engineer',
  'Database Administrator',
]

export const AVATAR_COLORS = [
  '#6366f1', '#0ea5e9', '#14b8a6', '#f59e0b', '#ec4899',
  '#8b5cf6', '#22c55e', '#ef4444', '#f97316', '#3b82f6',
]

export function priorityOf(id: PriorityId | string | undefined): PriorityDef {
  return PRIORITIES.find((p) => p.id === id) ?? PRIORITIES[1]
}
