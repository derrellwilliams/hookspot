import { Redirect, Tabs } from 'expo-router'
import { View, StyleSheet } from 'react-native'
import { useAuthStore } from '../../store/useAuthStore'
import { MobileNav } from '../../components/MobileNav'
import { UploadSheet } from '../../components/UploadSheet'

// Legacy layout constants still imported by map.js (removed with the Phase-4
// home restructure).
export const FLOAT_INSET = 10
export const TAB_BAR_HEIGHT = 56
export const TAB_BAR_PAD_TOP = 10
export const TAB_BAR_TOTAL = TAB_BAR_HEIGHT + TAB_BAR_PAD_TOP
export const CARD_RADIUS = 28

export default function TabsLayout() {
  const user = useAuthStore(s => s.user)
  const username = useAuthStore(s => s.username)
  const loading = useAuthStore(s => s.loading)

  if (loading) return null
  if (!user) return <Redirect href="/(auth)/login" />
  if (!username) return <Redirect href="/(auth)/onboarding" />

  return (
    <View style={styles.root}>
      <Tabs tabBar={() => null} screenOptions={{ headerShown: false }}>
        <Tabs.Screen name="map" />
        <Tabs.Screen name="profile" />
        <Tabs.Screen name="search" />
      </Tabs>
      <MobileNav />
      <UploadSheet />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
})
