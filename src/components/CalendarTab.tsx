import { useState } from 'react'
import type { FormEvent } from 'react'
import type { ProjectState } from '../types'
import { addHoliday, removeHoliday, setUi, setWeekendDays } from '../lib/store'
import { notify } from '../lib/toast'
import { addDays, cmp, isHoliday, isWorking, monthTitle, toISO, today } from '../lib/calendar'

interface Props {
  state: ProjectState
}

const DAY_LABELS: { value: number; label: string }[] = [
  { value: 1, label: 'Senin' },
  { value: 2, label: 'Selasa' },
  { value: 3, label: 'Rabu' },
  { value: 4, label: 'Kamis' },
  { value: 5, label: 'Jumat' },
  { value: 6, label: 'Sabtu' },
  { value: 0, label: 'Minggu' },
]

const WEEKDAY_HEAD = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']

export default function CalendarTab({ state }: Props) {
  const cal = state.calendar
  const [hDate, setHDate] = useState('')
  const [hName, setHName] = useState('')

  const toggleWeekend = (value: number) => {
    const next = cal.weekendDays.includes(value)
      ? cal.weekendDays.filter((d) => d !== value)
      : [...cal.weekendDays, value]
    setWeekendDays(next)
  }

  const submitHoliday = (e: FormEvent) => {
    e.preventDefault()
    if (!hDate || !hName.trim()) {
      notify('Tanggal dan nama hari libur wajib diisi', 'err')
      return
    }
    addHoliday(hDate, hName.trim())
    notify(`Hari libur ditambahkan: ${hName.trim()}`, 'ok')
    setHDate('')
    setHName('')
  }

  /* ---------- pratinjau bulan ---------- */
  const ym = state.ui.calMonth || toISO(today()).slice(0, 7)
  const [year, month] = ym.split('-').map(Number)
  const firstOfMonth = new Date(year, month - 1, 1)
  const gridStart = addDays(firstOfMonth, -((firstOfMonth.getDay() + 6) % 7)) // Senin terdekat

  const shiftMonth = (delta: number) => {
    const d = new Date(year, month - 1 + delta, 1)
    setUi({
      calMonth: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
    })
  }

  const now = today()
  const cells = []
  for (let i = 0; i < 42; i++) {
    const d = addDays(gridStart, i)
    const iso = toISO(d)
    const holiday = isHoliday(cal, d)
    const muted = d.getMonth() + 1 !== month
    const cls = [
      'cal-cell',
      muted ? 'muted' : '',
      holiday ? 'holiday' : !isWorking(cal, d) ? 'weekend' : '',
      cmp(d, now) === 0 ? 'today' : '',
    ]
      .filter(Boolean)
      .join(' ')
    cells.push(
      <div className={cls} key={iso}>
        <span className="d">{d.getDate()}</span>
        {holiday && <div className="hn">{holiday.name}</div>}
        {!holiday && !muted && !isWorking(cal, d) && cal.weekendDays.includes(d.getDay()) && (
          <div className="hn">Akhir pekan</div>
        )}
      </div>,
    )
  }

  const holidays = [...cal.holidays].sort((a, b) => a.date.localeCompare(b.date))

  return (
    <section>
      <div className="grid-2">
        <div className="card">
          <div className="card-head">
            <h3>Pengaturan Akhir Pekan</h3>
          </div>
          <div className="weekend-checks">
            {DAY_LABELS.map((d) => {
              const on = cal.weekendDays.includes(d.value)
              return (
                <label className={`wday${on ? ' on' : ''}`} key={d.value}>
                  <input type="checkbox" checked={on} onChange={() => toggleWeekend(d.value)} />
                  {d.label}
                </label>
              )
            })}
          </div>
          <p className="hint">
            Hari yang dicentang dianggap <b>bukan hari kerja</b>. Durasi tugas, jeda (lag), dan jalur
            kritis dihitung berdasarkan pengaturan ini.
          </p>
        </div>

        <div className="card">
          <div className="card-head">
            <h3>Hari Libur Khusus</h3>
          </div>
          <form className="inline-form" onSubmit={submitHoliday}>
            <input type="date" value={hDate} onChange={(e) => setHDate(e.target.value)} required />
            <input
              type="text"
              placeholder="Nama hari libur (mis. Hari Natal)"
              maxLength={60}
              value={hName}
              onChange={(e) => setHName(e.target.value)}
              required
            />
            <button type="submit" className="btn primary">
              Tambah
            </button>
          </form>
          <ul className="holiday-list">
            {holidays.map((h) => (
              <li key={h.id}>
                <span className="h-date">{h.date}</span>
                <span className="h-name">{h.name}</span>
                <button
                  type="button"
                  className="row-btn del"
                  title="Hapus hari libur"
                  onClick={() => {
                    removeHoliday(h.id)
                    notify(`Hari libur "${h.name}" dihapus`, 'ok')
                  }}
                >
                  🗑
                </button>
              </li>
            ))}
            {holidays.length === 0 && (
              <li style={{ justifyContent: 'center', color: 'var(--ink-3)' }}>Belum ada hari libur khusus.</li>
            )}
          </ul>
        </div>
      </div>

      <div className="card">
        <div className="cal-head">
          <button className="btn ghost small" type="button" onClick={() => shiftMonth(-1)}>
            ‹ Sebelumnya
          </button>
          <h3>{monthTitle(ym)}</h3>
          <button className="btn ghost small" type="button" onClick={() => shiftMonth(1)}>
            Berikutnya ›
          </button>
        </div>
        <div className="cal-weekdays">
          {WEEKDAY_HEAD.map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>
        <div className="cal-grid">{cells}</div>
        <p className="hint">
          Sel merah muda = akhir pekan · Sel biru = hari libur khusus · Garis = hari ini · Hari kerja
          yang aktif: <b>{7 - cal.weekendDays.length}</b> hari per minggu
        </p>
      </div>
    </section>
  )
}
