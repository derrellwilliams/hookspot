import { Redirect, Tabs } from 'expo-router'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Map, User, Plus } from 'iconoir-react-native'
import { useAuthStore } from '../../store/useAuthStore'

export const TAB_BAR_HEIGHT = 64 // pill height, excluding safe area

function CustomTabBar({ state, descriptors, navigation }) {
  const insets = useSafeAreaInsets()

  return (
    <View style={[styles.wrapper, { paddingBottom: insets.bottom + 12 }]} pointerEvents="box-none">
      <View style={styles.pill}>
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
            <>
              <TouchableOpacity key={route.key} style={styles.tab} onPress={onPress} activeOpacity={0.7}>
                <Icon color={color} width={22} height={22} strokeWidth={isFocused ? 2 : 1.5} />
                <Text style={[styles.label, isFocused && styles.labelActive]}>{label}</Text>
              </TouchableOpacity>
              {index === 0 && (
                <TouchableOpacity style={styles.addBtn} activeOpacity={0.8}>
                  <Plus color="#fff" width={22} height={22} strokeWidth={2.5} />
                </TouchableOpacity>
              )}
            </>
          )
        })}
      </View>
    </View>
  )
}

export default function TabsLayout() {
  const user = useAuthStore(s => s.user)
  const loading = useAuthStore(s => s.loading)

  if (loading) return null
  if (!user) return <Redirect href="/(auth)/login" />

  return (
    <Tabs
      tabBar={props => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="map" />
      <Tabs.Screen name="profile" />
    </Tabs>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    height: TAB_BAR_HEIGHT,
    backgroundColor: 'rgba(22, 22, 24, 0.97)',
    borderRadius: TAB_BAR_HEIGHT / 2,
    paddingHorizontal: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
  separator: {
    width: StyleSheet.hairlineWidth,
    height: 28,
    backgroundColor: 'rgba(255,255,255,0.14)',
    marginHorizontal: 8,
  },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
})
