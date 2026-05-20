import { create } from 'zustand'
import { supabase } from '../lib/supabase.js'

export const useAuthStore = create((set) => ({
  user: null,
  session: null,
  username: null,
  loading: true,
  setUser: (user) => set(state => {
    const prevAvatar = state.user?.user_metadata?.avatar_url
    const merged = user && prevAvatar && !user.user_metadata?.avatar_url
      ? { ...user, user_metadata: { ...user.user_metadata, avatar_url: prevAvatar } }
      : user
    return { user: merged, loading: false }
  }),
  setSession: (session) => set({ session }),
  setUsername: (username) => set({ username }),
  setUserAndUsername: (user, username) => set({ user, username }),
  signOut: async () => {
    await supabase.auth.signOut()
    set({ user: null, session: null, username: null })
  },
}))
