import { describe, expect, it } from 'vitest'
import type { CalendarConfig, Predecessor, Task } from '../types'
import { toISO } from './calendar'
import { computeSchedule } from './scheduler'

const cal: CalendarConfig = {
  weekendDays: [0, 6],
  holidays: [{ id: 'h1', date: '2026-11-04', name: 'Hari Libur' }],
}

let seq = 0
function T(patch: Partial<Task> & { id: string }): Task {
  seq++
  return {
    name: patch.id,
    parentId: null,
    start: '2026-10-12', // Senin
    duration: 1,
    priority: 'medium',
    color: '#2563eb',
    preds: [],
    members: [],
    ...patch,
  }
}

function P(taskId: string, type: Predecessor['type'], lag = 0): Predecessor {
  return { taskId, type, lag }
}

describe('forward pass (FS / SS + lag)', () => {
  it('FS: pendahulu mendorong successor ke hari kerja berikutnya', () => {
    const tasks = [
      T({ id: 'a', duration: 2 }), // Sen–Sel
      T({ id: 'b', duration: 2, preds: [P('a', 'FS', 0)] }),
    ]
    const s = computeSchedule(tasks, cal)
    expect(toISO(s.sched.get('a')!.es)).toBe('2026-10-12')
    expect(toISO(s.sched.get('a')!.ef)).toBe('2026-10-13')
    expect(toISO(s.sched.get('b')!.es)).toBe('2026-10-14') // Rab
    expect(toISO(s.sched.get('b')!.ef)).toBe('2026-10-15') // Kam
  })

  it('FS + lag menambah hari kerja jeda', () => {
    const tasks = [
      T({ id: 'a', duration: 2 }),
      T({ id: 'b', duration: 1, preds: [P('a', 'FS', 2)] }),
    ]
    const s = computeSchedule(tasks, cal)
    // a.ef = Sel 13 → +3 hari kerja = Jum 16
    expect(toISO(s.sched.get('b')!.es)).toBe('2026-10-16')
  })

  it('SS: successor mulai setelah start pendahulu + lag', () => {
    const tasks = [
      T({ id: 'a', duration: 5 }),
      T({ id: 'b', duration: 3, preds: [P('a', 'SS', 1)] }),
    ]
    const s = computeSchedule(tasks, cal)
    expect(toISO(s.sched.get('b')!.es)).toBe('2026-10-13') // Sel
    expect(toISO(s.sched.get('a')!.ef)).toBe('2026-10-16') // Jum
    expect(toISO(s.sched.get('b')!.ef)).toBe('2026-10-15') // Kam
  })

  it('tanggal mulai manual tetap menjadi batas bawah (bila pendahulu lebih awal)', () => {
    const tasks = [
      T({ id: 'a', duration: 1 }), // Sen 12
      T({ id: 'b', duration: 2, start: '2026-10-14', preds: [P('a', 'FS', 0)] }),
    ]
    const s = computeSchedule(tasks, cal)
    expect(toISO(s.sched.get('b')!.es)).toBe('2026-10-14') // manual > Sabtanya a
  })

  it('durasi dihitung dalam hari kerja (akhir pekan dilewati)', () => {
    const tasks = [T({ id: 'a', start: '2026-10-16', duration: 3 })] // Jumat, 3 hari kerja
    const s = computeSchedule(tasks, cal)
    expect(toISO(s.sched.get('a')!.es)).toBe('2026-10-16')
    expect(toISO(s.sched.get('a')!.ef)).toBe('2026-10-20') // Sel (lewati Sab/Ming)
  })

  it('hari libur khusus tidak dihitung sebagai hari kerja', () => {
    const tasks = [T({ id: 'a', start: '2026-11-03', duration: 2 })] // Selasa, +1 = 5 Nov
    const s = computeSchedule(tasks, cal)
    expect(toISO(s.sched.get('a')!.ef)).toBe('2026-11-05')
  })
})

describe('critical path (backward pass)', () => {
  it('rantai utama kritis (float 0), tugas pendek punya float', () => {
    const tasks = [
      T({ id: 'a', duration: 2 }),
      T({ id: 'b', duration: 2, preds: [P('a', 'FS', 0)] }),
      T({ id: 'e', start: '2026-10-12', duration: 1 }), // menggantung, cepat selesai
    ]
    const s = computeSchedule(tasks, cal)
    expect(s.sched.get('a')!.float).toBe(0)
    expect(s.sched.get('b')!.float).toBe(0)
    expect(s.sched.get('e')!.float).toBeGreaterThan(0)
    expect(s.criticalIds['a']).toBe(true)
    expect(s.criticalIds['b']).toBe(true)
    expect(s.criticalIds['e']).toBeUndefined()
    expect(s.criticalCount).toBe(2)
  })

  it('LS/LF tidak melewati finish proyek dan float = hari kerja', () => {
    const tasks = [
      T({ id: 'a', duration: 2 }),
      T({ id: 'b', duration: 2, preds: [P('a', 'FS', 0)] }),
    ]
    const s = computeSchedule(tasks, cal)
    expect(s.project.start).toBe('2026-10-12')
    expect(s.project.finish).toBe('2026-10-15')
    expect(s.project.duration).toBe(4)
    const b = s.sched.get('b')!
    expect(toISO(b.ls!)).toBe('2026-10-14')
    expect(toISO(b.lf!)).toBe('2026-10-15')
  })

  it('lintasan terpanjang (bukan yang pertama) menjadi jalur kritis', () => {
    const tasks = [
      // jalur pendek: x (1 hari)
      T({ id: 'x', duration: 1 }),
      // jalur panjang: y (4 hari) → z (2 hari)
      T({ id: 'y', start: '2026-10-12', duration: 4 }),
      T({ id: 'z', duration: 2, preds: [P('y', 'FS', 0)] }),
    ]
    const s = computeSchedule(tasks, cal)
    expect(s.criticalIds['y']).toBe(true)
    expect(s.criticalIds['z']).toBe(true)
    expect(s.criticalIds['x']).toBeUndefined()
  })
})

describe('hierarki (rollup sub-tugas)', () => {
  it('tugas induk mewarili ES/EF dari sub-tugas', () => {
    const tasks = [
      T({ id: 'p', parentId: null, duration: 1 }),
      T({ id: 'c1', parentId: 'p', start: '2026-10-12', duration: 2 }), // Sen–Sel
      T({ id: 'c2', parentId: 'p', start: '2026-10-15', duration: 2 }), // Kam–Jum
    ]
    const s = computeSchedule(tasks, cal)
    const parent = s.sched.get('p')!
    expect(parent.summary).toBe(true)
    expect(toISO(parent.es)).toBe('2026-10-12')
    expect(toISO(parent.ef)).toBe('2026-10-16')
    expect(parent.dur).toBe(5)
  })

  it('pendahulu berupa induk tidak menyebabkan siklus hierarki', () => {
    const tasks = [
      T({ id: 'p', parentId: null, duration: 1 }),
      T({ id: 'c', parentId: 'p', start: '2026-10-12', duration: 2 }),
      // induk dari 'c' tidak boleh jadi pendahulu 'c' (dihiraukan)
      T({ id: 'd', start: '2026-10-12', preds: [P('p', 'FS', 0)] }),
    ]
    const s = computeSchedule(tasks, cal)
    expect(s.ok).toBe(true)
    // p (ringkasan) ef = Sel 13 → d didorong ke Rab 14, bukan Senin manualnya
    expect(toISO(s.sched.get('d')!.es)).toBe('2026-10-14')
  })
})

describe('siklus dependensi', () => {
  it('mendeteksi siklus tanpa infinite loop', () => {
    const tasks = [
      T({ id: 'a', preds: [P('b', 'FS', 0)] }),
      T({ id: 'b', preds: [P('a', 'FS', 0)] }),
    ]
    const s = computeSchedule(tasks, cal)
    expect(s.ok).toBe(false)
    expect(s.cycleIds.length).toBeGreaterThan(0)
    expect(s.sched.size).toBe(2) // tetap menghasilkan jadwal fallback
  })
})
