import { create } from 'zustand'
import { supabase } from '../lib/supabase.js'

export const useAuthStore = create((set) => ({
  user: null,
  username: null,
  loading: true,
  setUser: (user) => set({ user, loading: false }),
  setUsername: (username) => set({ username }),
  signOut: async () => {
    await supabase.auth.signOut()
    set({ user: null, username: null })
  },
}))
