import { useState, useRef, useCallback } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, ScrollView, Platform, ActivityIndicator,
  Image, Alert,
} from 'react-native'
import { router } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import { supabase } from '../../lib/supabase'
import { uploadAvatar } from '../../lib/upload'
import { useAuthStore } from '../../store/useAuthStore'
import { USERNAME_RE } from '../../lib/validation'
import { MeshBackground } from '../../components/MeshBackground'

export default function OnboardingScreen() {
  const user = useAuthStore(s => s.user)
  const setUsernameStore = useAuthStore(s => s.setUsername)

  const [avatarUri, setAvatarUri] = useState(null)
  const [avatarAsset, setAvatarAsset] = useState(null)
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
      quality: 0.7,
    })
    if (result.canceled) return
    setAvatarUri(result.assets[0].uri)
    setAvatarAsset(result.assets[0])
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
    if (!avatarAsset) {
      Alert.alert('Profile photo', 'Please choose a profile photo to continue.')
      return
    }
    const ok = await checkUsername(username)
    if (!ok) return
    setSaving(true)
    try {
      const trimmedName = displayName.trim() || null
      const trimmedBio = bio.trim() || null

      const avatarUrl = await uploadAvatar(user.id, avatarAsset)

      const { error: profileError } = await supabase.from('profiles').upsert({
        id: user.id,
        username,
        display_name: trimmedName,
        bio: trimmedBio,
        avatar_url: avatarUrl,
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

  const canSubmit = usernameStatus === 'ok' && !!avatarAsset && !saving

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
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 64,
    paddingBottom: 40,
    gap: 24,
  },
  wordmark: {
    fontFamily: 'GeistPixel',
    fontSize: 28,
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
    fontSize: 22,
    color: '#ffffff',
    marginBottom: 12,
  },
  label: {
    fontFamily: 'Roboto_700Bold',
    fontSize: 12,
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
    fontSize: 12,
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
    fontSize: 16,
    color: '#ffffff',
    fontFamily: 'Roboto_400Regular',
    marginTop: 6,
  },
  inputError: { borderColor: '#f87171' },
  inputOk: { borderColor: '#4ade80' },
  inputMultiline: { height: 80, paddingTop: 12 },
  fieldError: {
    fontFamily: 'Roboto_400Regular',
    fontSize: 14,
    color: '#f87171',
    marginTop: 3,
  },
  fieldHint: {
    fontFamily: 'Roboto_400Regular',
    fontSize: 14,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 3,
  },
  fieldOk: {
    fontFamily: 'Roboto_400Regular',
    fontSize: 14,
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
    fontSize: 16,
    color: '#ffffff',
  },
})
