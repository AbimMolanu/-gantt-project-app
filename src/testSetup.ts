/**
 * Setup test: jsdom dijalankan di atas Node 25 yang mengekspor global
 * `localStorage` tanpa method (getItem undefined). Pasang storage
 * fungsional agar perilaku mendekati browser sungguhan.
 */
class MemoryStorage {
  private map = new Map<string, string>()

  getItem(key: string): string | null {
    return this.map.has(key) ? this.map.get(key)! : null
  }

  setItem(key: string, value: string): void {
    this.map.set(key, String(value))
  }

  removeItem(key: string): void {
    this.map.delete(key)
  }

  clear(): void {
    this.map.clear()
  }

  key(index: number): string | null {
    return Array.from(this.map.keys())[index] ?? null
  }

  get length(): number {
    return this.map.size
  }
}

declare global {
  // eslint-disable-next-line no-var
  var localStorage: Storage
}

function install(): void {
  let current: unknown = undefined
  try {
    current = globalThis.localStorage
  } catch {
    current = undefined
  }
  if (current && typeof (current as Storage).getItem === 'function') return
  const storage = new MemoryStorage() as unknown as Storage
  try {
    Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true })
  } catch {
    /* environment tidak mengizinkan definisi global */
  }
  if (typeof window !== 'undefined') {
    try {
      Object.defineProperty(window, 'localStorage', { value: storage, configurable: true })
    } catch {
      /* abaikan */
    }
  }
}

install()

export {}
