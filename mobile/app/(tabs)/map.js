import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { StyleSheet, View, Text, Image, TouchableOpacity, ActivityIndicator } from 'react-native'
import MapboxGL from '@rnmapbox/maps'
import BottomSheet, { BottomSheetScrollView, BottomSheetFlatList } from '@gorhom/bottom-sheet'
import { EditPencil, Xmark } from 'iconoir-react-native'
import Constants from 'expo-constants'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/useAuthStore'
import { formatDateFull, formatLocation, cleanSpecies, getDisplayName } from '../../lib/formatters'

MapboxGL.setAccessToken(Constants.expoConfig.extra.mapboxToken)

const MAP_STYLE = 'mapbox://styles/derrellwilliams/cmoc96j0y000i01r90nqr62du'

const C = {
  bg: '#202020',
  surface: '#2c2c2e',
  border: '#3a3a3c',
  text: '#f4f4f5',
  muted: '#8d8d8d',
}

function storageKey(filename) {
  return filename.replace(/[^\w.\-]/g, '_').replace(/\.(heic|heif)$/i, '.jpg')
}

function photoUrl(userId, filename) {
  return supabase.storage.from('catches').getPublicUrl(`${userId}/${storageKey(filename)}`).data.publicUrl
}

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
  const cameraRef = useRef(null)
  const sheetRef = useRef(null)
  const [catches, setCatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const fitted = useRef(false)

  const snapPoints = useMemo(() => ['12%', '50%', '92%'], [])

  useEffect(() => {
    if (!user) return
    supabase
      .from('photos')
      .select('filename, user_id, lat, lng, species, time, meta')
      .eq('user_id', user.id)
      .not('lat', 'is', null)
      .not('lng', 'is', null)
      .order('time', { ascending: false })
      .limit(500)
      .then(({ data }) => {
        if (data) setCatches(data)
        setLoading(false)
      })
  }, [user])

  useEffect(() => {
    if (fitted.current || catches.length === 0 || !cameraRef.current) return
    fitted.current = true
    const lngs = catches.map(c => c.lng)
    const lats = catches.map(c => c.lat)
    cameraRef.current.fitBounds(
      [Math.max(...lngs), Math.max(...lats)],
      [Math.min(...lngs), Math.min(...lats)],
      [80, 40, 160, 40],
      400,
    )
  }, [catches])

  const geojson = useMemo(() => ({
    type: 'FeatureCollection',
    features: catches.map(c => ({
      type: 'Feature',
      id: `${c.user_id}/${c.filename}`,
      geometry: { type: 'Point', coordinates: [c.lng, c.lat] },
      properties: { filename: c.filename, userId: c.user_id },
    })),
  }), [catches])

  const handleMarkerPress = useCallback((e) => {
    const props = e.features?.[0]?.properties
    if (!props) return
    const full = catches.find(c => c.filename === props.filename && c.user_id === props.userId)
    if (full) {
      setSelected(full)
      sheetRef.current?.snapToIndex(2)
    }
  }, [catches])

  const handleMapPress = useCallback(() => {
    setSelected(null)
    sheetRef.current?.snapToIndex(0)
  }, [])

  const selectFromList = useCallback((item) => {
    setSelected(item)
    cameraRef.current?.setCamera({ centerCoordinate: [item.lng, item.lat], animationDuration: 500 })
    sheetRef.current?.snapToIndex(2)
  }, [])

  const clearSelected = useCallback(() => {
    setSelected(null)
    sheetRef.current?.snapToIndex(1)
  }, [])

  const renderCatchItem = useCallback(({ item }) => {
    const species = cleanSpecies(item.species)
    const locationStr = formatLocation(item.meta?.location)
    return (
      <TouchableOpacity style={styles.item} onPress={() => selectFromList(item)} activeOpacity={0.7}>
        <Image source={{ uri: photoUrl(item.user_id, item.filename) }} style={styles.thumb} />
        <View style={styles.meta}>
          <AnglerRow user={user} profile={profile} />
          {species
            ? <Text style={styles.species} numberOfLines={1}>{species}</Text>
            : <Text style={styles.speciesEmpty} numberOfLines={1}>Unknown</Text>
          }
          {item.time && <Text style={styles.datetime}>{formatDateFull(item.time)}</Text>}
          {locationStr && <Text style={styles.location}>{locationStr}</Text>}
        </View>
      </TouchableOpacity>
    )
  }, [user, selectFromList])

  const keyExtractor = useCallback((item) => `${item.user_id}/${item.filename}`, [])

  const selectedSpecies = selected ? cleanSpecies(selected.species) : null
  const selectedLocation = selected ? formatLocation(selected.meta?.location) : null
  const selectedWeatherLocation = selected ? (() => {
    const w = selected.meta?.weather
    const loc = formatLocation(selected.meta?.location)
    const weatherStr = w?.temp != null && w?.condition ? `${w.temp}°F · ${w.condition}` : ''
    if (weatherStr && loc) return `${weatherStr} · ${loc}`
    return weatherStr || loc || null
  })() : null
  const selectedGear = selected ? [selected.meta?.rod, selected.meta?.fly].filter(Boolean).join(' · ') || null : null

  return (
    <View style={styles.container}>
      <MapboxGL.MapView
        style={styles.map}
        styleURL={MAP_STYLE}
        onPress={handleMapPress}
      >
        <MapboxGL.Camera
          ref={cameraRef}
          defaultSettings={{ centerCoordinate: [-111.1, 39.5], zoomLevel: 6 }}
        />

        {!loading && (
          <MapboxGL.ShapeSource id="catches" shape={geojson} onPress={handleMarkerPress}>
            <MapboxGL.CircleLayer
              id="catch-dots"
              style={{
                circleRadius: 9,
                circleColor: '#0891b2',
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
        index={0}
        snapPoints={snapPoints}
        backgroundStyle={styles.sheetBg}
        handleIndicatorStyle={styles.sheetHandle}
      >
        {selected ? (
          <BottomSheetScrollView contentContainerStyle={styles.detailContainer}>
            <View style={styles.detailImgWrap}>
              <Image
                source={{ uri: photoUrl(selected.user_id, selected.filename) }}
                style={styles.detailImage}
                resizeMode="cover"
              />
              <View style={styles.imgBtns}>
                {selected.user_id === user?.id && (
                  <TouchableOpacity style={styles.imgBtn} hitSlop={4}>
                    <EditPencil width={16} height={16} color="#fff" strokeWidth={2} />
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.imgBtn} onPress={clearSelected} hitSlop={4}>
                  <Xmark width={16} height={16} color="#fff" strokeWidth={2} />
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.detailBody}>
              <Text style={styles.detailTitle} numberOfLines={1}>
                {selectedSpecies || '—'}
              </Text>
              <AnglerRow user={user} profile={profile} />
              {selected.time && (
                <Text style={styles.detailMeta}>{formatDateFull(selected.time)}</Text>
              )}
              {selectedWeatherLocation && (
                <Text style={styles.detailMeta}>{selectedWeatherLocation}</Text>
              )}
              {selectedGear && (
                <Text style={styles.detailMeta}>{selectedGear}</Text>
              )}
            </View>
          </BottomSheetScrollView>
        ) : (
          <BottomSheetFlatList
            data={catches}
            keyExtractor={keyExtractor}
            renderItem={renderCatchItem}
            ListHeaderComponent={
              <View style={styles.listHeader}>
                <Text style={styles.listHeaderText}>
                  {catches.length} {catches.length === 1 ? 'catch' : 'catches'}
                </Text>
              </View>
            }
            contentContainerStyle={styles.listContent}
          />
        )}
      </BottomSheet>
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
  listHeaderText: { fontFamily: 'RobotoCondensed_500Medium', fontSize: 15, color: C.text },

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
  anglerAvatar: { width: 16, height: 16, borderRadius: 8 },
  anglerFallback: {
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: C.border,
    alignItems: 'center', justifyContent: 'center',
  },
  anglerInitial: { color: C.muted, fontSize: 8, fontWeight: '700' },
  anglerName: { fontFamily: 'RobotoCondensed_400Regular', fontSize: 13, color: C.muted },

  species: { fontFamily: 'Roboto_700Bold', fontSize: 22, color: C.text },
  speciesEmpty: { fontFamily: 'Roboto_400Regular', fontSize: 22, color: C.muted, fontStyle: 'italic' },
  datetime: { fontFamily: 'RobotoMono_400Regular', fontSize: 12, color: C.muted },
  location: { fontFamily: 'RobotoMono_400Regular', fontSize: 12, color: C.muted },

  // Detail
  detailContainer: { paddingBottom: 40 },
  detailImgWrap: { marginHorizontal: 16, borderRadius: 10, overflow: 'hidden' },
  detailImage: { height: 240 },
  imgBtns: { position: 'absolute', top: 10, right: 10, flexDirection: 'row', gap: 6 },
  imgBtn: {
    width: 44, height: 44, borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center',
  },
  detailBody: { paddingHorizontal: 20, paddingTop: 14, gap: 6 },
  detailTitle: { fontFamily: 'Roboto_700Bold', fontSize: 22, color: C.text },
  detailMeta: { fontFamily: 'RobotoMono_400Regular', fontSize: 12, color: C.muted },
})
