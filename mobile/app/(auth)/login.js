import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native'
import { supabase } from '../../lib/supabase'
import { MeshBackground } from '../../components/MeshBackground'
import { C } from '../../lib/theme'

const BLOBS = [
  { x: 58, y: 33, color: '#2563eb', dx: 0.8,  dy: 0.6,  offset: 0.0 },
  { x: 27, y: 45, color: '#64748b', dx: 0.7,  dy: -0.8, offset: 1.3 },
  { x: 74, y: 66, color: '#1A1953', dx: -0.6, dy: 0.5,  offset: 2.6 },
  { x: 35, y: 67, color: '#a1a1aa', dx: 0.9,  dy: -0.7, offset: 3.9 },
  { x: 18, y: 40, color: '#f4f4f5', dx: 0.5,  dy: 0.4,  offset: 5.2 },
  { x: 31, y: 18, color: '#2c2c2e', dx: 0.6,  dy: 0.8,  offset: 6.5 },
  { x: 72, y: 88, color: '#2563eb', dx: -0.7, dy: 0.5,  offset: 7.8 },
  { x: 18, y: 82, color: '#64748b', dx: 0.6,  dy: -0.6, offset: 9.1 },
]

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
      <MeshBackground blobs={BLOBS} bgColor="#1A1953" />
      <KeyboardAvoidingView
        style={styles.center}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Text style={styles.wordmark}>HookSpot</Text>

        <View style={styles.form}>
          {!sent ? (
            <>
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
  center: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 32,
  },
  wordmark: {
    fontFamily: 'GeistPixel',
    fontSize: 36,
    color: '#ffffff',
    textAlign: 'center',
  },
  form: {
    gap: 10,
  },
  label: {
    fontFamily: 'Roboto_700Bold',
    fontSize: 12,
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
    fontSize: 16,
    color: '#ffffff',
    fontFamily: 'RobotoMono_400Regular',
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
    fontSize: 16,
    color: '#ffffff',
  },
  sent: {
    fontFamily: 'Roboto_400Regular',
    fontSize: 16,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
  },
  error: {
    fontFamily: 'Roboto_400Regular',
    fontSize: 14,
    color: '#f87171',
  },
  resend: {
    fontFamily: 'Roboto_400Regular',
    fontSize: 14,
    color: 'rgba(255,255,255,0.45)',
    textAlign: 'center',
    marginTop: 4,
  },
})
