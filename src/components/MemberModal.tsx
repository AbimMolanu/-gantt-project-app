import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type { ProjectState } from '../types'
import { ROLES } from '../types'
import type { Schedule } from '../lib/scheduler'
import { addMember, deleteMember, updateMember } from '../lib/store'
import { notify } from '../lib/toast'
import { WORK_DAYS_PER_MONTH, memberMetrics } from '../lib/metrics'
import { fmtRp } from '../lib/format'

interface Props {
  state: ProjectState
  sched: Schedule
  memberId: string | null
  onClose: () => void
}

export default function MemberModal({ state, sched, memberId, onClose }: Props) {
  const existing = memberId ? state.members.find((m) => m.id === memberId) : undefined

  const [name, setName] = useState(existing?.name ?? '')
  const [email, setEmail] = useState(existing?.email ?? '')
  const [role, setRole] = useState(existing?.role ?? '')
  const [salary, setSalary] = useState(existing?.salary ?? 12000000)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const cleanName = name.trim()
    const cleanEmail = email.trim()
    if (!cleanName) {
      notify('Nama anggota wajib diisi', 'err')
      return
    }
    if (!cleanEmail) {
      notify('Email anggota wajib diisi', 'err')
      return
    }
    const payload = {
      name: cleanName,
      email: cleanEmail,
      role: role.trim(),
      salary: Math.max(0, Math.floor(Number(salary) || 0)),
    }
    if (existing) {
      updateMember(existing.id, payload)
      notify('Anggota diperbarui', 'ok')
    } else {
      addMember(payload)
      notify('Anggota ditambahkan', 'ok')
    }
    onClose()
  }

  const remove = () => {
    if (!existing) return
    if (!window.confirm(`Hapus anggota "${existing.name}"? Alokasinya ikut dihapus dari tugas.`)) return
    deleteMember(existing.id)
    notify(`Anggota "${existing.name}" dihapus`, 'ok')
    onClose()
  }

  const agg = existing ? memberMetrics(state.members, state.tasks, sched).get(existing.id) : undefined
  const assigned = existing ? state.tasks.filter((t) => t.members.includes(existing.id)).map((t) => t.name) : []

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="modal modal-sm" role="dialog" aria-modal="true" aria-label={existing ? 'Edit Anggota' : 'Tambah Anggota'}>
        <div className="modal-head">
          <h3>{existing ? 'Edit Anggota' : 'Tambah Anggota'}</h3>
          <button type="button" className="icon-btn" title="Tutup" onClick={onClose}>
            ✕
          </button>
        </div>

        <form onSubmit={submit}>
          <div className="modal-body">
            <div className="field">
              <label htmlFor="mName">Nama *</label>
              <input
                id="mName"
                type="text"
                required
                maxLength={80}
                placeholder="mis. Budi Santoso"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="field">
              <label htmlFor="mEmail">Email *</label>
              <input
                id="mEmail"
                type="email"
                required
                maxLength={100}
                placeholder="nama@perusahaan.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="mRole">Peran</label>
              <input
                id="mRole"
                type="text"
                list="roleList"
                maxLength={60}
                placeholder="mis. Frontend Developer"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              />
              <datalist id="roleList">
                {(ROLES as readonly string[]).map((r) => (
                  <option key={r} value={r} />
                ))}
              </datalist>
            </div>
            <div className="field">
              <label htmlFor="mSalary">Gaji per Bulan (Rp) *</label>
              <input
                id="mSalary"
                type="number"
                min={0}
                step={50000}
                required
                placeholder="12000000"
                value={salary}
                onChange={(e) => setSalary(Number(e.target.value))}
              />
              <p className="hint">
                Estimasi biaya harian = gaji ÷ {WORK_DAYS_PER_MONTH} hari kerja ={' '}
                <b>{fmtRp((Number(salary) || 0) / WORK_DAYS_PER_MONTH)}</b>
              </p>
            </div>

            {existing && (
              <p className="hint">
                Beban saat ini: <b>{agg?.days ?? 0} hari kerja</b> pada{' '}
                <b>{agg?.taskCount ?? 0} tugas</b>
                {assigned.length ? ` (${assigned.join(', ')})` : ''}
              </p>
            )}
          </div>

          <div className="modal-foot">
            {existing && (
              <button type="button" className="btn danger" onClick={remove}>
                Hapus
              </button>
            )}
            <span className="spacer" />
            <button type="button" className="btn ghost" onClick={onClose}>
              Batal
            </button>
            <button type="submit" className="btn primary">
              Simpan
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
