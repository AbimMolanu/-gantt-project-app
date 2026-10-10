import { describe, expect, it } from 'vitest'
import type { CalendarConfig } from '../types'
import { toISO } from './calendar'
import { projectBar } from './ganttDrag'

const cal: CalendarConfig = {
  weekendDays: [0, 6], // Sabtu & Minggu
  holidays: [{ id: 'h1', date: '2026-11-04', name: 'Hari Libur' }],
}

/** Senin 12 Okt 2026 → Selasa 13 Okt (2 hari kerja). */
const base = { es: new Date(2026, 9, 12), ef: new Date(2026, 9, 13), duration: 2 }

describe('projectBar — mode move', () => {
  it('menggeser bar sesuai delta hari kalender', () => {
    const p = projectBar(cal, 'move', base, 2) // Rab & Kam
    expect(toISO(p.start)).toBe('2026-10-14')
    expect(toISO(p.ef)).toBe('2026-10-15')
    expect(p.duration).toBe(2)
  })

  it('target jatuh di akhir pekan → snap ke hari kerja terdekat', () => {
    const p = projectBar(cal, 'move', base, 5) // target Sab 17 → Sen 19
    expect(toISO(p.start)).toBe('2026-10-19')
    expect(toISO(p.ef)).toBe('2026-10-20')
  })

  it('target jatuh di hari libur khusus → dilewati', () => {
    const b = { es: new Date(2026, 10, 2), ef: new Date(2026, 10, 3), duration: 2 } // Sen–Sel Nov
    const p = projectBar(cal, 'move', b, 2) // target Rab 4 Nov (libur) → Kam 5
    expect(toISO(p.start)).toBe('2026-11-05')
    expect(toISO(p.ef)).toBe('2026-11-06')
  })

  it('menggeser ke belakang tetap snap hari kerja', () => {
    const p = projectBar(cal, 'move', base, -1) // target Minggu 11 → Jumat 9
    expect(toISO(p.start)).toBe('2026-10-09')
    expect(toISO(p.ef)).toBe('2026-10-12')
  })
})

describe('projectBar — mode resize kanan (r)', () => {
  const b = { es: new Date(2026, 9, 16), ef: new Date(2026, 9, 19), duration: 2 } // Jum 16 → Sen 19

  it('durasi = jumlah hari kerja antara ES dan titik tujuan', () => {
    const p = projectBar(cal, 'r', b, 1) // tarik ke Sel 20
    expect(p.duration).toBe(3)
    expect(toISO(p.ef)).toBe('2026-10-20')
    expect(toISO(p.start)).toBe('2026-10-16') // sisi kiri tetap
  })

  it('menghitung hari kerja saja saat titik tujuan melewati akhir pekan', () => {
    const p = projectBar(cal, 'r', b, 5) // tujuan Sab 24 → efisien Jum 23
    expect(p.duration).toBe(6) // Jum, Sen–Jum
    expect(toISO(p.ef)).toBe('2026-10-23')
  })

  it('menyusut tetap minimal 1 hari kerja', () => {
    const p = projectBar(cal, 'r', b, -3) // tujuan Jum 16
    expect(p.duration).toBe(1)
    expect(toISO(p.ef)).toBe('2026-10-16')
    const p2 = projectBar(cal, 'r', b, -99) // jauh sebelum mulai
    expect(p2.duration).toBe(1)
  })
})

describe('projectBar — mode resize kiri (l)', () => {
  const b = { es: new Date(2026, 9, 12), ef: new Date(2026, 9, 13), duration: 2 } // Sen 12 → Sel 13

  it('menggeser awal ke kiri, tepi kanan tetap, durasi menyesuaikan', () => {
    const p = projectBar(cal, 'l', b, -3) // geser ke Jum 9
    expect(toISO(p.start)).toBe('2026-10-09')
    expect(toISO(p.ef)).toBe('2026-10-13')
    expect(p.duration).toBe(3) // Jum, Sen, Sel
  })

  it('diklamping agar tidak melewati tepi kanan', () => {
    const p = projectBar(cal, 'l', b, 5) // target melewati ef
    expect(toISO(p.start)).toBe('2026-10-13')
    expect(toISO(p.ef)).toBe('2026-10-13')
    expect(p.duration).toBe(1)
  })

  it('target jatuh di akhir pekan saat geser ke kiri → snap ke hari kerja sebelumnya', () => {
    const p = projectBar(cal, 'l', b, -1) // target Minggu 11 → Jumat 9
    expect(toISO(p.start)).toBe('2026-10-09')
    expect(toISO(p.ef)).toBe('2026-10-13') // tepi kanan tetap
    expect(p.duration).toBe(3) // Jum, Sen, Sel
  })
})
