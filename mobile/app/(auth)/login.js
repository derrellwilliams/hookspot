import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, useWindowDimensions,
} from 'react-native'
import { supabase } from '../../lib/supabase'
import { DitherMesh } from '../../components/DitherMesh'
import { C } from '../../lib/theme'

export default function LoginScreen() {
  // Explicit dimensions: with flex:1, this screen's subtree can get a
  // zero-height first layout under rn-screens + Fabric that never corrects,
  // collapsing the form and breaking sibling paint order.
  const { width, height } = useWindowDimensions()
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
    <View style={[styles.page, { width, height }]}>
      <DitherMesh />
      {/* Absolute with explicit dims: in-flow or flex-sized content here can
          get a zero-height first layout (rn-screens + Fabric) and absolute
          siblings paint above in-flow ones — keep both layers absolute */}
      <View style={{ position: 'absolute', top: 0, left: 0, width, height }}>
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
    zIndex: 1, // paint above the absolute DitherMesh background
  },
  wordmark: {
    fontFamily: 'GeistPixel',
    fontSize: 48,
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
