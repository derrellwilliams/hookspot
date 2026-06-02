import { useState, useRef, useCallback, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, ScrollView, Platform, ActivityIndicator,
  Image, Alert,
} from 'react-native'
import { router } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import Reanimated, {
  useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing,
} from 'react-native-reanimated'
import { Svg, Defs, RadialGradient, Stop, Circle } from 'react-native-svg'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/useAuthStore'
import { USERNAME_RE } from '../../lib/validation'

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

export default function OnboardingScreen() {
  const user = useAuthStore(s => s.user)
  const setUsernameStore = useAuthStore(s => s.setUsername)

  const [avatarUri, setAvatarUri] = useState(null)
  const [avatarDataUrl, setAvatarDataUrl] = useState(null)
  const [username, setUsernameVal] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [usernameStatus, setUsernameStatus] = useState('idle') // 'idle'|'checking'|'ok'|'error'
  const [usernameError, setUsernameError] = useState('')
  const [saving, setSaving] = useState(false)

  const checkCountRef = useRef(0)
  const lastChecked = useRef({ val: null, ok: false })

  const pickAvatar = useCallback(async () => {
    const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!granted) {
      Alert.alert('Permission needed', 'Allow photo access to set a profile picture.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      base64: true,
      quality: 0.7,
    })
    if (result.canceled) return
    setAvatarUri(result.assets[0].uri)
    setAvatarDataUrl(`data:image/jpeg;base64,${result.assets[0].base64}`)
  }, [])

  async function checkUsername(val) {
    if (!USERNAME_RE.test(val)) {
      setUsernameStatus('error')
      setUsernameError('3–20 chars: lowercase letters, numbers, - or _')
      return false
    }
    if (lastChecked.current.val === val) return lastChecked.current.ok
    setUsernameStatus('checking')
    const thisCheck = ++checkCountRef.current
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', val)
        .limit(1)
      if (thisCheck !== checkCountRef.current) return false
      if (error) throw error
      const available = data.length === 0
      lastChecked.current = { val, ok: available }
      if (available) {
        setUsernameStatus('ok')
        setUsernameError('')
        return true
      } else {
        setUsernameStatus('error')
        setUsernameError('That username is taken')
        return false
      }
    } catch {
      if (thisCheck !== checkCountRef.current) return false
      setUsernameStatus('error')
      setUsernameError('Could not check username. Try again.')
      return false
    }
  }

  function handleUsernameChange(val) {
    const clean = val.toLowerCase().replace(/[^a-z0-9_-]/g, '')
    setUsernameVal(clean)
    setUsernameStatus('idle')
    setUsernameError('')
    lastChecked.current = { val: null, ok: false }
  }

  async function handleSave() {
    if (saving) return
    if (!avatarDataUrl) {
      Alert.alert('Profile photo', 'Please choose a profile photo to continue.')
      return
    }
    const ok = await checkUsername(username)
    if (!ok) return
    setSaving(true)
    try {
      const trimmedName = displayName.trim() || null
      const trimmedBio = bio.trim() || null

      const { error: profileError } = await supabase.from('profiles').upsert({
        id: user.id,
        username,
        display_name: trimmedName,
        bio: trimmedBio,
        avatar_url: avatarDataUrl,
      })
      if (profileError) throw profileError

      // avatar_url lives in profiles only — keep user_metadata slim to avoid bloating the JWT
      const metaUpdate = {}
      if (trimmedName) metaUpdate.display_name = trimmedName
      if (trimmedBio) metaUpdate.bio = trimmedBio
      if (Object.keys(metaUpdate).length > 0) {
        const { error: authError } = await supabase.auth.updateUser({ data: metaUpdate })
        if (authError) throw authError
      }

      setUsernameStore(username)
      router.replace('/(tabs)/map')
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to save profile. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const canSubmit = usernameStatus === 'ok' && !!avatarDataUrl && !saving

  return (
    <View style={styles.page}>
      <MeshBackground />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.wordmark}>Hook Spot</Text>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Let's set up your profile.</Text>

            {/* Avatar */}
            <Text style={styles.label}>Profile photo <Text style={styles.required}>*</Text></Text>
            <TouchableOpacity style={styles.avatarBtn} onPress={pickAvatar} activeOpacity={0.8}>
              {avatarUri
                ? <Image source={{ uri: avatarUri }} style={styles.avatarImg} />
                : (
                  <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarPlaceholderText}>Tap to choose</Text>
                  </View>
                )
              }
            </TouchableOpacity>

            {/* Username */}
            <Text style={[styles.label, { marginTop: 16 }]}>
              Username <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={[
                styles.input,
                usernameStatus === 'error' && styles.inputError,
                usernameStatus === 'ok' && styles.inputOk,
              ]}
              value={username}
              onChangeText={handleUsernameChange}
              onBlur={() => username && checkUsername(username)}
              placeholder="your-handle"
              placeholderTextColor="rgba(255,255,255,0.3)"
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={20}
            />
            {usernameStatus === 'error' && (
              <Text style={styles.fieldError}>{usernameError}</Text>
            )}
            {usernameStatus === 'checking' && (
              <Text style={styles.fieldHint}>Checking availability…</Text>
            )}
            {usernameStatus === 'ok' && (
              <Text style={styles.fieldOk}>@{username} is available</Text>
            )}

            {/* Display name */}
            <Text style={[styles.label, { marginTop: 16 }]}>Full name</Text>
            <TextInput
              style={styles.input}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Your name"
              placeholderTextColor="rgba(255,255,255,0.3)"
              maxLength={60}
            />

            {/* Bio */}
            <Text style={[styles.label, { marginTop: 16 }]}>Bio</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              value={bio}
              onChangeText={setBio}
              placeholder="Tell us about yourself"
              placeholderTextColor="rgba(255,255,255,0.3)"
              maxLength={200}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={[styles.button, !canSubmit && styles.buttonDisabled]}
              onPress={handleSave}
              disabled={!canSubmit}
              activeOpacity={0.85}
            >
              {saving
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.buttonText}>Get started</Text>
              }
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#1A1953' },
  flex: { flex: 1 },
  blobWrap: {
    position: 'absolute',
    width: BLOB_SIZE,
    height: BLOB_SIZE,
    marginLeft: -BLOB_SIZE / 2,
    marginTop: -BLOB_SIZE / 2,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 64,
    paddingBottom: 40,
    gap: 24,
  },
  wordmark: {
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 26,
    color: '#ffffff',
    textAlign: 'center',
  },
  card: {
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 20,
    gap: 6,
  },
  cardTitle: {
    fontFamily: 'Roboto_700Bold',
    fontSize: 18,
    color: '#ffffff',
    marginBottom: 12,
  },
  label: {
    fontFamily: 'Roboto_700Bold',
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  required: { color: '#f87171' },
  avatarBtn: {
    alignSelf: 'flex-start',
    marginTop: 6,
    marginBottom: 2,
  },
  avatarImg: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPlaceholderText: {
    fontFamily: 'Roboto_400Regular',
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
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
    marginTop: 6,
  },
  inputError: { borderColor: '#f87171' },
  inputOk: { borderColor: '#4ade80' },
  inputMultiline: { height: 80, paddingTop: 12 },
  fieldError: {
    fontFamily: 'Roboto_400Regular',
    fontSize: 12,
    color: '#f87171',
    marginTop: 3,
  },
  fieldHint: {
    fontFamily: 'Roboto_400Regular',
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 3,
  },
  fieldOk: {
    fontFamily: 'Roboto_400Regular',
    fontSize: 12,
    color: '#4ade80',
    marginTop: 3,
  },
  button: {
    height: 48,
    borderRadius: 8,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  buttonDisabled: { opacity: 0.45 },
  buttonText: {
    fontFamily: 'Roboto_700Bold',
    fontSize: 14,
    color: '#ffffff',
  },
})
