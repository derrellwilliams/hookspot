// Own profile — native port of the web mobile UserProfilePage: contained
// dither header card (avatar, name, bio, Catches/Followers/Following),
// segmented Recent Activity / Stats, single-column catch cards. Settings via
// ActionSheetIOS (native-better than the web dropdown); edit profile/gear stay
// native pageSheet modals.
import { useState, useMemo, useCallback, useEffect } from 'react'
import {
  View, Text, Image, TouchableOpacity, Pressable, Modal,
  TextInput, ScrollView, StyleSheet, Alert, ActionSheetIOS,
  Platform, ActivityIndicator, KeyboardAvoidingView,
} from 'react-native'
import Animated from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as ImagePicker from 'expo-image-picker'
import * as Haptics from 'expo-haptics'
import { BlurView } from 'expo-blur'
import { Settings } from '../../components/icons.js'
import { supabase } from '../../lib/supabase'
import { C, GLASS, RADII, FONTS, SPRINGS, NAV_CLEARANCE } from '../../lib/theme'
import { uploadAvatar } from '../../lib/upload'
import { useNavScrollHandler } from '../../lib/navScroll'
import { DitherMesh } from '../../components/DitherMesh'
import { FollowListSheet } from '../../components/FollowListSheet'
import { StatsCharts } from '../../components/StatsCharts'
import { CatchCard } from '../../components/CatchCard'
import { CatchDetailSheet } from '../../components/CatchDetailSheet'
import { useAuthStore } from '../../store/useAuthStore'
import { usePhotoStore } from '../../store/usePhotoStore'
import { SegmentedTabs } from '../../components/SegmentedTabs'
import { getDisplayName } from '../../lib/formatters'

const PAGE_SIZE = 24

export default function ProfileScreen() {
  const user = useAuthStore(s => s.user)
  const setUser = useAuthStore(s => s.setUser)
  const signOut = useAuthStore(s => s.signOut)
  const profile = useAuthStore(s => s.profile)
  const setProfile = useAuthStore(s => s.setProfile)
  const groups = usePhotoStore(s => s.groups)
  const profilesById = usePhotoStore(s => s.profilesById)
  const insets = useSafeAreaInsets()
  const scrollHandler = useNavScrollHandler()

  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url ?? null)
  const [uploading, setUploading] = useState(false)
  const [editProfileOpen, setEditProfileOpen] = useState(false)
  const [editName, setEditName] = useState('')
  const [editBio, setEditBio] = useState('')
  const [saving, setSaving] = useState(false)
  const [editGearOpen, setEditGearOpen] = useState(false)
  const [rods, setRods] = useState([])
  const [flies, setFlies] = useState([])
  const [newRod, setNewRod] = useState('')
  const [newFly, setNewFly] = useState('')
  const [gearSaving, setGearSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('Recent Activity')
  const [followerCount, setFollowerCount] = useState(null)
  const [followingCount, setFollowingCount] = useState(null)
  const [followListOpen, setFollowListOpen] = useState(false)
  const [followListTab, setFollowListTab] = useState('followers')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [selectedGroup, setSelectedGroup] = useState(null)

  useEffect(() => {
    setAvatarUrl(profile?.avatar_url ?? null)
  }, [profile?.avatar_url])

  const ownGroups = useMemo(() =>
    groups
      .filter(g => g[0]?.user_id === user?.id)
      .sort((a, b) => (b[0].time ?? 0) - (a[0].time ?? 0)),
    [groups, user?.id]
  )

  const displayName = getDisplayName(user?.user_metadata) || 'Angler'
  const bio = user?.user_metadata?.bio ?? null

  useEffect(() => {
    if (!user?.id) return
    Promise.all([
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', user.id),
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', user.id),
    ]).then(([followerRes, followingRes]) => {
      setFollowerCount(followerRes.count ?? 0)
      setFollowingCount(followingRes.count ?? 0)
    })
  }, [user?.id])

  const pickAvatar = useCallback(async () => {
    const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!granted) return
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    })
    if (result.canceled) return
    setUploading(true)
    try {
      const url = await uploadAvatar(user.id, result.assets[0])
      const { error } = await supabase.from('profiles').upsert({ id: user.id, avatar_url: url })
      if (error) throw error
      setAvatarUrl(url)
      setProfile({ avatar_url: url })
    } catch {
      Alert.alert('Error', 'Failed to update profile photo.')
    } finally {
      setUploading(false)
    }
  }, [user.id, setProfile])

  const openEditProfile = useCallback(() => {
    setEditName(user?.user_metadata?.display_name || user?.user_metadata?.full_name || '')
    setEditBio(user?.user_metadata?.bio || '')
    setEditProfileOpen(true)
  }, [user])

  async function saveProfile() {
    setSaving(true)
    try {
      const { data, error } = await supabase.auth.updateUser({
        data: { display_name: editName.trim(), bio: editBio.trim() },
      })
      if (error) throw error
      await supabase.from('profiles').upsert({
        id: user.id,
        display_name: editName.trim() || null,
        bio: editBio.trim() || null,
        avatar_url: avatarUrl,
      })
      setUser(data.user)
      setEditProfileOpen(false)
    } catch {
      Alert.alert('Error', 'Failed to save profile.')
    } finally {
      setSaving(false)
    }
  }

  const openEditGear = useCallback(() => {
    const savedRods = user?.user_metadata?.gear_rods
    const savedFlies = user?.user_metadata?.gear_flies
    setRods(savedRods != null
      ? savedRods
      : [...new Set(ownGroups.flatMap(g => g.map(p => p.meta?.rod).filter(Boolean)))]
    )
    setFlies(savedFlies != null
      ? savedFlies
      : [...new Set(ownGroups.flatMap(g => g.map(p => p.meta?.fly).filter(Boolean)))]
    )
    setNewRod('')
    setNewFly('')
    setEditGearOpen(true)
  }, [user, ownGroups])

  const openSettings = useCallback(() => {
    Haptics.selectionAsync()
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Edit Profile', 'Edit Gear', 'Sign Out'],
          cancelButtonIndex: 0,
          destructiveButtonIndex: 3,
        },
        idx => {
          if (idx === 1) openEditProfile()
          else if (idx === 2) openEditGear()
          else if (idx === 3) signOut()
        }
      )
    } else {
      Alert.alert('Settings', undefined, [
        { text: 'Edit Profile', onPress: openEditProfile },
        { text: 'Edit Gear', onPress: openEditGear },
        { text: 'Sign Out', style: 'destructive', onPress: signOut },
        { text: 'Cancel', style: 'cancel' },
      ])
    }
  }, [openEditProfile, openEditGear, signOut])

  async function saveGear() {
    setGearSaving(true)
    try {
      const { data, error } = await supabase.auth.updateUser({
        data: { gear_rods: rods, gear_flies: flies },
      })
      if (error) throw error
      setUser(data.user)
      setEditGearOpen(false)
    } catch {
      Alert.alert('Error', 'Failed to save gear.')
    } finally {
      setGearSaving(false)
    }
  }

  function addRod() {
    const val = newRod.trim()
    if (!val || rods.includes(val)) { setNewRod(''); return }
    setRods(prev => [...prev, val])
    setNewRod('')
  }

  function addFly() {
    const val = newFly.trim()
    if (!val || flies.includes(val)) { setNewFly(''); return }
    setFlies(prev => [...prev, val])
    setNewFly('')
  }

  const openFollowList = useCallback((tab) => {
    Haptics.selectionAsync()
    setFollowListTab(tab)
    setFollowListOpen(true)
  }, [])

  const visibleGroups = activeTab === 'Recent Activity' ? ownGroups.slice(0, visibleCount) : []

  const renderItem = useCallback(({ item: group }) => (
    <CatchCard
      group={group}
      profile={profilesById[group[0].user_id]}
      isOwn
      onPress={setSelectedGroup}
    />
  ), [profilesById])

  const keyExtractor = useCallback((group) => group[0].catchId ?? `${group[0].user_id}/${group[0].filename}`, [])

  const header = (
    <View>
      {/* Contained dither header card */}
      <View style={styles.headerCard}>
        <DitherMesh />
        <TouchableOpacity
          style={styles.gearBtn}
          onPress={openSettings}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Settings"
        >
          <BlurView tint="dark" intensity={60} style={StyleSheet.absoluteFill} />
          <Settings size={16} color="#fff" strokeWidth={2} />
        </TouchableOpacity>

        <View style={styles.headerInner}>
          <TouchableOpacity onPress={pickAvatar} disabled={uploading} accessibilityLabel="Change profile photo">
            {avatarUrl
              ? <Image source={{ uri: avatarUrl }} style={styles.avatar} />
              : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Text style={styles.avatarInitial}>{displayName[0].toUpperCase()}</Text>
                </View>
              )
            }
            {uploading && (
              <View style={styles.avatarOverlay}>
                <ActivityIndicator color="#fff" size="small" />
              </View>
            )}
          </TouchableOpacity>
          <Text style={styles.displayName}>{displayName}</Text>
          {bio ? <Text style={styles.bio} numberOfLines={2}>{bio}</Text> : null}

          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{ownGroups.length}</Text>
              <Text style={styles.statLabel}>Catches</Text>
            </View>
            <Pressable
              style={({ pressed }) => [styles.stat, pressed && styles.statPressed]}
              onPress={() => openFollowList('followers')}
              accessibilityRole="button"
            >
              <Text style={styles.statValue}>{followerCount ?? '—'}</Text>
              <Text style={styles.statLabel}>Followers</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.stat, pressed && styles.statPressed]}
              onPress={() => openFollowList('following')}
              accessibilityRole="button"
            >
              <Text style={styles.statValue}>{followingCount ?? '—'}</Text>
              <Text style={styles.statLabel}>Following</Text>
            </Pressable>
          </View>
        </View>
      </View>

      <SegmentedTabs
        tabs={['Recent Activity', 'Stats']}
        active={activeTab}
        onChange={setActiveTab}
      />
    </View>
  )

  return (
    <View style={styles.page}>
      <Animated.FlatList
        data={visibleGroups}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingBottom: NAV_CLEARANCE + insets.bottom,
          paddingHorizontal: 12,
          gap: 28,
        }}
        ListHeaderComponent={header}
        ListEmptyComponent={activeTab === 'Recent Activity' ? (
          <Text style={styles.emptyText}>No catches yet</Text>
        ) : null}
        ListFooterComponent={activeTab === 'Stats' ? (
          <StatsCharts groups={ownGroups} />
        ) : null}
        onEndReached={() => {
          if (activeTab === 'Recent Activity' && visibleCount < ownGroups.length) {
            setVisibleCount(c => c + PAGE_SIZE)
          }
        }}
        onEndReachedThreshold={0.4}
      />

      {/* Edit Profile */}
      <Modal
        visible={editProfileOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setEditProfileOpen(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setEditProfileOpen(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Edit Profile</Text>
            <TouchableOpacity onPress={saveProfile} disabled={saving}>
              <Text style={[styles.modalSave, saving && styles.disabledText]}>
                {saving ? 'Saving…' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.modalBody}>
            <Text style={styles.fieldLabel}>Name</Text>
            <TextInput
              style={styles.input}
              value={editName}
              onChangeText={setEditName}
              placeholder="What's your name?"
              placeholderTextColor={C.muted}
              maxLength={60}
              autoFocus
            />
            <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Bio</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              value={editBio}
              onChangeText={setEditBio}
              placeholder="Tell us about yourself"
              placeholderTextColor={C.muted}
              maxLength={200}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Edit Gear */}
      <Modal
        visible={editGearOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setEditGearOpen(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setEditGearOpen(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Edit Gear</Text>
            <TouchableOpacity onPress={saveGear} disabled={gearSaving}>
              <Text style={[styles.modalSave, gearSaving && styles.disabledText]}>
                {gearSaving ? 'Saving…' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
            <Text style={styles.fieldLabel}>Rods</Text>
            {rods.length === 0 && <Text style={styles.gearEmpty}>No rods added yet</Text>}
            {rods.map((rod, i) => (
              <View key={rod} style={styles.gearItem}>
                <Text style={styles.gearItemText} numberOfLines={1}>{rod}</Text>
                <TouchableOpacity onPress={() => setRods(prev => prev.filter((_, j) => j !== i))} hitSlop={8}>
                  <Text style={styles.gearRemove}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
            <View style={styles.gearAddRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={newRod}
                onChangeText={setNewRod}
                placeholder="Add a rod…"
                placeholderTextColor={C.muted}
                onSubmitEditing={addRod}
                returnKeyType="done"
              />
              <TouchableOpacity style={styles.addBtn} onPress={addRod}>
                <Text style={styles.addBtnText}>Add</Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.fieldLabel, { marginTop: 24 }]}>Flies</Text>
            {flies.length === 0 && <Text style={styles.gearEmpty}>No flies added yet</Text>}
            {flies.map((fly, i) => (
              <View key={fly} style={styles.gearItem}>
                <Text style={styles.gearItemText} numberOfLines={1}>{fly}</Text>
                <TouchableOpacity onPress={() => setFlies(prev => prev.filter((_, j) => j !== i))} hitSlop={8}>
                  <Text style={styles.gearRemove}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
            <View style={styles.gearAddRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={newFly}
                onChangeText={setNewFly}
                placeholder="Add a fly…"
                placeholderTextColor={C.muted}
                onSubmitEditing={addFly}
                returnKeyType="done"
              />
              <TouchableOpacity style={styles.addBtn} onPress={addFly}>
                <Text style={styles.addBtnText}>Add</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      <FollowListSheet
        visible={followListOpen}
        onClose={() => setFollowListOpen(false)}
        profileId={user?.id}
        initialTab={followListTab}
      />

      <CatchDetailSheet group={selectedGroup} onDismiss={() => setSelectedGroup(null)} />
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.surface },

  // Dither header card
  headerCard: {
    borderRadius: RADII.sheet,
    overflow: 'hidden',
    marginBottom: 18,
  },
  gearBtn: {
    position: 'absolute',
    top: 12,
    left: 12,
    zIndex: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(22,22,24,0.4)',
  },
  headerInner: {
    alignItems: 'center',
    paddingTop: 48,
    paddingBottom: 26,
    paddingHorizontal: 20,
  },
  avatar: { width: 100, height: 100, borderRadius: 50 },
  avatarFallback: {
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { fontSize: 40, fontFamily: FONTS.sansSemiBold, color: '#fff' },
  avatarOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 50,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  displayName: {
    fontFamily: FONTS.condensedSemiBold,
    fontSize: 20,
    color: '#fff',
    marginTop: 14,
    textAlign: 'center',
  },
  bio: {
    fontFamily: FONTS.sans,
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    // No fixed lineHeight: it wouldn't scale with Dynamic Type and would clip
    // wrapped text at larger accessibility text sizes.
    marginTop: 6,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 36,
    marginTop: 22,
  },
  stat: { alignItems: 'center' },
  statPressed: { opacity: 0.6 },
  statValue: {
    fontFamily: FONTS.mono,
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
  },
  statLabel: {
    fontFamily: FONTS.condensed,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
  },

  emptyText: {
    fontFamily: FONTS.sans,
    color: C.muted,
    fontSize: 15,
    textAlign: 'center',
    paddingTop: 24,
  },

  // Modal (shared by edit profile/gear)
  modalContainer: { flex: 1, backgroundColor: C.bg },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  modalCancel: { color: C.muted, fontSize: 17, fontFamily: FONTS.sans },
  modalTitle: { color: C.text, fontSize: 17, fontFamily: FONTS.sansSemiBold },
  modalSave: { color: C.accent, fontSize: 17, fontFamily: FONTS.sansSemiBold },
  disabledText: { opacity: 0.5 },
  modalBody: { padding: 16 },
  fieldLabel: {
    fontFamily: FONTS.condensedSemiBold,
    fontSize: 12, color: C.muted,
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8,
  },
  input: {
    backgroundColor: C.surface, color: C.text, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 16,
    fontFamily: FONTS.sans,
    borderWidth: 1, borderColor: C.border,
  },
  inputMultiline: { height: 100 },

  gearItem: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface,
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10,
    marginBottom: 6, borderWidth: 1, borderColor: C.border,
  },
  gearItemText: { flex: 1, color: C.text, fontSize: 16, fontFamily: FONTS.sans },
  gearRemove: { color: C.muted, fontSize: 18, paddingLeft: 8 },
  gearEmpty: { color: C.muted, fontSize: 15, marginBottom: 8, fontStyle: 'italic', fontFamily: FONTS.sans },
  gearAddRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  addBtn: { backgroundColor: C.accent, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12, justifyContent: 'center' },
  addBtnText: { color: '#fff', fontFamily: FONTS.sansSemiBold, fontSize: 16 },
})
