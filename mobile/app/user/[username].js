import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  View, Text, Image, TouchableOpacity, FlatList,
  StyleSheet, Alert, ActivityIndicator, Dimensions,
} from 'react-native'
import { Stack, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { supabase } from '../../lib/supabase'
import { C } from '../../lib/theme'
import { Group } from '../../components/icons.js'
import { SearchModal } from '../../components/SearchModal'
import { FollowListSheet } from '../../components/FollowListSheet'
import { photoUrl } from '../../lib/storage'
import { groupPhotos } from '../../lib/groupPhotos'
import { useAuthStore } from '../../store/useAuthStore'
import { usePhotoStore } from '../../store/usePhotoStore'
import { formatDateFull, cleanSpecies } from '../../lib/formatters'

const { width: SCREEN_W } = Dimensions.get('window')
const GRID_PADDING = 12
const GRID_GAP = 8
const CARD_W = (SCREEN_W - GRID_PADDING * 2 - GRID_GAP) / 2

const QUERY_COLS = 'id, filename, user_id, catch_id, lat, lng, species, time, meta, storage_path'

function normalize(row) {
  return { ...row, catchId: row.catch_id, time: row.time ? new Date(row.time).getTime() : null }
}

function StatBox({ label, value }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  )
}

function CatchCard({ group }) {
  const lead = group[0]
  const uri = photoUrl(lead.user_id, lead.filename, lead.storage_path)
  const species = cleanSpecies(lead.species)
  const dateStr = lead.time ? formatDateFull(lead.time).split(' ·')[0] : null

  return (
    <View style={styles.catchCard}>
      <Image source={{ uri }} style={styles.catchImg} resizeMode="cover" />
      <View style={styles.catchMeta}>
        {species ? <Text style={styles.catchSpecies} numberOfLines={1}>{species}</Text> : null}
        {dateStr ? <Text style={styles.catchDate} numberOfLines={1}>{dateStr}</Text> : null}
      </View>
    </View>
  )
}

export default function UserProfileScreen() {
  const { username } = useLocalSearchParams()
  const myUser = useAuthStore(s => s.user)
  const addPhotos = usePhotoStore(s => s.addPhotos)
  const removeUserPhotos = usePhotoStore(s => s.removeUserPhotos)
  const insets = useSafeAreaInsets()

  const [profile, setProfile] = useState(null)
  const [photos, setPhotos] = useState([])
  const [isFollowing, setIsFollowing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [followLoading, setFollowLoading] = useState(false)
  const [error, setError] = useState(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [followerCount, setFollowerCount] = useState(null)
  const [followingCount, setFollowingCount] = useState(null)
  const [followListOpen, setFollowListOpen] = useState(false)
  const [followListTab, setFollowListTab] = useState('followers')

  useEffect(() => {
    if (!username || !myUser) return
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const { data: profileData, error: profileErr } = await supabase
          .from('profiles').select('*').eq('username', username).single()
        if (profileErr || !profileData) { setError('Profile not found'); return }
        if (!cancelled) setProfile(profileData)

        const [followRes, photosRes, followerRes, followingRes] = await Promise.all([
          supabase.from('follows')
            .select('follower_id')
            .eq('follower_id', myUser.id)
            .eq('following_id', profileData.id)
            .maybeSingle(),
          supabase.from('photos')
            .select(QUERY_COLS)
            .eq('user_id', profileData.id)
            .not('lat', 'is', null)
            .not('lng', 'is', null)
            .order('time', { ascending: false })
            .limit(200),
          supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', profileData.id),
          supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', profileData.id),
        ])

        if (!cancelled) {
          setIsFollowing(!!followRes.data)
          setPhotos((photosRes.data ?? []).map(normalize))
          setFollowerCount(followerRes.count ?? 0)
          setFollowingCount(followingRes.count ?? 0)
        }
      } catch (err) {
        if (!cancelled) setError('Failed to load profile')
        console.error('[user-profile] load:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [username, myUser?.id])

  const groups = useMemo(() => groupPhotos(photos), [photos])

  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth()

  const statsAll = groups.length
  const statsYear = useMemo(() =>
    groups.filter(g => g[0].time && new Date(g[0].time).getFullYear() === currentYear).length,
    [groups, currentYear]
  )
  const statsMonth = useMemo(() =>
    groups.filter(g => {
      if (!g[0].time) return false
      const d = new Date(g[0].time)
      return d.getFullYear() === currentYear && d.getMonth() === currentMonth
    }).length,
    [groups, currentYear, currentMonth]
  )
  const statsSpecies = useMemo(() => {
    const seen = new Set()
    groups.forEach(g => g.forEach(p => { if (p.species) seen.add(p.species.toLowerCase()) }))
    return seen.size
  }, [groups])

  const handleFollow = useCallback(async () => {
    if (!myUser || !profile) return
    setFollowLoading(true)
    try {
      const { error } = await supabase.from('follows')
        .insert({ follower_id: myUser.id, following_id: profile.id })
      if (error) throw error
      setIsFollowing(true)
      setFollowerCount(c => c !== null ? c + 1 : c)
      addPhotos(photos)
    } catch (err) {
      console.error('[follow]', err)
      Alert.alert('Error', 'Failed to follow user.')
    } finally {
      setFollowLoading(false)
    }
  }, [myUser, profile, photos, addPhotos])

  const handleUnfollow = useCallback(async () => {
    if (!myUser || !profile) return
    setFollowLoading(true)
    try {
      const { error } = await supabase.from('follows')
        .delete()
        .eq('follower_id', myUser.id)
        .eq('following_id', profile.id)
      if (error) throw error
      setIsFollowing(false)
      setFollowerCount(c => c !== null ? Math.max(0, c - 1) : c)
      removeUserPhotos(profile.id)
    } catch (err) {
      console.error('[unfollow]', err)
      Alert.alert('Error', 'Failed to unfollow user.')
    } finally {
      setFollowLoading(false)
    }
  }, [myUser, profile, removeUserPhotos])

  const renderHeader = useCallback(() => {
    if (!profile) return null
    const avatarUrl = profile.avatar_url
    const displayName = profile.display_name || profile.username || 'Angler'
    const initial = displayName[0].toUpperCase()

    return (
      <View style={styles.profileHeader}>
        {avatarUrl
          ? <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarInitial}>{initial}</Text>
            </View>
          )
        }
        <Text style={styles.displayName}>{displayName}</Text>
        {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}
        <View style={styles.statsRow}>
          <StatBox label="Catches" value={statsAll} />
          <View style={styles.statDivider} />
          <StatBox label="Year" value={statsYear} />
          <View style={styles.statDivider} />
          <StatBox label="Month" value={statsMonth} />
          <View style={styles.statDivider} />
          <StatBox label="Species" value={statsSpecies} />
        </View>

        <TouchableOpacity
          style={[styles.followBtn, isFollowing && styles.followBtnFollowing, followLoading && styles.followBtnDisabled]}
          onPress={isFollowing ? handleUnfollow : handleFollow}
          disabled={followLoading}
          activeOpacity={0.8}
        >
          {followLoading
            ? <ActivityIndicator size="small" color={isFollowing ? C.muted : '#fff'} />
            : <Text style={[styles.followBtnText, isFollowing && styles.followBtnTextFollowing]}>
                {isFollowing ? 'Following' : 'Follow'}
              </Text>
          }
        </TouchableOpacity>

        {groups.length > 0 && (
          <Text style={styles.sectionLabel}>Catches</Text>
        )}
      </View>
    )
  }, [profile, statsAll, statsYear, statsMonth, statsSpecies, isFollowing, followLoading, handleFollow, handleUnfollow, followerCount, followingCount])

  const renderItem = useCallback(({ item }) => <CatchCard group={item} />, [])
  const keyExtractor = useCallback(item => item[0].catchId ?? item[0].filename, [])

  if (loading) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ title: username, headerShown: true, headerStyle: { backgroundColor: C.bg }, headerTintColor: C.text, headerBackTitle: '', headerRight: () => (
          <TouchableOpacity onPress={() => setSearchOpen(true)} hitSlop={12} style={{ paddingHorizontal: 4 }}>
            <Group width={20} height={20} color={C.text} strokeWidth={1.5} />
          </TouchableOpacity>
        ) }} />
        <ActivityIndicator size="large" color={C.accent} />
      </View>
    )
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ title: username, headerShown: true, headerStyle: { backgroundColor: C.bg }, headerTintColor: C.text, headerBackTitle: '', headerRight: () => (
          <TouchableOpacity onPress={() => setSearchOpen(true)} hitSlop={12} style={{ paddingHorizontal: 4 }}>
            <Group width={20} height={20} color={C.text} strokeWidth={1.5} />
          </TouchableOpacity>
        ) }} />
        <Text style={styles.errorText}>{error}</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: profile?.username ?? username,
          headerShown: true,
          headerStyle: { backgroundColor: C.bg },
          headerTintColor: C.text,
          headerBackTitle: '',
          headerShadowVisible: false,
          headerRight: () => (
            <TouchableOpacity onPress={() => setSearchOpen(true)} hitSlop={12} style={{ paddingHorizontal: 4 }}>
              <Group width={20} height={20} color={C.text} strokeWidth={1.5} />
            </TouchableOpacity>
          ),
        }}
      />
      <FlatList
        data={groups}
        numColumns={2}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No catches yet</Text>
          </View>
        }
        columnWrapperStyle={styles.columnWrapper}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
      />
      <SearchModal visible={searchOpen} onClose={() => setSearchOpen(false)} />
      <FollowListSheet
        visible={followListOpen}
        onClose={() => setFollowListOpen(false)}
        profileId={profile?.id}
        initialTab={followListTab}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  centered: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  errorText: { color: C.muted, fontSize: 16 },

  profileHeader: { paddingHorizontal: GRID_PADDING, paddingTop: 24, paddingBottom: 16, alignItems: 'center' },

  avatar: { width: 80, height: 80, borderRadius: 40, marginBottom: 12 },
  avatarFallback: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  avatarInitial: { fontSize: 36, fontWeight: '600', color: C.text },

  displayName: { fontSize: 22, fontWeight: '700', color: C.text, marginBottom: 4 },
  bio: { fontSize: 16, color: C.muted, textAlign: 'center', lineHeight: 22, marginBottom: 16 },

  statsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  statBox: { alignItems: 'center', paddingHorizontal: 16 },
  statValue: { fontSize: 22, fontWeight: '700', color: C.text },
  statLabel: { fontSize: 12, color: C.muted, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
  statDivider: { width: 1, height: 28, backgroundColor: C.border },

  followBtn: {
    backgroundColor: C.accent,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 32,
    marginBottom: 24,
    minWidth: 120,
    alignItems: 'center',
  },
  followBtnFollowing: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  followBtnDisabled: { opacity: 0.6 },
  followBtnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  followBtnTextFollowing: { color: C.muted },

  sectionLabel: {
    fontSize: 14, fontWeight: '600', color: C.muted,
    textTransform: 'uppercase', letterSpacing: 0.8,
    alignSelf: 'flex-start', width: '100%', marginBottom: 10,
  },

  columnWrapper: { paddingHorizontal: GRID_PADDING, gap: GRID_GAP, marginBottom: GRID_GAP },
  catchCard: { width: CARD_W, borderRadius: 10, overflow: 'hidden', backgroundColor: C.surface },
  catchImg: { width: CARD_W, height: CARD_W * 0.75, backgroundColor: C.border },
  catchMeta: { padding: 8 },
  catchSpecies: { fontSize: 14, fontWeight: '600', color: C.text, marginBottom: 2 },
  catchDate: { fontSize: 12, color: C.muted },

  emptyState: { alignItems: 'center', paddingTop: 40 },
  emptyText: { color: C.muted, fontSize: 16 },
})
