import { describe, expect, it } from 'vitest'
import {
  addTask,
  deleteTask,
  getState,
  normalizeState,
  updateTask,
} from './store'
import { createSeedState } from './seed'
import { childrenOf, treeOrder } from './tree'

describe('normalizeState', () => {
  it('membuang rujukan parent/pred/member yang menggantung', () => {
    const s = normalizeState({
      tasks: [
        { id: 'a', name: 'A', duration: 2, preds: [{ taskId: 'hilang', type: 'FS', lag: 0 }], members: ['m-ghost'] },
        { id: 'b', name: 'B', parentId: 'a', parentIdGhost: 'x' },
      ],
      members: [{ id: 'm1', name: 'Satu', email: 's@x.com', role: 'QA', salary: 1000 }],
    })
    expect(s.tasks[0].preds).toHaveLength(0)
    expect(s.tasks[0].members).toHaveLength(0)
    expect(s.tasks[1].parentId).toBe('a')
  })

  it('meng-clamp durasi minimal 1 dan prioritas tidak dikenal ke default', () => {
    const s = normalizeState({
      tasks: [{ id: 'a', name: 'A', duration: 0, priority: 'gila' }],
      members: [],
    })
    expect(s.tasks[0].duration).toBe(1)
    expect(s.tasks[0].priority).toBe('medium')
  })

  it('melempar error untuk format yang tidak valid', () => {
    expect(() => normalizeState(null)).toThrow()
    expect(() => normalizeState({ tasks: 'bukan-array', members: [] })).toThrow()
  })
})

describe('aksi tugas', () => {
  it('addTask menambahkan tugas baru ke state', () => {
    const before = getState().tasks.length
    const id = addTask({
      name: 'Tugas Uji',
      parentId: null,
      start: '2026-10-12',
      duration: 3,
      priority: 'low',
      color: '#16a34a',
      preds: [],
      members: [],
    })
    const t = getState().tasks.find((x) => x.id === id)
    expect(getState().tasks).toHaveLength(before + 1)
    expect(t?.name).toBe('Tugas Uji')
    expect(t?.duration).toBe(3)
  })

  it('updateTask memperbarui field yang dipilih', () => {
    const id = addTask({
      name: 'Untuk Update',
      parentId: null,
      start: '2026-10-12',
      duration: 1,
      priority: 'low',
      color: '#16a34a',
      preds: [],
      members: [],
    })
    updateTask(id, { duration: 7, priority: 'high' })
    const t = getState().tasks.find((x) => x.id === id)!
    expect(t.duration).toBe(7)
    expect(t.priority).toBe('high')
  })

  it('deleteTask meng-cascade sub-tugas dan membersihkan predikat yang menggantung', () => {
    const removed = deleteTask('t1') // induk: t1 + t1a + t1b
    expect(removed).toBe(3)
    const ids = getState().tasks.map((t) => t.id)
    expect(ids).not.toContain('t1')
    expect(ids).not.toContain('t1a')
    expect(ids).not.toContain('t1b')
    // t2a berpred t1b → rujukan ikut dibersihkan
    const t2a = getState().tasks.find((t) => t.id === 't2a')!
    expect(t2a.preds.some((p) => p.taskId === 't1b')).toBe(false)
  })
})

describe('helper hierarki', () => {
  it('treeOrder mengurutkan DFS beserta sub-tugas', () => {
    const tasks = createSeedState().tasks
    const order = treeOrder(tasks).map((t) => t.id)
    expect(order.slice(0, 3)).toEqual(['t1', 't1a', 't1b'])
    expect(order.indexOf('t2')).toBeLessThan(order.indexOf('t2a'))
    expect(order).toHaveLength(tasks.length)
  })

  it('childrenOf mengembalikan sub-tugas langsung', () => {
    const tasks = createSeedState().tasks
    expect(childrenOf(tasks, 't1').map((t) => t.id)).toEqual(['t1a', 't1b'])
    expect(childrenOf(tasks, 't1a')).toHaveLength(0)
  })
})
