import { useState, useEffect } from 'react'
import {
  View, Text, Image, TouchableOpacity,
  FlatList, Modal, StyleSheet,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { supabase } from '../lib/supabase'
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

export function FollowListSheet({ visible, onClose, profileId, initialTab }) {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [activeTab, setActiveTab] = useState(initialTab || 'followers')
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(false)

  // Sync tab when sheet re-opens
  useEffect(() => {
    if (visible) setActiveTab(initialTab || 'followers')
  }, [visible, initialTab])

  useEffect(() => {
    if (!visible || !profileId) return
    setLoading(true)
    setList([])
    ;(async () => {
      try {
        let data, error
        if (activeTab === 'followers') {
          const res = await supabase
            .from('follows')
            .select('profiles!follower_id(id,username,display_name,avatar_url)')
            .eq('following_id', profileId)
          data = res.data; error = res.error
          if (!error && data) { setList(data.map(r => r.profiles).filter(Boolean)); return }
        } else {
          const res = await supabase
            .from('follows')
            .select('profiles!following_id(id,username,display_name,avatar_url)')
            .eq('follower_id', profileId)
          data = res.data; error = res.error
          if (!error && data) { setList(data.map(r => r.profiles).filter(Boolean)); return }
        }
        // Fallback: two-query approach
        const idsRes = activeTab === 'followers'
          ? await supabase.from('follows').select('follower_id').eq('following_id', profileId)
          : await supabase.from('follows').select('following_id').eq('follower_id', profileId)
        const ids = (idsRes.data || []).map(r => r.follower_id || r.following_id)
        if (ids.length > 0) {
          const profilesRes = await supabase.from('profiles').select('id,username,display_name,avatar_url').in('id', ids)
          setList(profilesRes.data || [])
        }
      } finally {
        setLoading(false)
      }
    })()
  }, [visible, activeTab, profileId])

  function goToUser(username) {
    onClose()
    router.push(`/user/${username}`)
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
        <View style={styles.header}>
          <Text style={styles.title}>
            {activeTab === 'followers' ? 'Followers' : 'Following'}
          </Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>Done</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.tabRow}>
          {[{ id: 'followers', label: 'Followers' }, { id: 'following', label: 'Following' }].map(({ id, label }) => (
            <TouchableOpacity
              key={id}
              style={[styles.tabPill, activeTab === id && styles.tabPillActive]}
              onPress={() => setActiveTab(id)}
            >
              <Text style={[styles.tabPillText, activeTab === id && styles.tabPillTextActive]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <FlatList
          data={list}
          keyExtractor={item => item.id}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              {loading ? 'Loading…' : activeTab === 'followers' ? 'No followers yet' : 'Not following anyone yet'}
            </Text>
          }
          renderItem={({ item }) => (
            <UserRow user={item} onPress={() => goToUser(item.username)} />
          )}
          contentContainerStyle={styles.listContent}
        />
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
  },

  title: { fontSize: 18, fontWeight: '600', color: C.text },

  closeBtn: { paddingHorizontal: 4, paddingVertical: 6 },
  closeBtnText: { color: C.accent, fontSize: 16, fontWeight: '600' },

  tabRow: {
    flexDirection: 'row',
    backgroundColor: C.surface,
    borderRadius: 10,
    padding: 3,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
  },

  tabPill: { flex: 1, paddingVertical: 7, borderRadius: 8, alignItems: 'center' },
  tabPillActive: { backgroundColor: '#3a3a3c' },
  tabPillText: { fontSize: 14, fontWeight: '500', color: C.muted },
  tabPillTextActive: { color: C.text, fontWeight: '600' },

  listContent: { paddingBottom: 32 },

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
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
  },

  avatarInitial: { fontSize: 16, fontWeight: '600', color: C.muted },

  userInfo: { flex: 1, minWidth: 0 },
  displayName: { fontSize: 15, fontWeight: '600', color: C.text },
  username: { fontSize: 13, color: C.muted, marginTop: 1 },
})
