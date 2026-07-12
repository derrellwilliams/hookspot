// Segmented control with sprung underline — native port of the web profile's
// Recent Activity / Stats tab bar (layoutId underline, spring 400/35).
import { View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native'
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import { C, FONTS, SPRINGS } from '../lib/theme'

export function SegmentedTabs({ tabs, active, onChange, horizontalInset = 24 }) {
  const { width } = useWindowDimensions()
  const tabWidth = (width - horizontalInset) / tabs.length
  const activeIndex = Math.max(0, tabs.indexOf(active))
  const underlineStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: withSpring(activeIndex * tabWidth, SPRINGS.segment) }],
  }), [activeIndex, tabWidth])

  return (
    <View style={styles.row}>
      {tabs.map(tab => (
        <Pressable
          key={tab}
          style={styles.tab}
          onPress={() => { Haptics.selectionAsync(); onChange(tab) }}
          accessibilityRole="tab"
          accessibilityState={{ selected: tab === active }}
        >
          <Text style={[styles.text, tab === active && styles.textActive]}>{tab}</Text>
        </Pressable>
      ))}
      <Animated.View style={[styles.underline, { width: tabWidth }, underlineStyle]} />
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    marginBottom: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  text: {
    fontFamily: FONTS.condensed,
    fontSize: 14,
    color: C.muted,
  },
  textActive: {
    fontFamily: FONTS.condensedSemiBold,
    color: '#fff',
  },
  underline: {
    position: 'absolute',
    bottom: -StyleSheet.hairlineWidth,
    left: 0,
    height: 2,
    backgroundColor: '#fff',
  },
})
