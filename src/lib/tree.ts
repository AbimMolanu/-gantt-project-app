/* Helper hierarki tugas (parent-child) yang bersih dari React. */
import type { Task } from '../types'

export function findTask(tasks: Task[], id: string): Task | undefined {
  return tasks.find((t) => t.id === id)
}

export function childrenOf(tasks: Task[], id: string): Task[] {
  return tasks.filter((t) => t.parentId === id)
}

export function rootTasks(tasks: Task[]): Task[] {
  return tasks.filter((t) => !t.parentId || !tasks.some((p) => p.id === t.parentId))
}

export function descendants(tasks: Task[], id: string): Task[] {
  const out: Task[] = []
  const seen = new Set<string>()
  const walk = (pid: string): void => {
    childrenOf(tasks, pid).forEach((c) => {
      if (seen.has(c.id)) return
      seen.add(c.id)
      out.push(c)
      walk(c.id)
    })
  }
  walk(id)
  return out
}

/** a = leluhur dari b? */
export function isAncestor(tasks: Task[], a: string, b: string): boolean {
  if (!a || !b) return false
  let cur = findTask(tasks, b)
  let guard = 0
  while (cur && cur.parentId && guard++ < 1000) {
    if (cur.parentId === a) return true
    cur = findTask(tasks, cur.parentId)
  }
  return false
}

export function depthOf(tasks: Task[], task: Task): number {
  let d = 0
  let cur: Task | undefined = task
  let guard = 0
  while (cur && cur.parentId && guard++ < 500) {
    cur = findTask(tasks, cur.parentId)
    if (cur) d++
  }
  return d
}

/** Urutan tampil: DFS sesuai urutan array (pohon); tugas yatim ikut tampil di akhir. */
export function treeOrder(tasks: Task[]): Task[] {
  const out: Task[] = []
  const walk = (list: Task[]): void => {
    list.forEach((t) => {
      out.push(t)
      walk(childrenOf(tasks, t.id))
    })
  }
  walk(rootTasks(tasks))
  tasks.forEach((t) => {
    if (!out.includes(t)) out.push(t)
  })
  return out
}

/** Apakah id adalah induk (punya sub-tugas)? */
export function isSummary(tasks: Task[], id: string): boolean {
  return childrenOf(tasks, id).length > 0
}
