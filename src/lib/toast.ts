/* Toast notifikasi ringan (reactive, tanpa context) */
import { useSyncExternalStore } from 'react'

export interface Toast {
  id: number
  msg: string
  kind: 'ok' | 'err' | 'info'
}

let toasts: Toast[] = []
const listeners = new Set<() => void>()

function emit(): void {
  listeners.forEach((l) => l())
}

function dismiss(id: number): void {
  toasts = toasts.filter((t) => t.id !== id)
  emit()
}

export function notify(msg: string, kind: Toast['kind'] = 'info'): void {
  const id = Date.now() + Math.random()
  toasts = [...toasts, { id, msg, kind }]
  emit()
  window.setTimeout(() => dismiss(id), 3400)
}

export function useToasts(): Toast[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => {
        listeners.delete(l)
      }
    },
    () => toasts,
    () => toasts,
  )
}

export function dismissToast(id: number): void {
  dismiss(id)
}
