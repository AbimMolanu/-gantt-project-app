// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import App from './App'
import { getState, setUi } from './lib/store'

afterEach(cleanup)
beforeEach(() => setUi({ tab: 'tasks' }))

describe('App (smoke)', () => {
  it('merender topbar, stats, dan daftar tugas dari seed data', () => {
    const { container } = render(<App />)
    expect(screen.getByText(/Manajemen Proyek/)).toBeTruthy()
    expect(screen.getByText('Perencanaan Proyek')).toBeTruthy()
    expect(screen.getByText('Definisi Ruang Lingkup')).toBeTruthy()
    expect(screen.getByText('Peluncuran & Serah Terima')).toBeTruthy()
    expect(container.querySelectorAll('tbody tr.task-row').length).toBeGreaterThan(10)
    // stats bar
    expect(screen.getByText('Durasi Proyek')).toBeTruthy()
    expect(screen.getByText('Jalur Kritis')).toBeTruthy()
  })

  it('tab Gantt menampilkan bar tugas dan panah dependensi', () => {
    const { container } = render(<App />)
    fireEvent.click(screen.getByText('📊 Gantt Chart'))
    expect(screen.getByText(/Tugas \(\d+\)/)).toBeTruthy()
    const bars = container.querySelectorAll('.gbar')
    expect(bars.length).toBeGreaterThan(10)
    expect(container.querySelectorAll('.glinks path').length).toBeGreaterThan(5)
    expect(container.querySelectorAll('.g-shade').length).toBeGreaterThan(3)
    // bar ringkasan + handle drag/resize
    expect(container.querySelectorAll('.gbar.summary').length).toBeGreaterThan(0)
    expect(container.querySelectorAll('.gbar .handle').length).toBeGreaterThan(0)
  })

  it('tab Analisis menampilkan tabel CPM jalur kritis dan diagram PERT', () => {
    const { container } = render(<App />)
    fireEvent.click(screen.getByText('📈 Analisis'))
    expect(screen.getByText('Analisis Jalur Kritis & CPM')).toBeTruthy()
    expect(screen.getByText('Diagram PERT')).toBeTruthy()
    expect(screen.getAllByText('★ Kritis').length).toBeGreaterThan(0)
    const pertNodes = container.querySelectorAll('.pert-wrap svg g')
    expect(pertNodes.length).toBeGreaterThan(10)
  })

  it('tab Kalender menampilkan pengaturan akhir pekan & hari libur', () => {
    render(<App />)
    fireEvent.click(screen.getByText('🗓️ Kalender'))
    expect(screen.getByText('Pengaturan Akhir Pekan')).toBeTruthy()
    expect(screen.getByText('Hari Natal')).toBeTruthy()
    const fri = screen.getByLabelText('Jumat') as HTMLInputElement
    expect(fri.checked).toBe(false)
    fireEvent.click(fri)
    expect(fri.checked).toBe(true)
  })

  it('tab Sumber Daya menampilkan anggota dan beban kerja', () => {
    render(<App />)
    fireEvent.click(screen.getByText('👥 Sumber Daya'))
    expect(screen.getAllByText('Budi Santoso').length).toBeGreaterThan(0)
    expect(screen.getByText('budi@perusahaan.com')).toBeTruthy()
    expect(screen.getAllByText(/Estimasi Biaya/).length).toBeGreaterThan(0)
  })

  it('CRUD tugas: menambah tugas baru tersimpan ke localStorage', () => {
    render(<App />)
    fireEvent.click(screen.getByText('+ Tugas Baru'))
    fireEvent.change(screen.getByLabelText('Nama Tugas *'), {
      target: { value: 'Tugas Smoke Test' },
    })
    fireEvent.change(screen.getByLabelText('Durasi (hari kerja) *'), {
      target: { value: '4' },
    })
    fireEvent.click(screen.getByText('Simpan'))

    expect(screen.getByText('Tugas Smoke Test')).toBeTruthy()
    const stored = JSON.parse(localStorage.getItem('freebuff.pm.gantt.react.v1') ?? '{}')
    expect(stored.tasks.some((t: { name: string }) => t.name === 'Tugas Smoke Test')).toBe(true)
    expect(getState().tasks.some((t) => t.name === 'Tugas Smoke Test')).toBe(true)
  })
})
