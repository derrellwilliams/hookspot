import React from 'react'
import { Redirect, Tabs } from 'expo-router'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Map, User, Plus } from 'iconoir-react-native'
import { useAuthStore } from '../../store/useAuthStore'
import { usePhotoStore } from '../../store/usePhotoStore'
import { UploadSheet } from '../../components/UploadSheet'

export const TAB_BAR_HEIGHT = 56 // content height, excluding safe area

function CustomTabBar({ state, descriptors, navigation }) {
  const insets = useSafeAreaInsets()
  const setUploadOpen = usePhotoStore(s => s.setUploadOpen)

  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom }]}>
      {state.routes.map((route, index) => {
        const isFocused = state.index === index
        const color = isFocused ? '#fff' : 'rgba(255,255,255,0.38)'

        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true })
          if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name)
        }

        const Icon = route.name === 'map' ? Map : User
        const label = route.name === 'map' ? 'Catches' : 'Profile'

        return (
          <React.Fragment key={route.key}>
            <TouchableOpacity style={styles.tab} onPress={onPress} activeOpacity={0.7}>
              <Icon color={color} width={22} height={22} strokeWidth={isFocused ? 2 : 1.5} />
              <Text style={[styles.label, isFocused && styles.labelActive]}>{label}</Text>
            </TouchableOpacity>
            {index === 0 && (
              <TouchableOpacity style={styles.addBtn} activeOpacity={0.8} onPress={() => setUploadOpen(true)}>
                <Plus color="#fff" width={22} height={22} strokeWidth={2.5} />
              </TouchableOpacity>
            )}
          </React.Fragment>
        )
      })}
    </View>
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
    <>
      <Tabs
        tabBar={props => <CustomTabBar {...props} />}
        screenOptions={{ headerShown: false }}
      >
        <Tabs.Screen name="map" />
        <Tabs.Screen name="profile" />
      </Tabs>
      <UploadSheet />
    </>
  )
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(22, 22, 24, 0.97)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 8,
    paddingTop: 10,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    height: TAB_BAR_HEIGHT,
    gap: 3,
  },
  label: {
    fontFamily: 'RobotoCondensed_500Medium',
    fontSize: 10,
    letterSpacing: 0.4,
    color: 'rgba(255,255,255,0.38)',
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
  },
})
