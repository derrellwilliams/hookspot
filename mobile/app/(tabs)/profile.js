import { useState, useMemo, useCallback, useRef } from 'react'
import {
  View, Text, Image, TouchableOpacity, Modal,
  TextInput, ScrollView, StyleSheet, Alert, ActionSheetIOS,
  Platform, Dimensions, ActivityIndicator, KeyboardAvoidingView,
  useWindowDimensions,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as ImagePicker from 'expo-image-picker'
import { Settings } from 'iconoir-react-native'
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet'
import { BlurView } from 'expo-blur'
import { supabase } from '../../lib/supabase'
import { C } from '../../lib/theme'
import { photoUrl } from '../../lib/storage'
import { uploadAvatar } from '../../lib/upload'
import { MeshBackground } from '../../components/MeshBackground'
import { StatsCharts } from '../../components/StatsCharts'
import { useAuthStore } from '../../store/useAuthStore'
import { usePhotoStore } from '../../store/usePhotoStore'
import { FLOAT_INSET, TAB_BAR_TOTAL, CARD_RADIUS } from './_layout'
import { formatDateFull, cleanSpecies, getDisplayName } from '../../lib/formatters'

const PROFILE_BLOBS = [
  { x: 58, y: 33, color: '#2563eb', dx: 0.8,  dy: 0.6,  offset: 0.0 },
  { x: 27, y: 45, color: '#64748b', dx: 0.7,  dy: -0.8, offset: 1.3 },
  { x: 74, y: 66, color: '#1A1953', dx: -0.6, dy: 0.5,  offset: 2.6 },
  { x: 35, y: 67, color: '#a1a1aa', dx: 0.9,  dy: -0.7, offset: 3.9 },
  { x: 31, y: 18, color: '#2c2c2e', dx: 0.6,  dy: 0.8,  offset: 5.2 },
  { x: 15, y: 55, color: '#060a1a', dx: -0.5, dy: 0.6,  offset: 6.5 },
]

const { width: SCREEN_W } = Dimensions.get('window')
const GRID_PAD = 16
const GRID_GAP = 8
const CARD_W = Math.floor((SCREEN_W - FLOAT_INSET * 2 - GRID_PAD * 2 - GRID_GAP) / 2)

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

function SheetBackground({ style }) {
  return (
    <BlurView
      tint="systemMaterialDark"
      intensity={85}
      style={[style, styles.sheetBg]}
    />
  )
}

export default function ProfileScreen() {
  const user = useAuthStore(s => s.user)
  const setUser = useAuthStore(s => s.setUser)
  const signOut = useAuthStore(s => s.signOut)
  const profile = useAuthStore(s => s.profile)
  const setProfile = useAuthStore(s => s.setProfile)
  const groups = usePhotoStore(s => s.groups)
  const insets = useSafeAreaInsets()
  const { height: screenHeight } = useWindowDimensions()

  const sheetRef = useRef(null)
  const tabBarInset = TAB_BAR_TOTAL + 20

  const snapPoints = useMemo(
    () => [
      TAB_BAR_TOTAL + 20,
      Math.max(100, Math.round(screenHeight * 0.65) - FLOAT_INSET),
      Math.max(100, Math.round(screenHeight * 0.90) - FLOAT_INSET),
    ],
    [screenHeight],
  )

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
  const [activeTab, setActiveTab] = useState('catches')

  const ownGroups = useMemo(() =>
    groups
      .filter(g => g[0]?.user_id === user?.id)
      .sort((a, b) => (b[0].time ?? 0) - (a[0].time ?? 0)),
    [groups, user?.id]
  )

  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth()

  const statsAll = ownGroups.length
  const statsYear = useMemo(() =>
    ownGroups.filter(g => g[0].time && new Date(g[0].time).getFullYear() === currentYear).length,
    [ownGroups, currentYear]
  )
  const statsMonth = useMemo(() =>
    ownGroups.filter(g => {
      if (!g[0].time) return false
      const d = new Date(g[0].time)
      return d.getFullYear() === currentYear && d.getMonth() === currentMonth
    }).length,
    [ownGroups, currentYear, currentMonth]
  )
  const statsSpecies = useMemo(() => {
    const seen = new Set()
    ownGroups.forEach(g => g.forEach(p => { if (p.species) seen.add(p.species.toLowerCase()) }))
    return seen.size
  }, [ownGroups])

  const displayName = getDisplayName(user?.user_metadata) || 'Angler'
  const bio = user?.user_metadata?.bio ?? null

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

  const TabHeader = useCallback(() => (
    <View style={styles.sheetHeader}>
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabPill, activeTab === 'catches' && styles.tabPillActive]}
          onPress={() => setActiveTab('catches')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabPillText, activeTab === 'catches' && styles.tabPillTextActive]}>
            Catches
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabPill, activeTab === 'stats' && styles.tabPillActive]}
          onPress={() => setActiveTab('stats')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabPillText, activeTab === 'stats' && styles.tabPillTextActive]}>
            Stats
          </Text>
        </TouchableOpacity>
      </View>
      {activeTab === 'catches' && ownGroups.length > 0 && (
        <Text style={styles.sectionLabel}>Recent Catches</Text>
      )}
    </View>
  ), [activeTab, ownGroups.length])

  return (
    <View style={styles.container}>
      {/* Full-screen animated mesh background */}
      <MeshBackground blobs={PROFILE_BLOBS} bgColor={C.bg} />

      {/* Settings button */}
      <TouchableOpacity
        style={[styles.settingsBtn, { top: insets.top + 12 }]}
        onPress={openSettings}
        hitSlop={12}
      >
        <Settings width={20} height={20} color={C.text} strokeWidth={1.5} />
      </TouchableOpacity>

      {/* Avatar, name, bio, stats — visible behind the sheet */}
      <View style={[styles.profileContent, { paddingTop: insets.top + 56 }]}>
        <TouchableOpacity style={styles.avatarWrap} onPress={pickAvatar} disabled={uploading}>
          {avatarUrl
            ? <Image source={{ uri: avatarUrl }} style={styles.avatar} />
            : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarInitial}>{displayName[0].toUpperCase()}</Text>
              </View>
            )
          }
          {uploading && (
            <View style={styles.avatarOverlay}>
              <ActivityIndicator color={C.text} size="small" />
            </View>
          )}
        </TouchableOpacity>
        <Text style={styles.displayName}>{displayName}</Text>
        {bio ? <Text style={styles.bio}>{bio}</Text> : null}
        <View style={styles.statsRow}>
          <StatBox label="All" value={statsAll} />
          <View style={styles.statDivider} />
          <StatBox label="Year" value={statsYear} />
          <View style={styles.statDivider} />
          <StatBox label="Month" value={statsMonth} />
          <View style={styles.statDivider} />
          <StatBox label="Species" value={statsSpecies} />
        </View>
      </View>

      {/* Glass sheet — same structure as map tab */}
      <View
        style={[styles.sheetClip, { bottom: FLOAT_INSET }]}
        pointerEvents="box-none"
      >
        <BottomSheet
          ref={sheetRef}
          index={1}
          snapPoints={snapPoints}
          backgroundComponent={SheetBackground}
          handleIndicatorStyle={styles.sheetHandle}
          enableOverDrag={false}
        >
          <BottomSheetScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: tabBarInset }}
          >
            <TabHeader />
            {activeTab === 'catches' ? (
              ownGroups.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>No catches yet</Text>
                </View>
              ) : (
                <View style={styles.grid}>
                  {ownGroups.map(group => (
                    <CatchCard key={group[0].catchId ?? group[0].filename} group={group} />
                  ))}
                </View>
              )
            ) : (
              <View style={{ paddingHorizontal: GRID_PAD }}>
                <StatsCharts groups={ownGroups} />
              </View>
            )}
          </BottomSheetScrollView>
        </BottomSheet>
      </View>

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
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  // Settings button (top-right, over background)
  settingsBtn: { position: 'absolute', right: 16, zIndex: 10, padding: 4 },

  // Profile hero (behind the sheet)
  profileContent: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  avatarWrap: { width: 88, height: 88, borderRadius: 44, marginBottom: 14 },
  avatar: { width: 88, height: 88, borderRadius: 44 },
  avatarFallback: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center',
  },
  avatarInitial: { fontSize: 38, fontWeight: '600', color: C.text },
  avatarOverlay: {
    ...StyleSheet.absoluteFillObject, borderRadius: 44,
    backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center',
  },
  displayName: { fontSize: 24, fontWeight: '700', color: C.text, textAlign: 'center', marginBottom: 6 },
  bio: { fontSize: 15, color: C.muted, textAlign: 'center', lineHeight: 21, marginBottom: 18 },

  // Stats row
  statsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  statBox: { alignItems: 'center', paddingHorizontal: 18 },
  statValue: { fontSize: 22, fontWeight: '700', color: C.text },
  statLabel: { fontSize: 11, color: C.muted, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
  statDivider: { width: 1, height: 28, backgroundColor: C.border },

  // Sheet container (same as map)
  sheetClip: {
    position: 'absolute',
    top: 0,
    left: FLOAT_INSET,
    right: FLOAT_INSET,
    overflow: 'hidden',
    borderBottomLeftRadius: CARD_RADIUS,
    borderBottomRightRadius: CARD_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.18)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
  },
  sheetBg: {
    overflow: 'hidden',
    borderTopLeftRadius: CARD_RADIUS,
    borderTopRightRadius: CARD_RADIUS,
  },
  sheetHandle: { backgroundColor: 'rgba(255,255,255,0.2)', width: 40 },

  // Sheet header (tab switcher)
  sheetHeader: { paddingHorizontal: GRID_PAD, paddingTop: 4, paddingBottom: 4 },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: C.surface,
    borderRadius: 10,
    padding: 3,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  tabPill: { flex: 1, paddingVertical: 7, borderRadius: 8, alignItems: 'center' },
  tabPillActive: { backgroundColor: '#3a3a3c' },
  tabPillText: { fontSize: 15, fontWeight: '500', color: C.muted },
  tabPillTextActive: { color: C.text, fontWeight: '600' },
  sectionLabel: {
    fontSize: 13, fontWeight: '600', color: C.muted,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10,
  },

  // Catch grid
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: GRID_PAD, gap: GRID_GAP },
  catchCard: { width: CARD_W, borderRadius: 10, overflow: 'hidden', backgroundColor: C.surface },
  catchImg: { width: CARD_W, height: CARD_W * 0.75, backgroundColor: C.border },
  catchMeta: { padding: 8 },
  catchSpecies: { fontSize: 14, fontWeight: '600', color: C.text, marginBottom: 2 },
  catchDate: { fontSize: 12, color: C.muted },

  // Empty state
  emptyState: { alignItems: 'center', paddingTop: 32 },
  emptyText: { color: C.muted, fontSize: 16 },

  // Modal
  modalContainer: { flex: 1, backgroundColor: C.bg },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  modalCancel: { color: C.muted, fontSize: 18 },
  modalTitle: { color: C.text, fontSize: 18, fontWeight: '600' },
  modalSave: { color: C.accent, fontSize: 18, fontWeight: '600' },
  disabledText: { opacity: 0.5 },
  modalBody: { padding: 16 },
  fieldLabel: {
    fontSize: 12, fontWeight: '600', color: C.muted,
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8,
  },
  input: {
    backgroundColor: C.surface, color: C.text, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 16,
    borderWidth: 1, borderColor: C.border,
  },
  inputMultiline: { height: 100 },

  // Gear
  gearItem: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface,
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10,
    marginBottom: 6, borderWidth: 1, borderColor: C.border,
  },
  gearItemText: { flex: 1, color: C.text, fontSize: 16 },
  gearRemove: { color: C.muted, fontSize: 18, paddingLeft: 8 },
  gearEmpty: { color: C.muted, fontSize: 16, marginBottom: 8, fontStyle: 'italic' },
  gearAddRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  addBtn: { backgroundColor: C.accent, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12, justifyContent: 'center' },
  addBtnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
})
