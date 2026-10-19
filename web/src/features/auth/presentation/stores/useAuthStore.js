import { create } from 'zustand'
import { authApi } from '../../data/authApi'
import { session } from '../../../../core/api/sessionStore'

export const useAuthStore = create((set, get) => ({
  user: null,
  isAuthenticated: !!session.get(),
  isLoading: false,
  error: null,

  setUser: (user) => set({ user, isAuthenticated: !!user }),

  login: async (email, password, remember = true) => {
    set({ isLoading: true, error: null })
    try {
      const res = await authApi.login(email, password, remember)
      set({ user: res.user, isAuthenticated: true, isLoading: false })
      return res
    } catch (err) {
      set({ error: err.message || 'Login failed', isLoading: false })
      throw err
    }
  },

  logout: async () => {
    try {
      await authApi.logout()
    } finally {
      set({ user: null, isAuthenticated: false })
    }
  },

  checkSession: async () => {
    if (!session.get()) {
      set({ user: null, isAuthenticated: false })
      return null
    }
    set({ isLoading: true })
    try {
      const res = await authApi.me()
      set({ user: res.user, isAuthenticated: true, isLoading: false })
      return res.user
    } catch (err) {
      set({ user: null, isAuthenticated: false, isLoading: false })
      return null
    }
  },
}))
