import { useEffect } from 'react'
import { Stack } from 'expo-router'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet'
import { StyleSheet, LogBox } from 'react-native'

LogBox.ignoreLogs(['AuthApiError'])
import { useFonts } from 'expo-font'
import { Roboto_400Regular, Roboto_500Medium, Roboto_600SemiBold, Roboto_700Bold } from '@expo-google-fonts/roboto'
import { RobotoCondensed_400Regular, RobotoCondensed_500Medium, RobotoCondensed_600SemiBold } from '@expo-google-fonts/roboto-condensed'
import { RobotoMono_400Regular, RobotoMono_500Medium } from '@expo-google-fonts/roboto-mono'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/useAuthStore'

export default function RootLayout() {
  const setUser = useAuthStore(s => s.setUser)
  const setSession = useAuthStore(s => s.setSession)

  const [fontsLoaded] = useFonts({
    Roboto_400Regular,
    Roboto_500Medium,
    Roboto_600SemiBold,
    Roboto_700Bold,
    RobotoCondensed_400Regular,
    RobotoCondensed_500Medium,
    RobotoCondensed_600SemiBold,
    RobotoMono_400Regular,
    RobotoMono_500Medium,
    GeistPixel: require('../assets/fonts/GeistPixel.ttf'),
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
      <BottomSheetModalProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </BottomSheetModalProvider>
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
})
