import { describe, expect, it } from 'vitest'
import type { CalendarConfig } from '../types'
import { back, cmp, countWorking, daySpan, fwd, fromISO, isWorking, nextWorking, prevWorking, toISO } from './calendar'

const cal: CalendarConfig = {
  weekendDays: [0, 6], // Sabtu & Minggu
  holidays: [{ id: 'h1', date: '2026-11-04', name: 'Hari Libur' }],
}

describe('isWorking', () => {
  it('menganggap Senin–Jumat sebagai hari kerja', () => {
    expect(isWorking(cal, '2026-10-12')).toBe(true) // Senin
    expect(isWorking(cal, '2026-10-16')).toBe(true) // Jumat
  })

  it('menganggap akhir pekan sebagai bukan hari kerja', () => {
    expect(isWorking(cal, '2026-10-17')).toBe(false) // Sabtu
    expect(isWorking(cal, '2026-10-18')).toBe(false) // Minggu
  })

  it('menganggap hari libur khusus sebagai bukan hari kerja', () => {
    expect(isWorking(cal, '2026-11-04')).toBe(false) // Rabu, hari libur
    expect(isWorking(cal, '2026-11-05')).toBe(true) // Kamis
  })
})

describe('nextWorking / prevWorking', () => {
  it('meloncati Sabtu & Minggu ke hari kerja terdekat', () => {
    expect(toISO(nextWorking(cal, '2026-10-17'))).toBe('2026-10-19')
    expect(toISO(prevWorking(cal, '2026-10-17'))).toBe('2026-10-16')
  })

  it('meloncati hari libur khusus', () => {
    expect(toISO(nextWorking(cal, '2026-11-04'))).toBe('2026-11-05')
    expect(toISO(prevWorking(cal, '2026-11-04'))).toBe('2026-11-03')
  })
})

describe('fwd / back (durasi hari kerja)', () => {
  it('n = 0 mengembalikan hari kerja terdekat', () => {
    expect(toISO(fwd(cal, '2026-10-16', 0))).toBe('2026-10-16')
    expect(toISO(fwd(cal, '2026-10-17', 0))).toBe('2026-10-19')
  })

  it('maju n hari kerja melewati akhir pekan', () => {
    expect(toISO(fwd(cal, '2026-10-16', 1))).toBe('2026-10-19') // Jumat + 1 = Senin
    expect(toISO(fwd(cal, '2026-10-16', 2))).toBe('2026-10-20')
  })

  it('maju melewati hari libur khusus', () => {
    expect(toISO(fwd(cal, '2026-11-03', 1))).toBe('2026-11-05') // lewati 4 Nov
  })

  it('mundur n hari kerja melewati akhir pekan', () => {
    expect(toISO(back(cal, '2026-10-19', 1))).toBe('2026-10-16') // Senin − 1 = Jumat
    expect(toISO(back(cal, '2026-10-19', 3))).toBe('2026-10-14') // Sen,Jum,Kam,Rab
  })
})

describe('countWorking', () => {
  it('menghitung hari kerja inklusif', () => {
    expect(countWorking(cal, '2026-10-12', '2026-10-16')).toBe(5)
    expect(countWorking(cal, '2026-10-16', '2026-10-20')).toBe(3) // Jum, Sen, Sel
  })

  it('tidak terpengaruh urutan argumen', () => {
    expect(countWorking(cal, '2026-10-20', '2026-10-16')).toBe(3)
  })

  it('tidak menghitung hari libur khusus', () => {
    expect(countWorking(cal, '2026-11-02', '2026-11-06')).toBe(4) // Sen,Sel,Kam,Jum
  })
})

describe('util tanggal', () => {
  it('roundtrip toISO/fromISO', () => {
    expect(toISO(fromISO('2026-10-12'))).toBe('2026-10-12')
  })

  it('cmp membandingkan hari kalender', () => {
    expect(cmp('2026-10-13', '2026-10-12')).toBe(1)
    expect(cmp('2026-10-12', '2026-10-12')).toBe(0)
    expect(cmp('2026-10-11', '2026-10-12')).toBe(-1)
  })

  it('daySpan menghitung jarak hari kalender', () => {
    expect(daySpan('2026-10-12', '2026-10-20')).toBe(8)
  })
})
