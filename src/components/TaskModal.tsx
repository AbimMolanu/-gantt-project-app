import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type { Predecessor, PriorityId, ProjectState, Task } from '../types'
import { priorityOf } from '../types'
import type { Schedule } from '../lib/scheduler'
import { addTask, deleteTask, updateTask } from '../lib/store'
import { childrenOf, findTask } from '../lib/tree'
import { toISO, today } from '../lib/calendar'
import { notify } from '../lib/toast'

interface Props {
  state: ProjectState
  sched: Schedule
  taskId: string | null
  onClose: () => void
}

/** Kandidat induk/pendahulu: seluruh tugas kecuali diri sendiri & leluhurnya (anti-siklus). */
function candidateOptions(state: ProjectState, selfId: string | null): Task[] {
  if (!selfId) return state.tasks
  return state.tasks.filter((t) => {
    if (t.id === selfId) return false
    let cur: Task | undefined = t
    let guard = 0
    while (cur && guard++ < 1000) {
      if (cur.id === selfId) return false
      cur = cur.parentId ? findTask(state.tasks, cur.parentId) : undefined
    }
    return true
  })
}

export default function TaskModal({ state, sched, taskId, onClose }: Props) {
  const existing = taskId ? findTask(state.tasks, taskId) : undefined
  const isSummary = existing ? childrenOf(state.tasks, existing.id).length > 0 : false

  const [name, setName] = useState(existing?.name ?? '')
  const [parentId, setParentId] = useState(existing?.parentId ?? '')
  const [start, setStart] = useState(existing?.start ?? toISO(today()))
  const [duration, setDuration] = useState(existing?.duration ?? 1)
  const [priority, setPriority] = useState<PriorityId>(existing?.priority ?? 'medium')
  const [color, setColor] = useState(existing?.color ?? priorityOf(existing?.priority ?? 'medium').color)
  const [preds, setPreds] = useState<Predecessor[]>(existing?.preds ?? [])
  const [members, setMembers] = useState<string[]>(existing?.members ?? [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const options = candidateOptions(state, taskId)

  const changePriority = (p: PriorityId) => {
    const prevColor = priorityOf(priority).color
    if (color === prevColor) setColor(priorityOf(p).color)
    setPriority(p)
  }

  const addPred = () => {
    const used = new Set(preds.map((p) => p.taskId))
    const next = options.find((t) => !used.has(t.id))
    if (!next) {
      notify('Tidak ada tugas lain yang bisa dijadikan pendahulu', 'err')
      return
    }
    setPreds([...preds, { taskId: next.id, type: 'FS', lag: 0 }])
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const cleanName = name.trim()
    if (!cleanName) {
      notify('Nama tugas wajib diisi', 'err')
      return
    }
    const dur = Math.max(1, Math.min(999, Math.floor(Number(duration) || 1)))
    const cleanPreds = preds.filter(
      (p) => p.taskId && p.taskId !== taskId && findTask(state.tasks, p.taskId),
    )
    const payload = {
      name: cleanName,
      parentId: parentId || null,
      start: start || toISO(today()),
      duration: dur,
      priority,
      color,
      preds: cleanPreds,
      members: members.filter((mid) => state.members.some((m) => m.id === mid)),
    }
    if (existing) {
      updateTask(existing.id, payload)
      notify('Tugas diperbarui', 'ok')
    } else {
      addTask(payload)
      notify('Tugas ditambahkan', 'ok')
    }
    onClose()
  }

  const remove = () => {
    if (!existing) return
    const kids = childrenOf(state.tasks, existing.id).length
    const msg = kids
      ? `Hapus tugas "${existing.name}" beserta ${kids} sub-tugasnya?`
      : `Hapus tugas "${existing.name}"?`
    if (!window.confirm(msg)) return
    const n = deleteTask(existing.id)
    notify(`${n} tugas dihapus`, 'ok')
    onClose()
  }

  const s = existing ? sched.sched.get(existing.id) : undefined

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-label={existing ? 'Edit Tugas' : 'Tugas Baru'}>
        <div className="modal-head">
          <h3>{existing ? 'Edit Tugas' : 'Tugas Baru'}</h3>
          <button type="button" className="icon-btn" title="Tutup" onClick={onClose}>
            ✕
          </button>
        </div>

        <form onSubmit={submit}>
          <div className="modal-body">
            <div className="field">
              <label htmlFor="fName">Nama Tugas *</label>
              <input
                id="fName"
                type="text"
                required
                maxLength={120}
                placeholder="mis. Implementasi Halaman Login"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>

            <div className="field">
              <label htmlFor="fParent">Induk (untuk sub-tugas)</label>
              <select id="fParent" value={parentId} onChange={(e) => setParentId(e.target.value)}>
                <option value="">— Tugas Utama —</option>
                {options.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="field-row">
              <div className="field">
                <label htmlFor="fStart">Tanggal Mulai *</label>
                <input
                  id="fStart"
                  type="date"
                  value={start ?? ''}
                  disabled={isSummary}
                  onChange={(e) => setStart(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="fDuration">Durasi (hari kerja) *</label>
                <input
                  id="fDuration"
                  type="number"
                  min={1}
                  max={999}
                  step={1}
                  value={duration}
                  disabled={isSummary}
                  onChange={(e) => setDuration(Number(e.target.value))}
                />
              </div>
            </div>

            {isSummary && (
              <p className="hint">
                Tugas induk (ringkasan): tanggal mulai &amp; durasi dihitung otomatis dari sub-tugas.
              </p>
            )}
            {s && (
              <p className="hint">
                Terjadwal: <b>{s.es.toLocaleDateString('id-ID')}</b> →{' '}
                <b>{s.ef.toLocaleDateString('id-ID')}</b> · {s.dur} hari kerja · float {s.float} hari
                {s.critical ? ' · ★ jalur kritis' : ''}
              </p>
            )}
            <p className="hint">
              Tanggal mulai = batas paling awal (start no earlier than); sistem menyesuaikan jika
              didorong oleh pendahulu maupun hari libur.
            </p>

            <div className="field-row">
              <div className="field">
                <label htmlFor="fPriority">Prioritas</label>
                <select
                  id="fPriority"
                  value={priority}
                  onChange={(e) => changePriority(e.target.value as PriorityId)}
                >
                  <option value="low">{priorityOf('low').label}</option>
                  <option value="medium">{priorityOf('medium').label}</option>
                  <option value="high">{priorityOf('high').label}</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="fColor">Warna Indikator</label>
                <div className="color-row">
                  <input
                    id="fColor"
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                  />
                  <span className="hint-inline">warna mengikuti prioritas, bisa diubah</span>
                </div>
              </div>
            </div>

            <div className="field">
              <div className="field-head">
                <label>Pendahulu (Predecessors)</label>
                <button type="button" className="btn ghost small" onClick={addPred}>
                  + Tambah Pendahulu
                </button>
              </div>
              <div className="pred-list">
                {preds.length === 0 && (
                  <span className="pred-none">Belum ada pendahulu — tugas bisa dimulai bebas.</span>
                )}
                {preds.map((p, i) => (
                  <div className="pred-row" key={i}>
                    <select
                      className="p-task"
                      value={p.taskId}
                      onChange={(e) => {
                        const next = [...preds]
                        next[i] = { ...p, taskId: e.target.value }
                        setPreds(next)
                      }}
                    >
                      <option value="">— pilih tugas —</option>
                      {options.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                    <select
                      className="p-type"
                      value={p.type}
                      onChange={(e) => {
                        const next = [...preds]
                        next[i] = { ...p, type: e.target.value as Predecessor['type'] }
                        setPreds(next)
                      }}
                    >
                      <option value="FS">FS</option>
                      <option value="SS">SS</option>
                    </select>
                    <div className="p-lag">
                      <span className="p-laglabel">Jeda (hari)</span>
                      <input
                        type="number"
                        min={0}
                        max={365}
                        value={p.lag}
                        onChange={(e) => {
                          const next = [...preds]
                          next[i] = { ...p, lag: Math.max(0, Math.floor(Number(e.target.value) || 0)) }
                          setPreds(next)
                        }}
                      />
                    </div>
                    <button
                      type="button"
                      className="icon-btn"
                      title="Hapus pendahulu"
                      onClick={() => setPreds(preds.filter((_, j) => j !== i))}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              <p className="hint">
                FS = Finish-to-Start (mulai setelah pendahulu selesai) · SS = Start-to-Start (mulai
                bersamaan) · Jeda = hari kerja tambahan (lag).
              </p>
            </div>

            <div className="field">
              <label>Alokasi Anggota ke Tugas</label>
              <div className="alloc-list">
                {state.members.length === 0 && (
                  <span className="pred-none">Belum ada anggota — tambah di tab Sumber Daya.</span>
                )}
                {state.members.map((m) => {
                  const checked = members.includes(m.id)
                  return (
                    <label className={`alloc-item${checked ? ' checked' : ''}`} key={m.id}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setMembers(
                            checked ? members.filter((x) => x !== m.id) : [...members, m.id],
                          )
                        }
                      />
                      <span className="who">
                        <b>{m.name}</b>
                        <span>{m.role}</span>
                      </span>
                    </label>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="modal-foot">
            {existing && (
              <button type="button" className="btn danger" onClick={remove}>
                Hapus Tugas
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
