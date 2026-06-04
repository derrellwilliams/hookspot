import { useEffect } from 'react'
import { View, Image, StyleSheet } from 'react-native'
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

const BLOB_SIZE = 500
const noiseTexture = require('../assets/noise.png')

function BlobView({ blob, index, t }) {
  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: Math.sin(t.value * blob.dx + (blob.offset ?? 0)) * 30 },
      { translateY: Math.cos(t.value * blob.dy + (blob.offset ?? 0)) * 24 },
    ],
  }))

  return (
    <Reanimated.View
      style={[styles.blobWrap, { left: `${blob.x}%`, top: `${blob.y}%` }, animStyle]}
    >
      <Svg width={BLOB_SIZE} height={BLOB_SIZE} viewBox="0 0 100 100">
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
  noiseOpacity = 0.04,
}) {
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
        <BlobView key={i} blob={blob} index={i} t={t} />
      ))}
      <Image
        source={noiseTexture}
        style={[styles.noise, { opacity: noiseOpacity }]}
        resizeMode="repeat"
      />
    </View>
  )
}

const styles = StyleSheet.create({
  blobWrap: {
    position: 'absolute',
    width: BLOB_SIZE,
    height: BLOB_SIZE,
    marginLeft: -BLOB_SIZE / 2,
    marginTop: -BLOB_SIZE / 2,
  },
  noise: {
    ...StyleSheet.absoluteFillObject,
  },
})
