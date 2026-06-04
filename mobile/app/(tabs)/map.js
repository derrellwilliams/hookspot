import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { StyleSheet, View, Text, Image, TouchableOpacity, ActivityIndicator, Alert, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import MapboxGL from '@rnmapbox/maps'
import BottomSheet, { BottomSheetScrollView, BottomSheetFlatList } from '@gorhom/bottom-sheet'
import { EditPencil, Trash, ArrowLeft, Map as MapIcon, Plus } from 'iconoir-react-native'
import Constants from 'expo-constants'
import * as ImagePicker from 'expo-image-picker'
import { supabase } from '../../lib/supabase'
import { C } from '../../lib/theme'
import { storageKey, photoUrl } from '../../lib/storage'
import { addPhotosToGroup } from '../../lib/upload'
import { useAuthStore } from '../../store/useAuthStore'
import { usePhotoStore } from '../../store/usePhotoStore'
import { EditCatchModal } from '../../components/EditCatchModal'
import { TAB_BAR_HEIGHT } from './_layout'
import { formatDateFull, formatLocation, cleanSpecies, getDisplayName } from '../../lib/formatters'

MapboxGL.setAccessToken(Constants.expoConfig.extra.mapboxToken)

const MAP_STYLE = 'mapbox://styles/derrellwilliams/cmoc96j0y000i01r90nqr62du'

const BOUNDS_PADDING_DEG = 0.008
const BOUNDS_SUBSET_FRACTION = 0.8

function AnglerRow({ user, profile }) {
  const avatarUrl = profile?.avatar_url
  const displayName = getDisplayName(profile) || getDisplayName(user?.user_metadata)
  const initial = displayName ? displayName[0].toUpperCase() : '?'

  return (
    <View style={styles.angler}>
      {avatarUrl
        ? <Image source={{ uri: avatarUrl }} style={styles.anglerAvatar} />
        : <View style={styles.anglerFallback}><Text style={styles.anglerInitial}>{initial}</Text></View>
      }
      {displayName ? <Text style={styles.anglerName} numberOfLines={1}>{displayName}</Text> : null}
    </View>
  )
}

export default function MapScreen() {
  const user = useAuthStore(s => s.user)
  const profile = useAuthStore(s => s.profile)
  const groups = usePhotoStore(s => s.groups)
  const loading = usePhotoStore(s => s.loading)
  const loadingMore = usePhotoStore(s => s.loadingMore)
  const loadPhotos = usePhotoStore(s => s.loadPhotos)
  const loadMore = usePhotoStore(s => s.loadMore)
  const addPhotos = usePhotoStore(s => s.addPhotos)
  const removePhotos = usePhotoStore(s => s.removePhotos)
  const reset = usePhotoStore(s => s.reset)
  const insets = useSafeAreaInsets()
  const { height: screenHeight } = useWindowDimensions()
  const tabBarInset = insets.bottom + TAB_BAR_HEIGHT + 20
  const cameraRef = useRef(null)
  const sheetRef = useRef(null)
  const [selected, setSelected] = useState(null)
  const [sheetIndex, setSheetIndex] = useState(1)
  const [addingPhotos, setAddingPhotos] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const fitted = useRef(false)

  const snapPoints = useMemo(() => ['8%', '65%', '92%'], [])

  useEffect(() => {
    if (!user) {
      reset()
      return
    }
    fitted.current = false
    loadPhotos(user.id)
  }, [user?.id])

  useEffect(() => {
    if (fitted.current || groups.length === 0 || !cameraRef.current) return
    fitted.current = true

    const leads = groups.map(g => g[0])
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
      [60, 40, 360, 40],
      0,
    )
  }, [groups])

  const geojson = useMemo(() => ({
    type: 'FeatureCollection',
    features: groups.map(g => {
      const lead = g[0]
      return {
        type: 'Feature',
        id: lead.catchId ?? `${lead.user_id}/${lead.filename}`,
        geometry: { type: 'Point', coordinates: [lead.lng, lead.lat] },
        properties: { catchId: lead.catchId ?? null, filename: lead.filename, userId: lead.user_id },
      }
    }),
  }), [groups])

  const flyToWithSheet = useCallback((lng, lat) => {
    const sheetHeight = screenHeight * 0.50
    cameraRef.current?.setCamera({
      centerCoordinate: [lng, lat],
      animationDuration: 400,
      padding: { paddingBottom: sheetHeight, paddingTop: 0, paddingLeft: 0, paddingRight: 0 },
    })
  }, [screenHeight])

  const handleMarkerPress = useCallback((e) => {
    const props = e.features?.[0]?.properties
    if (!props) return
    const group = props.catchId
      ? groups.find(g => g[0].catchId === props.catchId)
      : groups.find(g => g[0].filename === props.filename && g[0].user_id === props.userId)
    if (group) {
      setSelected(group[0])
      flyToWithSheet(group[0].lng, group[0].lat)
      sheetRef.current?.snapToIndex(1)
    }
  }, [groups, flyToWithSheet])

  const handleMapPress = useCallback(() => {
    setSelected(null)
    sheetRef.current?.snapToIndex(1)
  }, [])

  const selectFromList = useCallback((group) => {
    const lead = group[0]
    setSelected(lead)
    flyToWithSheet(lead.lng, lead.lat)
    sheetRef.current?.snapToIndex(1)
  }, [flyToWithSheet])

  const clearSelected = useCallback(() => {
    setSelected(null)
    sheetRef.current?.snapToIndex(1)
  }, [])

  const selectedGroup = useMemo(() => {
    if (!selected) return null
    return selected.catchId
      ? groups.find(g => g[0].catchId === selected.catchId)
      : groups.find(g => g[0].filename === selected.filename && g[0].user_id === selected.user_id)
  }, [selected, groups])

  const handleDelete = useCallback((group) => {
    Alert.alert(
      'Delete catch?',
      'This will permanently remove this entry and all its photos.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const catchId = group[0].catchId
            const photoIds = group.map(p => p.id).filter(Boolean)
            try {
              if (catchId) {
                await supabase.from('photos').delete().eq('catch_id', catchId)
                await supabase.from('catches').delete().eq('id', catchId)
              } else if (photoIds.length) {
                await supabase.from('photos').delete().in('id', photoIds)
              }
              const paths = group.map(p =>
                p.storage_path ?? `${user.id}/${storageKey(p.filename)}`
              )
              await supabase.storage.from('catches').remove(paths)
              removePhotos(group)
              clearSelected()
            } catch (err) {
              console.error('[delete]', err)
              Alert.alert('Error', 'Failed to delete. Please try again.')
            }
          },
        },
      ],
    )
  }, [user, removePhotos, clearSelected])

  const handleAddPhotos = useCallback(async (groupLead) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo library access to add photos.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsMultipleSelection: true,
      quality: 0.85,
      exif: true,
    })
    if (result.canceled) return
    setAddingPhotos(true)
    try {
      const photos = await addPhotosToGroup(result.assets, groupLead, user)
      addPhotos(photos)
    } catch (err) {
      console.error('[addPhotos]', err)
      Alert.alert('Upload failed', err.message || 'Please try again.')
    } finally {
      setAddingPhotos(false)
    }
  }, [user, addPhotos])

  const renderCatchItem = useCallback(({ item: group }) => {
    const lead = group[0]
    const species = cleanSpecies(lead.species)
    const locationStr = formatLocation(lead.meta?.location)
    return (
      <TouchableOpacity style={styles.item} onPress={() => selectFromList(group)} activeOpacity={0.7}>
        <Image source={{ uri: photoUrl(lead.user_id, lead.filename, lead.storage_path) }} style={styles.thumb} />
        <View style={styles.meta}>
          <AnglerRow user={user} profile={profile} />
          {species
            ? <Text style={styles.species} numberOfLines={1}>{species}</Text>
            : <Text style={styles.speciesEmpty} numberOfLines={1}>Unknown</Text>
          }
          {lead.time && <Text style={styles.datetime}>{formatDateFull(lead.time)}</Text>}
          {locationStr && <Text style={styles.location}>{locationStr}</Text>}
        </View>
      </TouchableOpacity>
    )
  }, [user, selectFromList])

  const keyExtractor = useCallback((group) => group[0].catchId ?? `${group[0].user_id}/${group[0].filename}`, [])

  // Derive display values from selectedGroup[0] so they update after edits via the store
  const selectedLead = selectedGroup?.[0] ?? selected
  const selectedSpecies = selectedLead ? cleanSpecies(selectedLead.species) : null
  const selectedWeatherLocation = selectedLead ? (() => {
    const w = selectedLead.meta?.weather
    const loc = formatLocation(selectedLead.meta?.location)
    const weatherStr = w?.temp != null && w?.condition ? `${w.temp}°F · ${w.condition}` : ''
    if (weatherStr && loc) return `${weatherStr} · ${loc}`
    return weatherStr || loc || null
  })() : null
  const selectedRod = selectedLead?.meta?.rod || null
  const selectedFly = selectedLead?.meta?.fly || null

  return (
    <View style={styles.container}>
      <MapboxGL.MapView
        style={styles.map}
        styleURL={MAP_STYLE}
        onPress={handleMapPress}
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

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#0891b2" />
        </View>
      )}

      <BottomSheet
        ref={sheetRef}
        index={1}
        snapPoints={snapPoints}
        backgroundStyle={styles.sheetBg}
        handleIndicatorStyle={styles.sheetHandle}
        onChange={(i) => { if (i >= 0) setSheetIndex(i) }}
        enableOverDrag={false}
      >
        {selected ? (
          <BottomSheetScrollView contentContainerStyle={[styles.detailContainer, { paddingBottom: tabBarInset }]}>
            <View style={styles.detailImgWrap}>
              <Image
                source={{ uri: photoUrl(selected.user_id, selected.filename, selected.storage_path) }}
                style={styles.detailImage}
                resizeMode="cover"
              />
              <TouchableOpacity style={styles.imgBtnBack} onPress={clearSelected} hitSlop={4}>
                <ArrowLeft width={16} height={16} color="#fff" strokeWidth={2} />
              </TouchableOpacity>
              {selected.user_id === user?.id && (
                <TouchableOpacity style={styles.imgBtnEdit} onPress={() => setEditOpen(true)} hitSlop={4}>
                  <EditPencil width={16} height={16} color="#fff" strokeWidth={2} />
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.detailBody}>
              {selected.user_id !== user?.id ? (
                <TouchableOpacity activeOpacity={0.7} onPress={async () => {
                  const { data } = await supabase.from('profiles').select('username').eq('id', selected.user_id).single()
                  if (data?.username) router.push(`/user/${data.username}`)
                }}>
                  <AnglerRow user={user} profile={profile} />
                </TouchableOpacity>
              ) : (
                <AnglerRow user={user} profile={profile} />
              )}
              <Text style={styles.detailTitle} numberOfLines={1}>
                {selectedSpecies || '—'}
              </Text>
              {selected.time && (
                <Text style={styles.detailMeta}>{formatDateFull(selected.time)}</Text>
              )}
              {selectedWeatherLocation && (
                <Text style={styles.detailMeta}>{selectedWeatherLocation}</Text>
              )}
              {selectedRod && (
                <Text style={styles.detailMeta}>{selectedRod}</Text>
              )}
              {selectedFly && (
                <Text style={styles.detailMeta}>{selectedFly}</Text>
              )}
            </View>
          </BottomSheetScrollView>
        ) : (
          <BottomSheetFlatList
            data={groups}
            keyExtractor={keyExtractor}
            renderItem={renderCatchItem}
            onEndReached={() => { if (user) loadMore(user.id) }}
            onEndReachedThreshold={0.3}
            ListHeaderComponent={
              <View style={styles.listHeader}>
                <Text style={styles.listHeaderText}>
                  {groups.length} {groups.length === 1 ? 'catch' : 'catches'}
                </Text>
              </View>
            }
            ListFooterComponent={loadingMore
              ? <ActivityIndicator size="small" color={C.muted} style={styles.loadMoreSpinner} />
              : null
            }
            contentContainerStyle={[styles.listContent, {
              paddingBottom: sheetIndex > 1 ? tabBarInset + 72 : tabBarInset,
            }]}
          />
        )}

        {sheetIndex > 1 && !selected && (
          <View
            pointerEvents="box-none"
            style={[styles.mapFloatWrap, { bottom: insets.bottom + TAB_BAR_HEIGHT + 24 }]}
          >
            <TouchableOpacity
              style={styles.mapFloatBtn}
              onPress={() => sheetRef.current?.snapToIndex(0)}
              activeOpacity={0.85}
            >
              <MapIcon width={14} height={14} color="#fff" strokeWidth={2} />
              <Text style={styles.mapFloatBtnText}>Map</Text>
            </TouchableOpacity>
          </View>
        )}
      </BottomSheet>

      <EditCatchModal
        visible={editOpen}
        group={selectedGroup}
        onClose={() => setEditOpen(false)}
        onSaved={() => {}}
        onAddPhotos={() => handleAddPhotos(selected)}
        addingPhotos={addingPhotos}
        onDelete={() => {
          setEditOpen(false)
          selectedGroup && handleDelete(selectedGroup)
        }}
      />

    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },

  sheetBg: { backgroundColor: C.bg, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  sheetHandle: { backgroundColor: 'rgba(255,255,255,0.2)', width: 40 },

  // List
  listContent: { paddingBottom: 32, paddingHorizontal: 20 },
  listHeader: { paddingVertical: 14 },
  listHeaderText: { fontFamily: 'RobotoCondensed_500Medium', fontSize: 16, color: C.text },
  loadMoreSpinner: { paddingVertical: 20 },

  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    paddingVertical: 8,
    paddingRight: 8,
    borderRadius: 8,
    marginBottom: 4,
  },
  thumb: { width: 90, height: 90, borderRadius: 6, backgroundColor: C.border, flexShrink: 0 },
  meta: { flex: 1, gap: 3, paddingTop: 2 },

  // Angler row
  angler: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  anglerAvatar: { width: 18, height: 18, borderRadius: 9 },
  anglerFallback: {
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: C.border,
    alignItems: 'center', justifyContent: 'center',
  },
  anglerInitial: { color: C.muted, fontSize: 10, fontWeight: '700' },
  anglerName: { fontFamily: 'RobotoCondensed_400Regular', fontSize: 16, color: C.muted },

  species: { fontFamily: 'Roboto_700Bold', fontSize: 22, color: C.text },
  speciesEmpty: { fontFamily: 'Roboto_400Regular', fontSize: 22, color: C.muted, fontStyle: 'italic' },
  datetime: { fontFamily: 'RobotoMono_400Regular', fontSize: 14, color: C.muted },
  location: { fontFamily: 'RobotoMono_400Regular', fontSize: 14, color: C.muted },

  // Detail
  detailContainer: { paddingBottom: 40 },
  detailImgWrap: { marginHorizontal: 16, borderRadius: 10, overflow: 'hidden' },
  detailImage: { aspectRatio: 4 / 3, width: '100%' },
  imgBtnBack: {
    position: 'absolute', top: 10, left: 10,
    width: 44, height: 44, borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center',
  },
  imgBtnEdit: {
    position: 'absolute', top: 10, right: 10,
    width: 44, height: 44, borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center',
  },
  detailBody: { paddingHorizontal: 20, paddingTop: 14, gap: 4 },
  detailTitle: { fontFamily: 'Roboto_700Bold', fontSize: 28, color: C.text },
  detailMeta: { fontFamily: 'RobotoMono_400Regular', fontSize: 16, color: C.muted },
  addPhotosBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    alignSelf: 'flex-start',
  },
  addPhotosBtnDisabled: { opacity: 0.4 },
  addPhotosBtnText: { fontFamily: 'Roboto_400Regular', fontSize: 16, color: C.muted },

  // Floating map button
  mapFloatWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 2,
  },
  mapFloatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#2563eb',
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
  },
  mapFloatBtnText: { fontFamily: 'Roboto_700Bold', fontSize: 16, color: '#fff' },
})
