import { useState, useEffect, useRef } from 'react'
import {
  View, Text, Image, TextInput, TouchableOpacity,
  FlatList, Modal, StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/useAuthStore'
import { C } from '../lib/theme'

function UserRow({ user, onPress }) {
  const initial = (user.display_name || user.username || '?')[0].toUpperCase()
  return (
    <TouchableOpacity style={styles.userRow} onPress={onPress} activeOpacity={0.7}>
      {user.avatar_url
        ? <Image source={{ uri: user.avatar_url }} style={styles.avatar} />
        : <View style={styles.avatarFallback}><Text style={styles.avatarInitial}>{initial}</Text></View>
      }
      <View style={styles.userInfo}>
        <Text style={styles.displayName} numberOfLines={1}>{user.display_name || user.username}</Text>
        <Text style={styles.username} numberOfLines={1}>@{user.username}</Text>
      </View>
    </TouchableOpacity>
  )
}

export function SearchModal({ visible, onClose }) {
  const router = useRouter()
  const myUser = useAuthStore(s => s.user)
  const insets = useSafeAreaInsets()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [following, setFollowing] = useState([])

  // Load "people you follow" on open
  useEffect(() => {
    if (!visible || !myUser?.id) return
    supabase
      .from('follows')
      .select('profiles!following_id(id,username,display_name,avatar_url)')
      .eq('follower_id', myUser.id)
      .then(({ data }) => {
        if (data) setFollowing(data.map(r => r.profiles).filter(Boolean))
      })
  }, [visible, myUser?.id])

  // Reset on close
  useEffect(() => {
    if (!visible) setQuery('')
  }, [visible])

  // Debounced search
  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id,username,display_name,avatar_url')
        .or(`username.ilike.%${query.trim()}%,display_name.ilike.%${query.trim()}%`)
        .limit(20)
      setResults(data || [])
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  function goToUser(username) {
    onClose()
    router.push(`/user/${username}`)
  }

  const showFollowing = !query.trim() && following.length > 0
  const showResults = !!query.trim()

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <TextInput
            style={styles.input}
            value={query}
            onChangeText={setQuery}
            placeholder="Search anglers…"
            placeholderTextColor={C.muted}
            autoFocus
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
          />
          <TouchableOpacity onPress={onClose} style={styles.cancelBtn}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={showResults ? results : (showFollowing ? following : [])}
          keyExtractor={item => item.id}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={showFollowing ? (
            <Text style={styles.sectionLabel}>People you follow</Text>
          ) : null}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              {query.trim()
                ? `No anglers found for "${query}"`
                : 'Search for anglers by name or username'}
            </Text>
          }
          renderItem={({ item }) => (
            <UserRow user={item} onPress={() => goToUser(item.username)} />
          )}
          contentContainerStyle={styles.listContent}
        />
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
  },

  input: {
    flex: 1,
    backgroundColor: C.surface,
    color: C.text,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    borderWidth: 1,
    borderColor: C.border,
  },

  cancelBtn: { paddingHorizontal: 4, paddingVertical: 6 },
  cancelText: { color: C.muted, fontSize: 16 },

  listContent: { paddingBottom: 32 },

  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: C.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 6,
  },

  emptyText: {
    color: C.muted,
    fontSize: 15,
    textAlign: 'center',
    paddingTop: 48,
    paddingHorizontal: 20,
  },

  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },

  avatar: { width: 40, height: 40, borderRadius: 20 },

  avatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },

  avatarInitial: { fontSize: 16, fontWeight: '600', color: C.muted },

  userInfo: { flex: 1, minWidth: 0 },

  displayName: { fontSize: 15, fontWeight: '600', color: C.text },
  username: { fontSize: 13, color: C.muted, marginTop: 1 },
})
