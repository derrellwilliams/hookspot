import React from 'react'
import { Redirect, Tabs, router, useSegments } from 'expo-router'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { BlurView } from 'expo-blur'
import { Map, User, Plus } from '../../components/icons.js'
import { useAuthStore } from '../../store/useAuthStore'
import { usePhotoStore } from '../../store/usePhotoStore'
import { UploadSheet } from '../../components/UploadSheet'

export const FLOAT_INSET = 10
export const TAB_BAR_HEIGHT = 56
export const TAB_BAR_PAD_TOP = 10
export const TAB_BAR_TOTAL = TAB_BAR_HEIGHT + TAB_BAR_PAD_TOP
export const CARD_RADIUS = 28

const TABS = [
  { name: 'map', label: 'Catches', Icon: Map },
  { name: 'profile', label: 'Profile', Icon: User },
]

function ConnectedTabBar() {
  const setUploadOpen = usePhotoStore(s => s.setUploadOpen)
  const segments = useSegments()
  const activeTab = segments[segments.length - 1]

  return (
    <BlurView
      tint="systemMaterialDark"
      intensity={100}
      style={[styles.bar, { bottom: FLOAT_INSET }]}
    >
      {TABS.map((tab, index) => {
        const isFocused = activeTab === tab.name
        const color = isFocused ? '#fff' : 'rgba(255,255,255,0.45)'

        return (
          <React.Fragment key={tab.name}>
            <TouchableOpacity
              style={styles.tab}
              onPress={() => router.navigate(`/(tabs)/${tab.name}`)}
              activeOpacity={0.7}
            >
              <tab.Icon color={color} width={22} height={22} strokeWidth={isFocused ? 2 : 1.5} />
              <Text style={[styles.label, isFocused && styles.labelActive]}>{tab.label}</Text>
            </TouchableOpacity>
            {index === 0 && (
              <TouchableOpacity style={styles.addBtn} activeOpacity={0.8} onPress={() => setUploadOpen(true)}>
                <Plus color="#fff" width={22} height={22} strokeWidth={2.5} />
              </TouchableOpacity>
            )}
          </React.Fragment>
        )
      })}
    </BlurView>
  )
}

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
      </Tabs>
      <ConnectedTabBar />
      <UploadSheet />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  bar: {
    position: 'absolute',
    left: FLOAT_INSET,
    right: FLOAT_INSET,
    flexDirection: 'row',
    alignItems: 'flex-start',
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingTop: TAB_BAR_PAD_TOP,
    borderBottomLeftRadius: CARD_RADIUS,
    borderBottomRightRadius: CARD_RADIUS,
    // Specular highlight — hairline border simulates glass edge
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.18)',
    // Shadow for depth
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    height: TAB_BAR_HEIGHT,
    gap: 3,
  },
  label: {
    fontFamily: 'RobotoCondensed_500Medium',
    fontSize: 12,
    letterSpacing: 0.4,
    color: 'rgba(255,255,255,0.45)',
  },
  labelActive: {
    color: '#fff',
  },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 20,
    marginTop: 1,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
})
