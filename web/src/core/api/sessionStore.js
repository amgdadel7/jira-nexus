const TOKEN_KEY = 'jc.token'
let memoryToken = null

const store = (kind) => {
  try {
    const s = window[kind]
    const k = '__jc_test'
    s.setItem(k, k)
    s.removeItem(k)
    return s
  } catch {
    return null
  }
}

export const session = {
  get() {
    return memoryToken || store('sessionStorage')?.getItem(TOKEN_KEY) || store('localStorage')?.getItem(TOKEN_KEY) || null
  },
  set(token, remember = true) {
    memoryToken = token
    store('localStorage')?.removeItem(TOKEN_KEY)
    store('sessionStorage')?.removeItem(TOKEN_KEY)
    store(remember ? 'localStorage' : 'sessionStorage')?.setItem(TOKEN_KEY, token)
  },
  clear() {
    memoryToken = null
    store('localStorage')?.removeItem(TOKEN_KEY)
    store('sessionStorage')?.removeItem(TOKEN_KEY)
  },
  remembered() {
    return !!store('localStorage')?.getItem(TOKEN_KEY)
  },
}

let currentProject = 'KAN'
export const getProject = () => currentProject
export const setProject = (key) => {
  if (key) currentProject = key
}

export const CLIENT_ID = Math.random().toString(36).slice(2, 10)
