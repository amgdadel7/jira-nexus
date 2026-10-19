const memoryStore: Record<string, string> = {}

export const browserStorage = {
  getItem(key: string) {
    try {
      return window.localStorage.getItem(key)
    } catch {
      return memoryStore[key] ?? null
    }
  },
  setItem(key: string, value: string) {
    try {
      window.localStorage.setItem(key, value)
    } catch {
      memoryStore[key] = value
    }
  },
  removeItem(key: string) {
    try {
      window.localStorage.removeItem(key)
    } catch {
      delete memoryStore[key]
    }
  },
}
