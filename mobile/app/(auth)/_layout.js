import { Redirect, Stack } from 'expo-router'
import { useAuthStore } from '../../store/useAuthStore'

export default function AuthLayout() {
  const user = useAuthStore(s => s.user)
  const username = useAuthStore(s => s.username)
  const loading = useAuthStore(s => s.loading)

  if (loading) return null
  // Only redirect to app if profile is fully set up
  if (user && username) return <Redirect href="/(tabs)/map" />
  return <Stack screenOptions={{ headerShown: false }} />
}
