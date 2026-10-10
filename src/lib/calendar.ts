/* ============================================================
   calendar.ts — Utilitas tanggal & kalender kerja
   (akhir pekan + hari libur khusus)
   Semua tanggal ditangani sebagai Date lokal / string 'YYYY-MM-DD'
   ============================================================ */
import type { CalendarConfig, Holiday } from '../types'

const DAY = 86400000
const GUARD = 36500 // batas iterasi agar tidak pernah loop tanpa henti

export const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
export const MONTHS_LONG = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]
export const DAY_NAMES_SHORT = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']

export function toDate(x: Date | string): Date {
  if (x instanceof Date) return new Date(x.getFullYear(), x.getMonth(), x.getDate())
  return fromISO(x)
}

export function toISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function fromISO(s: string | null | undefined): Date {
  const p = String(s || '').split('-').map(Number)
  if (p.length < 3 || !p[0] || !p[1] || !p[2]) return today()
  return new Date(p[0], p[1] - 1, p[2])
}

export function addDays(d: Date | string, n: number): Date {
  const x = toDate(d)
  x.setDate(x.getDate() + n)
  return x
}

export function today(): Date {
  const t = new Date()
  return new Date(t.getFullYear(), t.getMonth(), t.getDate())
}

/** Nomor hari absolut (bebas DST). */
export function dayNumber(d: Date | string): number {
  const x = toDate(d)
  return Math.round(Date.UTC(x.getFullYear(), x.getMonth(), x.getDate()) / DAY)
}

export function cmp(a: Date | string, b: Date | string): number {
  return dayNumber(a) - dayNumber(b)
}

export function isHoliday(cal: CalendarConfig, d: Date | string): Holiday | null {
  const iso = toISO(toDate(d))
  return cal.holidays.find((h) => h.date === iso) ?? null
}

export function isWorking(cal: CalendarConfig, d: Date | string): boolean {
  const x = toDate(d)
  if (cal.weekendDays.includes(x.getDay())) return false
  if (isHoliday(cal, x)) return false
  return true
}

export function nextWorking(cal: CalendarConfig, d: Date | string): Date {
  let x = toDate(d)
  for (let i = 0; i < GUARD; i++) {
    if (isWorking(cal, x)) return x
    x = addDays(x, 1)
  }
  return toDate(d)
}

export function prevWorking(cal: CalendarConfig, d: Date | string): Date {
  let x = toDate(d)
  for (let i = 0; i < GUARD; i++) {
    if (isWorking(cal, x)) return x
    x = addDays(x, -1)
  }
  return toDate(d)
}

/** n-hari-kerja ke depan: 0 = hari kerja pertama >= d, 1 = hari kerja berikutnya, dst. */
export function fwd(cal: CalendarConfig, d: Date | string, n: number): Date {
  let x = nextWorking(cal, d)
  const steps = Math.max(0, Math.floor(n || 0))
  let count = 0
  while (count < steps) {
    x = nextWorking(cal, addDays(x, 1))
    count++
    if (count > GUARD) break
  }
  return x
}

/** n-hari-kerja ke belakang: 0 = hari kerja terakhir <= d, dst. */
export function back(cal: CalendarConfig, d: Date | string, n: number): Date {
  let x = prevWorking(cal, d)
  const steps = Math.max(0, Math.floor(n || 0))
  let count = 0
  while (count < steps) {
    x = prevWorking(cal, addDays(x, -1))
    count++
    if (count > GUARD) break
  }
  return x
}

/** Jumlah hari kerja inklusif antara a..b. */
export function countWorking(cal: CalendarConfig, a: Date | string, b: Date | string): number {
  let from = toDate(a)
  let to = toDate(b)
  if (cmp(from, to) > 0) {
    const t = from
    from = to
    to = t
  }
  let c = 0
  let x = from
  let i = 0
  while (cmp(x, to) <= 0 && i < GUARD) {
    if (isWorking(cal, x)) c++
    x = addDays(x, 1)
    i++
  }
  return c
}

/** Jumlah hari kalender (untuk lebar bar timeline). */
export function daySpan(a: Date | string, b: Date | string): number {
  return dayNumber(b) - dayNumber(a)
}

export function fmtDate(x: Date | string | null | undefined): string {
  if (!x) return '—'
  const d = toDate(x)
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`
}

export function fmtShort(x: Date | string | null | undefined): string {
  if (!x) return '—'
  const d = toDate(x)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function fmtLong(x: Date | string | null | undefined): string {
  if (!x) return '—'
  const d = toDate(x)
  return `${d.getDate()} ${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}`
}

/** Judul bulan dari string 'YYYY-MM'. */
export function monthTitle(ym: string): string {
  const p = String(ym).split('-').map(Number)
  return `${MONTHS_LONG[(p[1] || 1) - 1]} ${p[0]}`
}
