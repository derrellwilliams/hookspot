import { Redirect, Stack } from 'expo-router'
import { useAuthStore } from '../../store/useAuthStore'

export default function AuthLayout() {
  const user = useAuthStore(s => s.user)
  if (user) return <Redirect href="/(tabs)/map" />
  return <Stack screenOptions={{ headerShown: false }} />
}
