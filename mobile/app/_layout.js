import { useEffect } from 'react'
import { Stack } from 'expo-router'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { StyleSheet } from 'react-native'
import { useFonts } from 'expo-font'
import { Roboto_400Regular, Roboto_700Bold } from '@expo-google-fonts/roboto'
import { RobotoCondensed_400Regular, RobotoCondensed_500Medium } from '@expo-google-fonts/roboto-condensed'
import { RobotoMono_400Regular } from '@expo-google-fonts/roboto-mono'
import { SpaceMono_700Bold } from '@expo-google-fonts/space-mono'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/useAuthStore'

export default function RootLayout() {
  const setUser = useAuthStore(s => s.setUser)
  const setSession = useAuthStore(s => s.setSession)

  const [fontsLoaded] = useFonts({
    Roboto_400Regular,
    Roboto_700Bold,
    RobotoCondensed_400Regular,
    RobotoCondensed_500Medium,
    RobotoMono_400Regular,
    SpaceMono_700Bold,
  })

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (!fontsLoaded) return null

  return (
    <GestureHandlerRootView style={styles.root}>
      <Stack screenOptions={{ headerShown: false }} />
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
})
