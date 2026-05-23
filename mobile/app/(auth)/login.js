import { useState, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native'
import Reanimated, {
  useSharedValue, useAnimatedStyle,
  withRepeat, withTiming, Easing,
} from 'react-native-reanimated'
import { Svg, Defs, RadialGradient, Stop, Circle } from 'react-native-svg'
import { supabase } from '../../lib/supabase'

const BLOBS = [
  { x: 62, y: 28, color: '#3b82f6', dx: 0.8,  dy: 0.6  },
  { x: 22, y: 52, color: '#60a5fa', dx: 0.7,  dy: -0.8 },
  { x: 78, y: 68, color: '#0ea5e9', dx: -0.6, dy: 0.5  },
  { x: 38, y: 72, color: '#818cf8', dx: 0.9,  dy: -0.7 },
  { x: 15, y: 36, color: '#a5b4fc', dx: 0.5,  dy: 0.4  },
  { x: 48, y: 14, color: '#38bdf8', dx: 0.6,  dy: 0.8  },
]

const BLOB_SIZE = 500

function MeshBackground() {
  const t = useSharedValue(0)

  useEffect(() => {
    t.value = withRepeat(
      withTiming(1000, { duration: 1_100_000, easing: Easing.linear }),
      -1, false,
    )
  }, [])

  const s0 = useAnimatedStyle(() => ({ transform: [{ translateX: Math.sin(t.value * BLOBS[0].dx + 0.0) * 30 }, { translateY: Math.cos(t.value * BLOBS[0].dy + 0.0) * 24 }] }))
  const s1 = useAnimatedStyle(() => ({ transform: [{ translateX: Math.sin(t.value * BLOBS[1].dx + 1.3) * 30 }, { translateY: Math.cos(t.value * BLOBS[1].dy + 1.1) * 24 }] }))
  const s2 = useAnimatedStyle(() => ({ transform: [{ translateX: Math.sin(t.value * BLOBS[2].dx + 2.6) * 30 }, { translateY: Math.cos(t.value * BLOBS[2].dy + 2.2) * 24 }] }))
  const s3 = useAnimatedStyle(() => ({ transform: [{ translateX: Math.sin(t.value * BLOBS[3].dx + 3.9) * 30 }, { translateY: Math.cos(t.value * BLOBS[3].dy + 3.3) * 24 }] }))
  const s4 = useAnimatedStyle(() => ({ transform: [{ translateX: Math.sin(t.value * BLOBS[4].dx + 5.2) * 30 }, { translateY: Math.cos(t.value * BLOBS[4].dy + 4.4) * 24 }] }))
  const s5 = useAnimatedStyle(() => ({ transform: [{ translateX: Math.sin(t.value * BLOBS[5].dx + 6.5) * 30 }, { translateY: Math.cos(t.value * BLOBS[5].dy + 5.5) * 24 }] }))

  const blobStyles = [s0, s1, s2, s3, s4, s5]

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#1A1953' }]} />
      {BLOBS.map((blob, i) => (
        <Reanimated.View
          key={i}
          style={[styles.blobWrap, { left: `${blob.x}%`, top: `${blob.y}%` }, blobStyles[i]]}
        >
          <Svg width={BLOB_SIZE} height={BLOB_SIZE} viewBox="0 0 100 100">
            <Defs>
              <RadialGradient id={`g${i}`} cx="50%" cy="50%" r="50%">
                <Stop offset="0%" stopColor={blob.color} stopOpacity="0.9" />
                <Stop offset="100%" stopColor={blob.color} stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Circle cx="50" cy="50" r="50" fill={`url(#g${i})`} />
          </Svg>
        </Reanimated.View>
      ))}
    </View>
  )
}

export default function LoginScreen() {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleContinue() {
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOtp({ email })
    setLoading(false)
    if (error) setError(error.message)
    else setSent(true)
  }

  async function handleVerify() {
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.verifyOtp({ email, token: code.trim(), type: 'email' })
    setLoading(false)
    if (error) setError(error.message)
  }

  return (
    <View style={styles.page}>
      <MeshBackground />
      <KeyboardAvoidingView
        style={styles.center}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Text style={styles.wordmark}>Hook Spot</Text>

        <View style={styles.form}>
          {!sent ? (
            <>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="your@email.com"
                placeholderTextColor="rgba(255,255,255,0.35)"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoFocus
              />
              {error && <Text style={styles.error}>{error}</Text>}
              {loading
                ? <ActivityIndicator color="#fff" style={{ marginTop: 4 }} />
                : (
                  <TouchableOpacity style={styles.button} onPress={handleContinue}>
                    <Text style={styles.buttonText}>Continue</Text>
                  </TouchableOpacity>
                )
              }
            </>
          ) : (
            <>
              <Text style={styles.sent}>Check your email for a 6-digit code.</Text>
              <Text style={styles.label}>Code</Text>
              <TextInput
                style={styles.input}
                placeholder="123456"
                placeholderTextColor="rgba(255,255,255,0.35)"
                value={code}
                onChangeText={t => setCode(t.replace(/\D/g, '').slice(0, 6))}
                keyboardType="number-pad"
                autoFocus
              />
              {error && <Text style={styles.error}>{error}</Text>}
              {loading
                ? <ActivityIndicator color="#fff" style={{ marginTop: 4 }} />
                : (
                  <>
                    <TouchableOpacity
                      style={[styles.button, code.length < 6 && styles.buttonDisabled]}
                      onPress={handleVerify}
                      disabled={code.length < 6}
                    >
                      <Text style={styles.buttonText}>Sign in</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => { setSent(false); setCode(''); setError(null) }}>
                      <Text style={styles.resend}>Use a different email</Text>
                    </TouchableOpacity>
                  </>
                )
              }
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#1A1953' },
  blobWrap: {
    position: 'absolute',
    width: BLOB_SIZE,
    height: BLOB_SIZE,
    marginLeft: -BLOB_SIZE / 2,
    marginTop: -BLOB_SIZE / 2,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 32,
  },
  wordmark: {
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 26,
    color: '#ffffff',
    textAlign: 'center',
  },
  form: {
    gap: 10,
  },
  label: {
    fontFamily: 'Roboto_700Bold',
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  input: {
    height: 48,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#ffffff',
    fontFamily: 'Roboto_400Regular',
  },
  button: {
    height: 48,
    borderRadius: 8,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: {
    fontFamily: 'Roboto_700Bold',
    fontSize: 14,
    color: '#ffffff',
  },
  sent: {
    fontFamily: 'Roboto_400Regular',
    fontSize: 15,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
  },
  error: {
    fontFamily: 'Roboto_400Regular',
    fontSize: 13,
    color: '#f87171',
  },
  resend: {
    fontFamily: 'Roboto_400Regular',
    fontSize: 13,
    color: 'rgba(255,255,255,0.45)',
    textAlign: 'center',
    marginTop: 4,
  },
})
