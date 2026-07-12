// Search — native port of the web mobile SearchPage: hero input, horizontally
// scrolling filter chips (native menus/pickers), anglers list + catches grid,
// dither idle state. Catches search goes through the search_catches RPC
// (security definer) for web-parity global visibility.
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  View, Text, TextInput, Pressable, ScrollView, StyleSheet,
  ActionSheetIOS, Modal, ActivityIndicator, useWindowDimensions,
} from 'react-native'
import Animated from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import DateTimePicker from '@react-native-community/datetimepicker'
import { router } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { supabase } from '../../lib/supabase'
import { groupPhotos } from '../../lib/groupPhotos'
import { useNavScrollHandler } from '../../lib/navScroll'
import { useAuthStore } from '../../store/useAuthStore'
import { usePhotoStore } from '../../store/usePhotoStore'
import { DitherMesh } from '../../components/DitherMesh'
import { UserRow } from '../../components/UserRow'
import { CatchCard } from '../../components/CatchCard'
import { CatchDetailSheet } from '../../components/CatchDetailSheet'
import { Search as SearchIcon } from '../../components/icons.js'
import { C, RADII, FONTS, NAV_CLEARANCE } from '../../lib/theme'

const SHOW_OPTIONS = ['All', 'Anglers', 'Catches']
const SCOPE_OPTIONS = ['Everyone', 'Just me']

function normalize(row) {
  return {
    ...row,
    catchId: row.catch_id,
    time: row.time ? new Date(row.time).getTime() : null,
  }
}

const fmtChipDate = d => d
  ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  : null

function Chip({ label, active, onPress }) {
  return (
    <Pressable
      style={[styles.chip, active && styles.chipActive]}
      onPress={() => { Haptics.selectionAsync(); onPress() }}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  )
}

function DatePickerModal({ visible, value, onChange, onClear, onClose, title }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.pickerBackdrop} onPress={onClose}>
        <Pressable style={styles.pickerCard} onPress={() => {}}>
          <Text style={styles.pickerTitle}>{title}</Text>
          <DateTimePicker
            value={value ?? new Date()}
            mode="date"
            display="inline"
            themeVariant="dark"
            accentColor={C.accent}
            onValueChange={(e, date) => { if (date) onChange(date) }}
          />
          <View style={styles.pickerActions}>
            <Pressable onPress={() => { onClear(); onClose() }} hitSlop={8}>
              <Text style={styles.pickerClear}>Clear</Text>
            </Pressable>
            <Pressable onPress={onClose} hitSlop={8}>
              <Text style={styles.pickerDone}>Done</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

export default function SearchScreen() {
  const insets = useSafeAreaInsets()
  const { width: screenW } = useWindowDimensions()
  const user = useAuthStore(s => s.user)
  const addProfiles = usePhotoStore(s => s.addProfiles)
  const profilesById = usePhotoStore(s => s.profilesById)
  const scrollHandler = useNavScrollHandler()

  const [query, setQuery] = useState('')
  const [show, setShow] = useState('All')
  const [scope, setScope] = useState('Everyone')
  const [fromDate, setFromDate] = useState(null)
  const [toDate, setToDate] = useState(null)
  const [pickerOpen, setPickerOpen] = useState(null) // 'from' | 'to' | null

  const [anglers, setAnglers] = useState([])
  const [catchGroups, setCatchGroups] = useState([])
  const [searching, setSearching] = useState(false)
  const [selectedGroup, setSelectedGroup] = useState(null)

  const q = query.trim()
  const hasFilters = !!(q || fromDate || toDate)

  useEffect(() => {
    if (!hasFilters) {
      setAnglers([])
      setCatchGroups([])
      return
    }
    let cancelled = false
    const timer = setTimeout(async () => {
      setSearching(true)
      try {
        const wantAnglers = show !== 'Catches' && q
        const wantCatches = show !== 'Anglers'

        const [anglersRes, catchesRes] = await Promise.all([
          wantAnglers
            ? supabase
                .from('profiles')
                .select('id,username,display_name,avatar_url')
                .or(`username.ilike.%${q.replace(/[,()%]/g, '')}%,display_name.ilike.%${q.replace(/[,()%]/g, '')}%`)
                .limit(20)
            : Promise.resolve({ data: [] }),
          wantCatches
            ? supabase.rpc('search_catches', {
                q: q.replace(/[,()%]/g, ''),
                only_mine: scope === 'Just me',
                from_date: fromDate ? fromDate.toISOString().slice(0, 10) : null,
                to_date: toDate ? toDate.toISOString().slice(0, 10) : null,
              })
            : Promise.resolve({ data: [] }),
        ])
        if (cancelled) return

        setAnglers(anglersRes.data ?? [])

        const rows = (catchesRes.data ?? []).map(normalize)
        const groups = groupPhotos(rows)
          .sort((a, b) => (b[0].time ?? 0) - (a[0].time ?? 0))
        setCatchGroups(groups)

        // Attribution for cards + detail sheet
        const missing = [...new Set(rows.map(r => r.user_id))].filter(id => !profilesById[id])
        if (missing.length) {
          const { data: profs } = await supabase
            .from('profiles')
            .select('id,username,display_name,avatar_url')
            .in('id', missing)
          if (!cancelled && profs) addProfiles(profs)
        }
        if (catchesRes.error) console.error('[search] catches:', catchesRes.error)
      } catch (err) {
        if (!cancelled) console.error('[search]', err)
      } finally {
        if (!cancelled) setSearching(false)
      }
    }, 300)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [q, show, scope, fromDate, toDate, hasFilters])

  const pickShow = useCallback(() => {
    ActionSheetIOS.showActionSheetWithOptions(
      { title: 'Show', options: [...SHOW_OPTIONS, 'Cancel'], cancelButtonIndex: 3 },
      i => { if (i < 3) setShow(SHOW_OPTIONS[i]) },
    )
  }, [])

  const pickScope = useCallback(() => {
    ActionSheetIOS.showActionSheetWithOptions(
      { title: 'Scope', options: [...SCOPE_OPTIONS, 'Cancel'], cancelButtonIndex: 2 },
      i => { if (i < 2) setScope(SCOPE_OPTIONS[i]) },
    )
  }, [])

  const cardWidth = (screenW - 12 * 2 - 14) / 2

  const visibleAnglers = show !== 'Catches' ? anglers : []
  const visibleCatches = show !== 'Anglers' ? catchGroups : []
  const hasResults = visibleAnglers.length > 0 || visibleCatches.length > 0

  return (
    <View style={styles.page}>
      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + 4,
          paddingBottom: NAV_CLEARANCE + insets.bottom,
          paddingHorizontal: 12,
          flexGrow: 1,
        }}
      >
        {/* Hero input */}
        <View style={styles.inputWrap}>
          <SearchIcon size={18} color={C.muted} strokeWidth={2} />
          <TextInput
            style={styles.input}
            value={query}
            onChangeText={setQuery}
            placeholder="Search anglers, species, flies, rods…"
            placeholderTextColor={C.muted}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            accessibilityLabel="Search"
          />
        </View>

        {/* Filter chips — one horizontally scrolling row */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterBar}
          contentContainerStyle={styles.filterRow}
        >
          <Chip label={`Show: ${show}`} active={show !== 'All'} onPress={pickShow} />
          {show !== 'Anglers' && (
            <Chip label={scope} active={scope !== 'Everyone'} onPress={pickScope} />
          )}
          <Chip
            label={fromDate ? `From ${fmtChipDate(fromDate)}` : 'From'}
            active={!!fromDate}
            onPress={() => setPickerOpen('from')}
          />
          <Chip
            label={toDate ? `To ${fmtChipDate(toDate)}` : 'To'}
            active={!!toDate}
            onPress={() => setPickerOpen('to')}
          />
        </ScrollView>

        {!hasFilters ? (
          // Idle state
          <View style={styles.idlePanel}>
            <DitherMesh />
            <SearchIcon color="#fff" size={40} strokeWidth={1.6} />
            <Text style={styles.idleTitle}>Search HookSpot</Text>
            <Text style={styles.idleHint}>Find anglers, species, flies, and rods</Text>
          </View>
        ) : (
          <>
            {visibleAnglers.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>Anglers</Text>
                <View style={styles.listCard}>
                  {visibleAnglers.map(a => (
                    <UserRow key={a.id} user={a} onPress={() => router.push(`/user/${a.username}`)} />
                  ))}
                </View>
              </>
            )}

            {visibleCatches.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>Catches</Text>
                <View style={styles.catchesGrid}>
                  {visibleCatches.map(group => (
                    <View key={group[0].catchId ?? `${group[0].user_id}/${group[0].filename}`} style={{ width: cardWidth }}>
                      <CatchCard
                        group={group}
                        profile={profilesById[group[0].user_id]}
                        isOwn={group[0].user_id === user?.id}
                        onPress={setSelectedGroup}
                      />
                    </View>
                  ))}
                </View>
              </>
            )}

            {searching && !hasResults && (
              <ActivityIndicator size="small" color={C.muted} style={styles.searchSpinner} />
            )}
            {!searching && !hasResults && (
              <Text style={styles.emptyText}>No results{q ? ` for “${q}”` : ''}</Text>
            )}
          </>
        )}
      </Animated.ScrollView>

      <DatePickerModal
        visible={pickerOpen === 'from'}
        title="From"
        value={fromDate}
        onChange={setFromDate}
        onClear={() => setFromDate(null)}
        onClose={() => setPickerOpen(null)}
      />
      <DatePickerModal
        visible={pickerOpen === 'to'}
        title="To"
        value={toDate}
        onChange={setToDate}
        onClear={() => setToDate(null)}
        onClose={() => setPickerOpen(null)}
      />

      <CatchDetailSheet group={selectedGroup} onDismiss={() => setSelectedGroup(null)} />
    </View>
  )
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: C.surface,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(0,0,0,0.22)',
    borderRadius: 12,
    paddingHorizontal: 14,
    marginBottom: 14,
    marginTop: 8,
    marginHorizontal: 4,
  },
  input: {
    flex: 1,
    paddingVertical: 13,
    fontSize: 16,
    color: C.text,
    fontFamily: FONTS.sans,
  },
  filterBar: {
    flexGrow: 0,
    marginHorizontal: -12,
    marginBottom: 20,
  },
  filterRow: {
    paddingHorizontal: 16,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADII.pill,
    backgroundColor: 'rgba(0,0,0,0.22)',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  chipActive: {
    borderColor: C.accent,
  },
  chipText: {
    fontFamily: FONTS.condensed,
    fontSize: 13,
    color: C.text,
  },
  chipTextActive: { color: '#fff' },

  idlePanel: {
    flex: 1,
    minHeight: 320,
    borderRadius: RADII.sheet,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginHorizontal: 4,
  },
  idleTitle: {
    fontFamily: FONTS.display,
    fontSize: 22,
    color: '#fff',
  },
  idleHint: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
  },

  sectionLabel: {
    fontFamily: FONTS.condensed,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: C.muted,
    marginBottom: 8,
    marginHorizontal: 4,
  },
  listCard: {
    backgroundColor: 'rgba(0,0,0,0.22)',
    borderRadius: 12,
    paddingVertical: 4,
    marginBottom: 22,
    marginHorizontal: 4,
  },
  catchesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    marginHorizontal: 4,
  },
  searchSpinner: { paddingTop: 40 },
  emptyText: {
    fontFamily: FONTS.sans,
    fontSize: 14,
    color: C.muted,
    textAlign: 'center',
    paddingTop: 40,
  },

  pickerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
    padding: 12,
  },
  pickerCard: {
    backgroundColor: '#1c1c1e',
    borderRadius: RADII.card,
    padding: 16,
    marginBottom: 24,
  },
  pickerTitle: {
    fontFamily: FONTS.condensed,
    fontSize: 13,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: C.muted,
    marginBottom: 4,
  },
  pickerActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
    paddingHorizontal: 4,
  },
  pickerClear: { fontFamily: FONTS.sans, fontSize: 16, color: C.muted },
  pickerDone: { fontFamily: FONTS.sansSemiBold, fontSize: 16, color: C.accent },
})
