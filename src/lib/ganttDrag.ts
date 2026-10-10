/* ============================================================
   ganttDrag.ts — Proyeksi geometri bar Gantt saat drag/resize.
   Semua perhitungan dalam hari kerja (weekend + holiday dihormati).
   ============================================================ */
import type { CalendarConfig } from '../types'
import {
  addDays,
  cmp,
  countWorking,
  fwd,
  isWorking,
  nextWorking,
  prevWorking,
} from './calendar'

export type DragMode = 'move' | 'l' | 'r'

export interface BarBase {
  /** Mulai terjadwal (ES) bar saat drag dimulai. */
  es: Date
  /** Selesai terjadwal (EF) bar saat drag dimulai. */
  ef: Date
  /** Durasi (hari kerja) bar saat drag dimulai. */
  duration: number
}

export interface Projection {
  start: Date
  ef: Date
  duration: number
}

/**
 * Snap target ke hari kerja terdekat, searah gerakan drag:
 * geser ke depan → hari kerja berikutnya; geser ke belakang → hari kerja sebelumnya.
 */
function snapWorking(cal: CalendarConfig, target: Date, delta: number): Date {
  if (isWorking(cal, target)) return target
  return delta < 0 ? prevWorking(cal, target) : nextWorking(cal, target)
}

/**
 * Hitung posisi bar hasil drag/resize:
 * - 'move' : geser bar `delta` hari kalender, snap ke hari kerja, durasi tetap.
 * - 'r'    : ubah durasi — tepi kanan bergerak `delta` hari, durasi = jumlah hari kerja.
 * - 'l'    : ubah awal — tepi kiri bergerak `delta` hari, tepi kanan tetap, durasi menyesuaikan.
 */
export function projectBar(
  cal: CalendarConfig,
  mode: DragMode,
  base: BarBase,
  delta: number,
): Projection {
  if (mode === 'move') {
    const start = snapWorking(cal, addDays(base.es, delta), delta)
    return { start, ef: fwd(cal, start, base.duration - 1), duration: base.duration }
  }

  if (mode === 'r') {
    const target = addDays(base.ef, delta)
    // titik tujuan tidak boleh mundur melewati awal bar
    const end = cmp(target, base.es) < 0 ? base.es : target
    const duration = Math.max(1, countWorking(cal, base.es, end))
    return { start: base.es, ef: fwd(cal, base.es, duration - 1), duration }
  }

  // mode 'l': tepi kanan (ef) tetap, awal digeser lalu diklamping agar tidak melewati ef
  let start = snapWorking(cal, addDays(base.es, delta), delta)
  const maxStart = prevWorking(cal, base.ef)
  if (cmp(start, maxStart) > 0) start = maxStart
  const duration = Math.max(1, countWorking(cal, start, base.ef))
  return { start, ef: base.ef, duration }
}
