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
    set({ user, loading: false })
    if (user) {
      fetchProfile(user.id).then(profile => {
        if (profile) set({ profile, username: profile.username })
      })
    } else {
      set({ profile: null, username: null })
    }
  },
  setSession: (session) => set({ session }),
  setUsername: (username) => set({ username }),
  signOut: async () => {
    await supabase.auth.signOut()
    set({ user: null, session: null, profile: null, username: null })
  },
}))
