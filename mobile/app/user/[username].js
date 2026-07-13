// Other-user profile — same dither header card + segmented layout as the own
// profile, under a native transparent Stack header (back chevron + swipe-back
// is the iOS-better choice over the web's in-page back). Photos come from the
// get_user_catches RPC so non-followed profiles show their grid (web parity).
import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  View, Text, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator,
} from 'react-native'
import Animated from 'react-native-reanimated'
import { Stack, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import { supabase } from '../../lib/supabase'
import { C, RADII, FONTS, NAV_CLEARANCE } from '../../lib/theme'
import { ProfileHeaderCard } from '../../components/ProfileHeaderCard'
import { FollowListSheet } from '../../components/FollowListSheet'
import { StatsCharts } from '../../components/StatsCharts'
import { CatchCard } from '../../components/CatchCard'
import { CatchDetailSheet } from '../../components/CatchDetailSheet'
import { SegmentedTabs } from '../../components/SegmentedTabs'
import { useNavScrollHandler } from '../../lib/navScroll'
import { groupPhotos } from '../../lib/groupPhotos'
import { useAuthStore } from '../../store/useAuthStore'
import { usePhotoStore } from '../../store/usePhotoStore'

const PAGE_SIZE = 24

function normalize(row) {
  return { ...row, catchId: row.catch_id, time: row.time ? new Date(row.time).getTime() : null }
}

export default function UserProfileScreen() {
  const { username } = useLocalSearchParams()
  const myUser = useAuthStore(s => s.user)
  const refreshFeed = usePhotoStore(s => s.refreshFeed)
  const addProfiles = usePhotoStore(s => s.addProfiles)
  const insets = useSafeAreaInsets()
  const scrollHandler = useNavScrollHandler()

  const [profile, setProfile] = useState(null)
  const [photos, setPhotos] = useState([])
  const [isFollowing, setIsFollowing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [followLoading, setFollowLoading] = useState(false)
  const [error, setError] = useState(null)
  const [followerCount, setFollowerCount] = useState(null)
  const [followingCount, setFollowingCount] = useState(null)
  const [followListOpen, setFollowListOpen] = useState(false)
  const [followListTab, setFollowListTab] = useState('followers')
  const [activeTab, setActiveTab] = useState('Recent Activity')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [selectedGroup, setSelectedGroup] = useState(null)

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
        if (cancelled) return
        setProfile(profileData)
        addProfiles([profileData])

        const [followRes, photosRes, followerRes, followingRes] = await Promise.all([
          supabase.from('follows')
            .select('follower_id')
            .eq('follower_id', myUser.id)
            .eq('following_id', profileData.id)
            .maybeSingle(),
          // security-definer RPC: visible regardless of follow state (web parity)
          supabase.rpc('get_user_catches', { profile_user_id: profileData.id }),
          supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', profileData.id),
          supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', profileData.id),
        ])

        if (!cancelled) {
          setIsFollowing(!!followRes.data)
          setPhotos((photosRes.data ?? []).map(normalize))
          setFollowerCount(followerRes.count ?? 0)
          setFollowingCount(followingRes.count ?? 0)
          if (photosRes.error) console.error('[user-profile] photos:', photosRes.error)
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

  // Reset per-profile state when switching profiles (no remount on param change)
  useEffect(() => {
    setActiveTab('Recent Activity')
    setVisibleCount(PAGE_SIZE)
    setSelectedGroup(null)
  }, [username])

  const groups = useMemo(() =>
    groupPhotos(photos).sort((a, b) => (b[0].time ?? 0) - (a[0].time ?? 0)),
    [photos]
  )

  const handleFollowToggle = useCallback(async () => {
    if (!myUser || !profile) return
    Haptics.selectionAsync()
    setFollowLoading(true)
    try {
      if (isFollowing) {
        const { error } = await supabase.from('follows')
          .delete()
          .eq('follower_id', myUser.id)
          .eq('following_id', profile.id)
        if (error) throw error
        setIsFollowing(false)
        setFollowerCount(c => c !== null ? Math.max(0, c - 1) : c)
      } else {
        const { error } = await supabase.from('follows')
          .insert({ follower_id: myUser.id, following_id: profile.id })
        if (error) throw error
        setIsFollowing(true)
        setFollowerCount(c => c !== null ? c + 1 : c)
      }
      refreshFeed(myUser.id)
    } catch (err) {
      console.error('[follow]', err)
      Alert.alert('Error', `Failed to ${isFollowing ? 'unfollow' : 'follow'} user.`)
    } finally {
      setFollowLoading(false)
    }
  }, [myUser, profile, isFollowing, refreshFeed])

  const openFollowList = useCallback((tab) => {
    Haptics.selectionAsync()
    setFollowListTab(tab)
    setFollowListOpen(true)
  }, [])

  const visibleGroups = activeTab === 'Recent Activity' ? groups.slice(0, visibleCount) : []

  const renderItem = useCallback(({ item: group }) => (
    <CatchCard
      group={group}
      profile={profile}
      isOwn={false}
      onPress={setSelectedGroup}
    />
  ), [profile])

  const keyExtractor = useCallback(group => group[0].catchId ?? `${group[0].user_id}/${group[0].filename}`, [])

  const screenOptions = {
    title: profile?.username ? `@${profile.username}` : String(username ?? ''),
    headerShown: true,
    headerTransparent: true,
    headerBlurEffect: 'systemUltraThinMaterialDark',
    headerStyle: { backgroundColor: 'transparent' },
    headerTintColor: C.text,
    headerTitleStyle: { fontFamily: FONTS.mono, fontSize: 14 },
    headerBackTitle: '',
    headerShadowVisible: false,
  }

  if (loading || error) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={screenOptions} />
        {loading
          ? <ActivityIndicator size="large" color={C.accent} />
          : <Text style={styles.errorText}>{error}</Text>
        }
      </View>
    )
  }

  const displayName = profile.display_name || profile.username || 'Angler'

  const header = (
    <View>
      <ProfileHeaderCard
        cornerAction={
          <TouchableOpacity
            style={[styles.followBtn, isFollowing && styles.followBtnFollowing]}
            onPress={handleFollowToggle}
            disabled={followLoading}
            activeOpacity={0.85}
          >
            {followLoading
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.followBtnText}>{isFollowing ? 'Following' : 'Follow'}</Text>
            }
          </TouchableOpacity>
        }
        avatarUrl={profile.avatar_url}
        displayName={displayName}
        bio={profile.bio}
        catchCount={groups.length}
        followerCount={followerCount}
        followingCount={followingCount}
        onOpenFollowList={openFollowList}
      />

      <SegmentedTabs
        tabs={['Recent Activity', 'Stats']}
        active={activeTab}
        onChange={setActiveTab}
      />
    </View>
  )

  return (
    <View style={styles.page}>
      <Stack.Screen options={screenOptions} />
      <Animated.FlatList
        data={visibleGroups}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + 52,
          paddingBottom: NAV_CLEARANCE + insets.bottom,
          paddingHorizontal: 12,
          gap: 28,
        }}
        ListHeaderComponent={header}
        ListEmptyComponent={activeTab === 'Recent Activity' ? (
          <Text style={styles.emptyText}>No catches yet</Text>
        ) : null}
        ListFooterComponent={activeTab === 'Stats' ? (
          <StatsCharts groups={groups} />
        ) : null}
        onEndReached={() => {
          if (activeTab === 'Recent Activity' && visibleCount < groups.length) {
            setVisibleCount(c => c + PAGE_SIZE)
          }
        }}
        onEndReachedThreshold={0.4}
      />

      <FollowListSheet
        visible={followListOpen}
        onClose={() => setFollowListOpen(false)}
        profileId={profile?.id}
        initialTab={followListTab}
      />

      <CatchDetailSheet group={selectedGroup} onDismiss={() => setSelectedGroup(null)} />
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.surface },
  centered: { flex: 1, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' },
  errorText: { color: C.muted, fontSize: 16, fontFamily: FONTS.sans },

  followBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 10,
    borderRadius: RADII.pill,
    paddingVertical: 7,
    paddingHorizontal: 16,
    backgroundColor: C.accent,
    minWidth: 84,
    alignItems: 'center',
  },
  followBtnFollowing: {
    backgroundColor: 'rgba(22,22,24,0.4)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  followBtnText: { color: '#fff', fontFamily: FONTS.sansSemiBold, fontSize: 13 },

  emptyText: {
    fontFamily: FONTS.sans,
    color: C.muted,
    fontSize: 15,
    textAlign: 'center',
    paddingTop: 24,
  },
})
