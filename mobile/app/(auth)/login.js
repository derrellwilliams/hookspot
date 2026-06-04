import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native'
import { supabase } from '../../lib/supabase'
import { MeshBackground } from '../../components/MeshBackground'

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
