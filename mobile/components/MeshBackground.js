import { useEffect } from 'react'
import { View, StyleSheet, useWindowDimensions } from 'react-native'
import Reanimated, {
  useSharedValue, useAnimatedStyle,
  withRepeat, withTiming, Easing,
} from 'react-native-reanimated'
import { Svg, Defs, RadialGradient, Stop, Circle } from 'react-native-svg'

const DEFAULT_BLOBS = [
  { x: 62, y: 28, color: '#3b82f6', dx: 0.8,  dy: 0.6,  offset: 0.0 },
  { x: 22, y: 52, color: '#60a5fa', dx: 0.7,  dy: -0.8, offset: 1.3 },
  { x: 78, y: 68, color: '#0ea5e9', dx: -0.6, dy: 0.5,  offset: 2.6 },
  { x: 38, y: 72, color: '#818cf8', dx: 0.9,  dy: -0.7, offset: 3.9 },
  { x: 15, y: 36, color: '#a5b4fc', dx: 0.5,  dy: 0.4,  offset: 5.2 },
  { x: 48, y: 14, color: '#38bdf8', dx: 0.6,  dy: 0.8,  offset: 6.5 },
]

function BlobView({ blob, index, t, size }) {
  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: Math.sin(t.value * blob.dx + (blob.offset ?? 0)) * 30 },
      { translateY: Math.cos(t.value * blob.dy + (blob.offset ?? 0)) * 24 },
    ],
  }))

  return (
    <Reanimated.View
      style={[{
        position: 'absolute',
        width: size,
        height: size,
        marginLeft: -size / 2,
        marginTop: -size / 2,
        left: `${blob.x}%`,
        top: `${blob.y}%`,
      }, animStyle]}
    >
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <RadialGradient id={`g${index}`} cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={blob.color} stopOpacity="0.9" />
            <Stop offset="100%" stopColor={blob.color} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle cx="50" cy="50" r="50" fill={`url(#g${index})`} />
      </Svg>
    </Reanimated.View>
  )
}

export function MeshBackground({
  blobs = DEFAULT_BLOBS,
  bgColor = '#1A1953',
}) {
  const { width, height } = useWindowDimensions()
  // match desktop: each blob covers ~50% of the viewport in each direction
  const blobSize = Math.max(width, height) * 1.1
  const t = useSharedValue(0)

  useEffect(() => {
    t.value = withRepeat(
      withTiming(1000, { duration: 1_100_000, easing: Easing.linear }),
      -1, false,
    )
  }, [])

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: bgColor }]} />
      {blobs.map((blob, i) => (
        <BlobView key={i} blob={blob} index={i} t={t} size={blobSize} />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({})
