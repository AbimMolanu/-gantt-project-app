/* Baris tugas tampil (tabel & Gantt): urutan pohon + pencarian + collapse */
import type { ProjectState, Task } from '../types'
import { childrenOf, depthOf, findTask, treeOrder } from './tree'

export interface Row {
  task: Task
  depth: number
  summary: boolean
}

export function buildRows(state: ProjectState): Row[] {
  const tasks = state.tasks
  const order = treeOrder(tasks)
  const q = state.ui.search.trim().toLowerCase()

  if (q) {
    // saat mencari: tampilkan kecocokan beserta leluhurnya (abaikan collapse)
    const keep = new Set<string>()
    order.forEach((t) => {
      if (!t.name.toLowerCase().includes(q)) return
      keep.add(t.id)
      let p = t.parentId
      let guard = 0
      while (p && guard++ < 100) {
        keep.add(p)
        p = findTask(tasks, p)?.parentId ?? null
      }
    })
    return order
      .filter((t) => keep.has(t.id))
      .map((task) => ({
        task,
        depth: depthOf(tasks, task),
        summary: childrenOf(tasks, task.id).length > 0,
      }))
  }

  const rows: Row[] = []
  order.forEach((task) => {
    let hidden = false
    let p = task.parentId
    let guard = 0
    while (p && guard++ < 100) {
      if (state.ui.collapsed[p]) {
        hidden = true
        break
      }
      p = findTask(tasks, p)?.parentId ?? null
    }
    if (!hidden) {
      rows.push({
        task,
        depth: depthOf(tasks, task),
        summary: childrenOf(tasks, task.id).length > 0,
      })
    }
  })
  return rows
}
