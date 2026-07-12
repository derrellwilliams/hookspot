// Home ("Catches") — native port of the web mobile MapPage: card feed over an
// always-mounted full-bleed map, with a fixed glass list/map toggle. The feed
// layer toggles with opacity + pointerEvents (RN's `visibility`) so Mapbox
// never re-initializes.
import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { StyleSheet, View, Text, Pressable, ActivityIndicator, RefreshControl } from 'react-native'
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import MapboxGL from '@rnmapbox/maps'
import { BlurView } from 'expo-blur'
import Constants from 'expo-constants'
import * as Haptics from 'expo-haptics'
import { ListView, MapPin, Plus } from '../../components/icons.js'
import { C, GLASS, RADII, FONTS, SPRINGS, NAV_CLEARANCE } from '../../lib/theme'
import { enrichPhotos } from '../../lib/enrich'
import { useNavScrollHandler } from '../../lib/navScroll'
import { useAuthStore } from '../../store/useAuthStore'
import { usePhotoStore } from '../../store/usePhotoStore'
import { CatchCard } from '../../components/CatchCard'
import { CatchDetailSheet } from '../../components/CatchDetailSheet'

MapboxGL.setAccessToken(Constants.expoConfig.extra.mapboxToken)

const MAP_STYLE = 'mapbox://styles/derrellwilliams/cmoc96j0y000i01r90nqr62du'

const BOUNDS_PADDING_DEG = 0.008
const BOUNDS_SUBSET_FRACTION = 0.8
const TOGGLE_BTN = { width: 46, height: 30 }

function ViewToggle({ view, onChange }) {
  const activeIndex = view === 'list' ? 0 : 1
  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: withSpring(activeIndex * TOGGLE_BTN.width, SPRINGS.nav) }],
  }), [activeIndex])

  return (
    <View style={styles.toggleShadow}>
      <View style={styles.toggleClip}>
        <BlurView tint="dark" intensity={GLASS.navBlur} style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(22,22,24,0.6)' }]} />
        <View style={styles.toggleRow}>
          <Animated.View style={[styles.toggleThumb, thumbStyle]} />
          {[
            { key: 'list', Icon: ListView, label: 'List view' },
            { key: 'map', Icon: MapPin, label: 'Map view' },
          ].map(({ key, Icon, label }) => (
            <Pressable
              key={key}
              style={styles.toggleBtn}
              accessibilityRole="button"
              accessibilityLabel={label}
              onPress={() => {
                if (view === key) return
                Haptics.selectionAsync()
                onChange(key)
              }}
            >
              <Icon size={17} color={view === key ? '#fff' : 'rgba(255,255,255,0.7)'} strokeWidth={2} />
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  )
}

export default function HomeScreen() {
  const user = useAuthStore(s => s.user)
  const groups = usePhotoStore(s => s.groups)
  const photos = usePhotoStore(s => s.photos)
  const profilesById = usePhotoStore(s => s.profilesById)
  const loading = usePhotoStore(s => s.loading)
  const loadingMore = usePhotoStore(s => s.loadingMore)
  const loadPhotos = usePhotoStore(s => s.loadPhotos)
  const loadMore = usePhotoStore(s => s.loadMore)
  const setUploadOpen = usePhotoStore(s => s.setUploadOpen)
  const reset = usePhotoStore(s => s.reset)
  const insets = useSafeAreaInsets()

  const cameraRef = useRef(null)
  const fitted = useRef(false)
  const [view, setView] = useState('list')
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const scrollHandler = useNavScrollHandler()

  useEffect(() => {
    if (!user) {
      reset()
      return
    }
    fitted.current = false
    loadPhotos(user.id)
  }, [user?.id])

  // Backfill weather/place/water-body meta for own photos missing it
  useEffect(() => {
    if (loading || !user || !photos.length) return
    enrichPhotos(photos, user.id)
  }, [loading, user?.id])

  const onRefresh = useCallback(async () => {
    if (!user) return
    setRefreshing(true)
    await loadPhotos(user.id)
    setRefreshing(false)
  }, [user?.id])

  // Camera auto-fit on first load (dense-subset bounds, ignores GPS-less catches)
  useEffect(() => {
    if (fitted.current || groups.length === 0 || !cameraRef.current) return
    fitted.current = true

    const leads = groups.map(g => g[0]).filter(c => c.lat != null && c.lng != null)
    if (!leads.length) return
    const cLng = leads.reduce((s, c) => s + c.lng, 0) / leads.length
    const cLat = leads.reduce((s, c) => s + c.lat, 0) / leads.length
    const count = Math.max(1, Math.ceil(leads.length * BOUNDS_SUBSET_FRACTION))
    const subset = leads
      .map(c => ({ lng: c.lng, lat: c.lat, d: (c.lng - cLng) ** 2 + (c.lat - cLat) ** 2 }))
      .sort((a, b) => a.d - b.d)
      .slice(0, count)

    const lngs = subset.map(c => c.lng)
    const lats = subset.map(c => c.lat)
    cameraRef.current.fitBounds(
      [Math.max(...lngs) + BOUNDS_PADDING_DEG, Math.max(...lats) + BOUNDS_PADDING_DEG],
      [Math.min(...lngs) - BOUNDS_PADDING_DEG, Math.min(...lats) - BOUNDS_PADDING_DEG],
      [insets.top + 60, 40, NAV_CLEARANCE + 40, 40],
      0,
    )
  }, [groups])

  const geojson = useMemo(() => ({
    type: 'FeatureCollection',
    features: groups.filter(g => g[0].lat != null && g[0].lng != null).map(g => {
      const lead = g[0]
      return {
        type: 'Feature',
        id: lead.catchId ?? `${lead.user_id}/${lead.filename}`,
        geometry: { type: 'Point', coordinates: [lead.lng, lead.lat] },
        properties: { catchId: lead.catchId ?? null, filename: lead.filename, userId: lead.user_id },
      }
    }),
  }), [groups])

  const findGroup = useCallback((catchId, filename, userId) => (
    catchId
      ? groups.find(g => g[0].catchId === catchId)
      : groups.find(g => g[0].filename === filename && g[0].user_id === userId)
  ), [groups])

  const handleMarkerPress = useCallback((e) => {
    const props = e.features?.[0]?.properties
    if (!props) return
    const group = findGroup(props.catchId, props.filename, props.userId)
    if (group) {
      Haptics.selectionAsync()
      setSelectedGroup(group)
      if (group[0].lat != null) {
        cameraRef.current?.setCamera({
          centerCoordinate: [group[0].lng, group[0].lat],
          animationDuration: 400,
          padding: { paddingBottom: 260, paddingTop: 0, paddingLeft: 0, paddingRight: 0 },
        })
      }
    }
  }, [findGroup])

  const openFromCard = useCallback((group) => {
    setSelectedGroup(group)
  }, [])

  const keyExtractor = useCallback((group) => group[0].catchId ?? `${group[0].user_id}/${group[0].filename}`, [])

  const renderItem = useCallback(({ item: group }) => (
    <CatchCard
      group={group}
      profile={profilesById[group[0].user_id]}
      isOwn={group[0].user_id === user?.id}
      onPress={openFromCard}
    />
  ), [profilesById, user?.id, openFromCard])

  const feedVisible = view === 'list'

  return (
    <View style={styles.container}>
      {/* Map layer — always mounted */}
      <MapboxGL.MapView
        style={StyleSheet.absoluteFill}
        styleURL={MAP_STYLE}
        onPress={() => setSelectedGroup(null)}
      >
        <MapboxGL.Camera
          ref={cameraRef}
          defaultSettings={{ centerCoordinate: [-111.891, 40.760], zoomLevel: 11 }}
        />
        {!loading && (
          <MapboxGL.ShapeSource id="catches" shape={geojson} onPress={handleMarkerPress}>
            <MapboxGL.CircleLayer
              id="catch-dots"
              style={{
                circleRadius: 9,
                circleColor: '#000000',
                circleStrokeWidth: 2.5,
                circleStrokeColor: '#ffffff',
              }}
            />
          </MapboxGL.ShapeSource>
        )}
      </MapboxGL.MapView>

      {/* Feed layer — hidden (not unmounted) in map view */}
      <View
        style={[styles.feedLayer, !feedVisible && styles.feedHidden]}
        pointerEvents={feedVisible ? 'auto' : 'none'}
      >
        <Animated.FlatList
          data={groups}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.feedContent, {
            paddingTop: insets.top + 12,
            paddingBottom: NAV_CLEARANCE + insets.bottom,
          }]}
          ListHeaderComponent={<Text style={styles.wordmark}>HookSpot</Text>}
          ListEmptyComponent={loading ? null : (
            <Pressable style={styles.addCard} onPress={() => setUploadOpen(true)}>
              <Plus color={C.cardMuted} size={28} strokeWidth={1.5} />
              <Text style={styles.addCardText}>Add catches</Text>
            </Pressable>
          )}
          ListFooterComponent={
            loadingMore
              ? <ActivityIndicator size="small" color={C.muted} style={styles.footerSpinner} />
              : groups.length > 0 ? (
                <Pressable style={styles.addCard} onPress={() => setUploadOpen(true)}>
                  <Plus color={C.cardMuted} size={28} strokeWidth={1.5} />
                  <Text style={styles.addCardText}>Add catches</Text>
                </Pressable>
              ) : null
          }
          onEndReached={() => { if (user) loadMore(user.id) }}
          onEndReachedThreshold={0.3}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.muted} />
          }
        />
        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={C.accent} />
          </View>
        )}
      </View>

      {/* Wordmark overlay — fixed top-left in map view only */}
      {!feedVisible && (
        <Text style={[styles.wordmarkOverlay, { top: insets.top + 14 }]}>HookSpot</Text>
      )}

      {/* Fixed glass list/map toggle */}
      <View style={[styles.toggleWrap, { top: insets.top + 10 }]}>
        <ViewToggle view={view} onChange={setView} />
      </View>

      <CatchDetailSheet group={selectedGroup} onDismiss={() => setSelectedGroup(null)} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.surface },

  feedLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: C.surface,
  },
  feedHidden: { opacity: 0 },
  feedContent: {
    paddingHorizontal: 16,
    gap: 28,
  },
  wordmark: {
    fontFamily: FONTS.display,
    fontSize: 26,
    color: '#fff',
    marginBottom: -2, // gap covers the 26px web margin
  },
  wordmarkOverlay: {
    position: 'absolute',
    left: 16,
    zIndex: 5,
    fontFamily: FONTS.display,
    fontSize: 26,
    color: '#fff',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerSpinner: { paddingVertical: 20 },

  addCard: {
    aspectRatio: 4 / 3,
    borderRadius: RADII.card,
    borderWidth: 1.5,
    borderColor: C.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addCardText: {
    fontFamily: FONTS.condensed,
    fontSize: 13,
    color: C.cardMuted,
  },

  toggleWrap: {
    position: 'absolute',
    right: 16,
    zIndex: 5,
  },
  toggleShadow: {
    borderRadius: RADII.pill,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
  },
  toggleClip: {
    borderRadius: RADII.pill,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: GLASS.borderSoft,
  },
  toggleRow: {
    flexDirection: 'row',
    padding: 3,
  },
  toggleThumb: {
    position: 'absolute',
    top: 3,
    left: 3,
    width: TOGGLE_BTN.width,
    height: TOGGLE_BTN.height,
    borderRadius: RADII.pill,
    backgroundColor: GLASS.thumb,
  },
  toggleBtn: {
    width: TOGGLE_BTN.width,
    height: TOGGLE_BTN.height,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
