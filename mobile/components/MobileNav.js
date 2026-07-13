// Native port of the web MobileNav (src/components/MobileNav/): Instagram-style
// floating icon pill (Catches/Profile/Search) + isolated glass-blue add button.
// Shrinks on scroll down / expands on scroll up via the shared navT signal
// (lib/navScroll.js). Geometry and springs mirror the web values 1:1.
import { useEffect, useState } from 'react'
import { View, Pressable, StyleSheet } from 'react-native'
import Animated, {
  useAnimatedStyle, useSharedValue, interpolate,
  withSequence, withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router, usePathname } from 'expo-router'
import { BlurView } from 'expo-blur'
import * as Haptics from 'expo-haptics'
import { Home, Plus, Search, User } from './icons.js'
import { usePhotoStore } from '../store/usePhotoStore'
import { navT, resetNav } from '../lib/navScroll'
import { spring } from '../lib/motion'
import { reducedMotion } from '../lib/reducedMotion'
import { GLASS, SPRINGS, RADII, C } from '../lib/theme'

const TABS = [
  { path: '/map', label: 'Catches', Icon: Home },
  { path: '/profile', label: 'Profile', Icon: User },
  { path: '/search', label: 'Search', Icon: Search },
]

// Instagram-metric geometry: full-size ↔ compact (matches web FULL/COMPACT)
const FULL = { inset: 20, barH: 58, add: 46 }
const COMPACT = { inset: 44, barH: 46, add: 34 }
const PILL_PAD = 5 // pill's internal horizontal padding

// Web icon bounce: scale [1, 1.2, 0.88, 1.06, 1], 0.38s, times [0,.2,.5,.7,1]
// Skipped under reduced motion — it's a decorative overshoot, not information
// (the stadium capsule + label already show the switch happened).
function bounce(scale) {
  if (reducedMotion.value) return
  scale.value = withSequence(
    withTiming(1.2, { duration: 76 }),
    withTiming(0.88, { duration: 114 }),
    withTiming(1.06, { duration: 76 }),
    withTiming(1, { duration: 114 }),
  )
}

function Tab({ path, label, Icon, isActive, onPress }) {
  const bounceScale = useSharedValue(1)
  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: bounceScale.value * interpolate(navT.value, [0, 1], [1, 0.9]) }],
  }))

  return (
    <Pressable
      style={({ pressed }) => [styles.tab, pressed && styles.tabPressed]}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: isActive }}
      onPress={() => {
        if (isActive) return
        Haptics.selectionAsync()
        bounce(bounceScale)
        onPress()
      }}
    >
      <Animated.View style={iconStyle}>
        <Icon
          color={isActive ? '#fff' : 'rgba(255,255,255,0.9)'}
          size={24}
          strokeWidth={isActive ? 2.5 : 2}
        />
      </Animated.View>
    </Pressable>
  )
}

export function MobileNav() {
  const insets = useSafeAreaInsets()
  const pathname = usePathname()
  const setUploadOpen = usePhotoStore(s => s.setUploadOpen)
  const [pillWidth, setPillWidth] = useState(0)

  const activeIndex = TABS.findIndex(t =>
    pathname === t.path || (t.path === '/profile' && pathname.startsWith('/user/'))
  )

  useEffect(() => { resetNav() }, [pathname])

  const wrapStyle = useAnimatedStyle(() => ({
    paddingHorizontal: interpolate(navT.value, [0, 1], [FULL.inset, COMPACT.inset]),
  }))
  const pillStyle = useAnimatedStyle(() => ({
    height: interpolate(navT.value, [0, 1], [FULL.barH, COMPACT.barH]),
  }))
  const addStyle = useAnimatedStyle(() => {
    const size = interpolate(navT.value, [0, 1], [FULL.add, COMPACT.add])
    return { width: size, height: size }
  })
  const plusStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(navT.value, [0, 1], [1, 0.85]) }],
  }))

  const cellWidth = pillWidth > 0 ? (pillWidth - PILL_PAD * 2) / TABS.length : 0
  const stadiumStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: spring(PILL_PAD + cellWidth * activeIndex + 2, SPRINGS.nav) }],
  }), [cellWidth, activeIndex])

  return (
    <Animated.View
      style={[styles.wrap, { bottom: 12 + insets.bottom }, wrapStyle]}
      pointerEvents="box-none"
    >
      <Animated.View style={[styles.pillShadow, pillStyle]}>
        <View style={styles.pillClip}>
          <BlurView tint="dark" intensity={GLASS.navBlur} style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: GLASS.navBg }]} />
          <View style={styles.topHairline} />
          {activeIndex >= 0 && cellWidth > 0 && (
            <Animated.View style={[styles.stadium, { width: cellWidth - 4 }, stadiumStyle]} />
          )}
          <View
            style={styles.tabRow}
            onLayout={e => setPillWidth(e.nativeEvent.layout.width)}
          >
            {TABS.map(({ path, label, Icon }, i) => (
              <Tab
                key={path}
                path={path}
                label={label}
                Icon={Icon}
                isActive={i === activeIndex}
                onPress={() => router.navigate(path)}
              />
            ))}
          </View>
        </View>
      </Animated.View>

      <Animated.View style={[styles.addShadow, addStyle]}>
        <View style={styles.addClip}>
          <BlurView tint="dark" intensity={GLASS.navBlur} style={StyleSheet.absoluteFill} />
          <Pressable
            style={({ pressed }) => [styles.addBtn, pressed && styles.addBtnPressed]}
            accessibilityRole="button"
            accessibilityLabel="Add catch"
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
              setUploadOpen(true)
            }}
          >
            <Animated.View style={plusStyle}>
              <Plus color="#fff" size={26} strokeWidth={2.5} />
            </Animated.View>
          </Pressable>
        </View>
      </Animated.View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    zIndex: 1000,
  },
  pillShadow: {
    flex: 1,
    minWidth: 0,
    borderRadius: RADII.pill,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
  },
  pillClip: {
    flex: 1,
    borderRadius: RADII.pill,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: GLASS.borderSoft,
  },
  topHairline: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  tabRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingHorizontal: PILL_PAD,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabPressed: { opacity: 0.6 },
  stadium: {
    position: 'absolute',
    top: 5,
    bottom: 5,
    left: 0,
    borderRadius: RADII.pill,
    backgroundColor: GLASS.stadium,
  },
  addShadow: {
    flexShrink: 0,
    borderRadius: RADII.pill,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
  },
  addClip: {
    flex: 1,
    borderRadius: RADII.pill,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: GLASS.hairline,
  },
  addBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    // web: color-mix(in srgb, var(--accent) 72%, transparent) over glass
    backgroundColor: 'rgba(37, 99, 235, 0.72)',
  },
  addBtnPressed: { opacity: 0.7 },
})
