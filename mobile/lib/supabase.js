import { createClient } from '@supabase/supabase-js'
import Constants from 'expo-constants'

const { supabaseUrl, supabaseAnonKey } = Constants.expoConfig.extra

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing supabaseUrl or supabaseAnonKey in app.config.js extra')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
