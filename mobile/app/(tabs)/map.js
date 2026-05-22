import { useEffect, useRef, useState } from 'react'
import { StyleSheet, View, Text, Image, TouchableOpacity, ActivityIndicator } from 'react-native'
import MapboxGL from '@rnmapbox/maps'
import Constants from 'expo-constants'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/useAuthStore'

MapboxGL.setAccessToken(Constants.expoConfig.extra.mapboxToken)

const MAP_STYLE = 'mapbox://styles/derrellwilliams/cmoc96j0y000i01r90nqr62du'
const PADDING = { paddingTop: 80, paddingBottom: 120, paddingLeft: 40, paddingRight: 40 }

function storageKey(filename) {
  return filename.replace(/[^\w.\-]/g, '_').replace(/\.(heic|heif)$/i, '.jpg')
}

function photoUrl(userId, filename) {
  return supabase.storage.from('catches').getPublicUrl(`${userId}/${storageKey(filename)}`).data.publicUrl
}

function formatDate(time) {
  if (!time) return null
  return new Date(time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function MapScreen() {
  const user = useAuthStore(s => s.user)
  const cameraRef = useRef(null)
  const [catches, setCatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const fitted = useRef(false)

  useEffect(() => {
    if (!user) return
    supabase
      .from('photos')
      .select('filename, user_id, lat, lng, species, time')
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

  // Fit camera to catches once after they load
  useEffect(() => {
    if (fitted.current || catches.length === 0 || !cameraRef.current) return
    fitted.current = true
    const lngs = catches.map(c => c.lng)
    const lats = catches.map(c => c.lat)
    cameraRef.current.fitBounds(
      [Math.max(...lngs), Math.max(...lats)],
      [Math.min(...lngs), Math.min(...lats)],
      [PADDING.paddingTop, PADDING.paddingRight, PADDING.paddingBottom, PADDING.paddingLeft],
      400,
    )
  }, [catches])

  const geojson = {
    type: 'FeatureCollection',
    features: catches.map(c => ({
      type: 'Feature',
      id: `${c.user_id}/${c.filename}`,
      geometry: { type: 'Point', coordinates: [c.lng, c.lat] },
      properties: { filename: c.filename, userId: c.user_id, species: c.species, time: c.time },
    })),
  }

  return (
    <View style={styles.container}>
      <MapboxGL.MapView
        style={styles.map}
        styleURL={MAP_STYLE}
        onPress={() => setSelected(null)}
      >
        <MapboxGL.Camera
          ref={cameraRef}
          defaultSettings={{ centerCoordinate: [-111.1, 39.5], zoomLevel: 6 }}
        />

        {!loading && (
          <MapboxGL.ShapeSource
            id="catches"
            shape={geojson}
            onPress={e => {
              const p = e.features?.[0]?.properties
              if (p) setSelected(p)
            }}
          >
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

      {selected && (
        <View style={styles.card}>
          <TouchableOpacity style={styles.cardClose} onPress={() => setSelected(null)}>
            <Text style={styles.cardCloseText}>✕</Text>
          </TouchableOpacity>
          <Image
            source={{ uri: photoUrl(selected.userId, selected.filename) }}
            style={styles.cardImage}
            resizeMode="cover"
          />
          <View style={styles.cardBody}>
            {selected.species ? (
              <Text style={styles.cardSpecies}>{selected.species}</Text>
            ) : (
              <Text style={styles.cardSpeciesEmpty}>Unknown species</Text>
            )}
            {selected.time && (
              <Text style={styles.cardDate}>{formatDate(selected.time)}</Text>
            )}
          </View>
        </View>
      )}
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
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  card: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    right: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  cardClose: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardCloseText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  cardImage: { width: '100%', height: 200 },
  cardBody: { padding: 14 },
  cardSpecies: { fontSize: 17, fontWeight: '600', color: '#0c4a6e' },
  cardSpeciesEmpty: { fontSize: 17, fontWeight: '400', color: '#94a3b8', fontStyle: 'italic' },
  cardDate: { fontSize: 13, color: '#64748b', marginTop: 4 },
})
