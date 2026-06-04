import { create } from 'zustand'
import { supabase } from '../lib/supabase'

async function fetchProfile(userId) {
  const { data } = await supabase
    .from('profiles')
    .select('username, display_name, avatar_url')
    .eq('id', userId)
    .single()
  return data || null
}

export const useAuthStore = create((set) => ({
  user: null,
  session: null,
  profile: null,
  username: null,
  loading: true,
  setUser: (user) => {
    if (!user) {
      set({ user: null, profile: null, username: null, loading: false })
      return
    }
    set({ user, loading: true })
    fetchProfile(user.id)
      .then(profile => set({ profile, username: profile?.username ?? null, loading: false }))
      .catch(() => set({ loading: false }))
  },
  setSession: (session) => set({ session }),
  setUsername: (username) => set({ username }),
  setProfile: (updates) => set(state => ({
    profile: state.profile ? { ...state.profile, ...updates } : updates,
  })),
  signOut: async () => {
    await supabase.auth.signOut()
    set({ user: null, session: null, profile: null, username: null })
  },
}))
