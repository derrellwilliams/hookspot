import { create } from 'zustand'
import { supabase } from '../lib/supabase.js'

export const useAuthStore = create((set) => ({
  user: null,
  session: null,
  username: null,
  loading: true,
  setUser: (user) => set({ user, loading: false }),
  setSession: (session) => set({ session }),
  setUsername: (username) => set({ username }),
  setUserAndUsername: (user, username) => set({ user, username }),
  signOut: async () => {
    await supabase.auth.signOut()
    set({ user: null, session: null, username: null })
  },
}))
