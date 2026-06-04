import { useState, useEffect, useRef, useCallback } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, Modal, ScrollView,
  Image, FlatList, StyleSheet, Alert, ActivityIndicator,
  Platform, ActionSheetIOS, KeyboardAvoidingView, Dimensions,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as ImagePicker from 'expo-image-picker'
import * as Location from 'expo-location'
import MapboxGL from '@rnmapbox/maps'
import Constants from 'expo-constants'
import { useAuthStore } from '../store/useAuthStore'
import { usePhotoStore } from '../store/usePhotoStore'
import { uploadCatch, parseGpsFromAsset } from '../lib/upload'
import { supabase } from '../lib/supabase'

MapboxGL.setAccessToken(Constants.expoConfig.extra.mapboxToken)

const C = {
  bg: '#202020',
  surface: '#2c2c2e',
  border: '#3a3a3c',
  text: '#f4f4f5',
  muted: '#8d8d8d',
  accent: '#2563eb',
  danger: '#ef4444',
}

const { width: SCREEN_W } = Dimensions.get('window')
const THUMB_SIZE = 72

function selectFromActionSheet(title, options, onSelect) {
  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions(
      { options: ['Cancel', ...options], cancelButtonIndex: 0 },
      idx => { if (idx > 0) onSelect(options[idx - 1]) }
    )
  } else {
    Alert.alert(title, undefined, [
      ...options.map(o => ({ text: o, onPress: () => onSelect(o) })),
      { text: 'Cancel', style: 'cancel' },
    ])
  }
}

function ThumbRow({ assets, onRemove }) {
  if (!assets.length) return null
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbRow} contentContainerStyle={styles.thumbRowContent}>
      {assets.map((asset, i) => (
        <View key={i} style={styles.thumb}>
          <Image source={{ uri: asset.uri }} style={styles.thumbImg} />
          <TouchableOpacity style={styles.thumbRemove} onPress={() => onRemove(i)} hitSlop={4}>
            <Text style={styles.thumbRemoveText}>✕</Text>
          </TouchableOpacity>
        </View>
      ))}
    </ScrollView>
  )
}

export function UploadSheet() {
  const uploadOpen = usePhotoStore(s => s.uploadOpen)
  const setUploadOpen = usePhotoStore(s => s.setUploadOpen)
  const addPhoto = usePhotoStore(s => s.addPhoto)
  const user = useAuthStore(s => s.user)
  const insets = useSafeAreaInsets()

  // step: 'idle' | 'location' | 'details'
  const [step, setStep] = useState('idle')
  const [assets, setAssets] = useState([])
  const [manualPin, setManualPin] = useState(null)
  const [locating, setLocating] = useState(false)
  const [species, setSpecies] = useState('')
  const [rod, setRod] = useState('')
  const [fly, setFly] = useState('')
  const [uploading, setUploading] = useState(false)
  const [identifying, setIdentifying] = useState(false)

  const identifyUrl = Constants.expoConfig?.extra?.identifyUrl

  const gearRods = user?.user_metadata?.gear_rods ?? []
  const gearFlies = user?.user_metadata?.gear_flies ?? []

  // When the sheet opens, immediately launch the image picker
  useEffect(() => {
    if (uploadOpen) {
      if (step !== 'idle') return
      pickPhotos()
    } else {
      setStep('idle')
      setAssets([])
      setManualPin(null)
      setSpecies('')
      setRod('')
      setFly('')
      setIdentifying(false)
    }
  }, [uploadOpen])

  async function pickPhotos() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      setUploadOpen(false)
      Alert.alert('Permission needed', 'Allow photo library access to log a catch.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsMultipleSelection: true,
      quality: 0.85,
      exif: true,
    })
    if (result.canceled) {
      setUploadOpen(false)
      return
    }
    const picked = result.assets
    setAssets(picked)

    const hasGps = parseGpsFromAsset(picked[0]) != null
    if (hasGps) {
      setStep('details')
    } else {
      setStep('location')
      tryDeviceLocation()
    }
  }

  async function tryDeviceLocation() {
    setLocating(true)
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') return
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      setManualPin({ lat: pos.coords.latitude, lng: pos.coords.longitude })
    } catch {
      // fall through to map
    } finally {
      setLocating(false)
    }
  }

  function removeAsset(index) {
    const next = assets.filter((_, i) => i !== index)
    if (!next.length) {
      close()
    } else {
      setAssets(next)
    }
  }

  function close() {
    setUploadOpen(false)
  }

  async function onIdentify() {
    if (!assets.length || !identifyUrl) return
    setIdentifying(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const blob = await fetch(assets[0].uri).then(r => r.blob())
      const res = await fetch(identifyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'image/jpeg',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: blob,
      })
      const { species: identified } = await res.json()
      if (identified && identified !== 'none') setSpecies(identified)
    } catch (e) {
      console.error('[identify]', e)
    } finally {
      setIdentifying(false)
    }
  }

  async function submit() {
    if (!user || !assets.length) return
    setUploading(true)
    try {
      const photos = await uploadCatch(
        assets,
        { species: species.trim(), rod: rod.trim(), fly: fly.trim(), manualLat: manualPin?.lat, manualLng: manualPin?.lng },
        user
      )
      photos.forEach(p => addPhoto(p))
      close()
    } catch (e) {
      console.error('[UploadSheet] upload failed', e)
      Alert.alert('Upload failed', e.message || 'Please try again.')
    } finally {
      setUploading(false)
    }
  }

  const visible = uploadOpen && step !== 'idle'

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={close}
    >
      <KeyboardAvoidingView
        style={[styles.container, { paddingTop: insets.top }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={close} hitSlop={8} disabled={uploading}>
            <Text style={[styles.headerCancel, uploading && styles.dimmed]}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Add a Catch</Text>
          <View style={{ width: 56 }} />
        </View>

        {step === 'location' && (
          <LocationStep
            locating={locating}
            pin={manualPin}
            onPin={setManualPin}
            onNext={() => setStep('details')}
            onSkip={() => { setManualPin(null); setStep('details') }}
          />
        )}

        {step === 'details' && (
          <DetailsStep
            assets={assets}
            onRemoveAsset={removeAsset}
            species={species}
            onSpeciesChange={setSpecies}
            rod={rod}
            onRodChange={setRod}
            fly={fly}
            onFlyChange={setFly}
            gearRods={gearRods}
            gearFlies={gearFlies}
            uploading={uploading}
            onSubmit={submit}
            canIdentify={!!identifyUrl}
            identifying={identifying}
            onIdentify={onIdentify}
          />
        )}
      </KeyboardAvoidingView>
    </Modal>
  )
}

function LocationStep({ locating, pin, onPin, onNext, onSkip }) {
  const insets = useSafeAreaInsets()
  const cameraRef = useRef(null)

  const handleMapPress = useCallback((e) => {
    const [lng, lat] = e.geometry.coordinates
    onPin({ lat, lng })
  }, [onPin])

  return (
    <View style={styles.flex}>
      <View style={styles.locationBanner}>
        {locating ? (
          <View style={styles.locatingRow}>
            <ActivityIndicator color={C.accent} size="small" style={{ marginRight: 8 }} />
            <Text style={styles.locationBannerText}>Finding your location…</Text>
          </View>
        ) : pin ? (
          <Text style={styles.locationBannerText}>
            {pin.lat.toFixed(4)}, {pin.lng.toFixed(4)} — tap to move pin
          </Text>
        ) : (
          <Text style={styles.locationBannerText}>No GPS in photo — tap the map to pin your catch</Text>
        )}
      </View>

      <MapboxGL.MapView
        style={styles.flex}
        styleURL="mapbox://styles/derrellwilliams/cmoc96j0y000i01r90nqr62du"
        onPress={handleMapPress}
        compassEnabled={false}
        logoEnabled={false}
        attributionEnabled={false}
      >
        <MapboxGL.Camera
          ref={cameraRef}
          zoomLevel={pin ? 9 : 3}
          centerCoordinate={pin ? [pin.lng, pin.lat] : [-98, 39]}
          animationDuration={pin ? 400 : 0}
        />
        {pin && (
          <MapboxGL.PointAnnotation
            id="upload-pin"
            coordinate={[pin.lng, pin.lat]}
          >
            <View style={styles.pin} />
          </MapboxGL.PointAnnotation>
        )}
      </MapboxGL.MapView>

      <View style={[styles.locationFooter, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity style={styles.skipBtn} onPress={onSkip}>
          <Text style={styles.skipBtnText}>Skip</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.nextBtn, !pin && styles.nextBtnDisabled]}
          onPress={onNext}
          disabled={!pin}
        >
          <Text style={styles.nextBtnText}>Next</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

function DetailsStep({ assets, onRemoveAsset, species, onSpeciesChange, rod, onRodChange, fly, onFlyChange, gearRods, gearFlies, uploading, onSubmit, canIdentify, identifying, onIdentify }) {
  const insets = useSafeAreaInsets()

  function pickRod() {
    if (!gearRods.length) return
    selectFromActionSheet('Select Rod', gearRods, onRodChange)
  }

  function pickFly() {
    if (!gearFlies.length) return
    selectFromActionSheet('Select Fly', gearFlies, onFlyChange)
  }

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.detailsContent, { paddingBottom: insets.bottom + 24 }]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* Preview strip */}
      {assets.length > 0 && (
        <>
          <Image source={{ uri: assets[0].uri }} style={styles.heroImg} resizeMode="cover" />
          {assets.length > 1 && <ThumbRow assets={assets} onRemove={onRemoveAsset} />}
        </>
      )}

      {/* Form */}
      <View style={styles.form}>
        <Text style={styles.fieldLabel}>Species</Text>
        <TextInput
          style={styles.input}
          value={species}
          onChangeText={onSpeciesChange}
          placeholder="e.g. Brown Trout"
          placeholderTextColor={C.muted}
          autoCapitalize="words"
          returnKeyType="next"
        />
        {canIdentify && (
          <TouchableOpacity
            style={[styles.identifyBtn, identifying && styles.identifyBtnDisabled]}
            onPress={onIdentify}
            disabled={identifying || !assets.length}
            activeOpacity={0.7}
          >
            {identifying
              ? <ActivityIndicator size="small" color={C.muted} />
              : <Text style={styles.identifyBtnText}>Identify species</Text>
            }
          </TouchableOpacity>
        )}

        <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Rod</Text>
        {gearRods.length > 0 ? (
          <TouchableOpacity style={styles.picker} onPress={pickRod}>
            <Text style={[styles.pickerText, !rod && styles.pickerPlaceholder]}>
              {rod || 'Select your rod'}
            </Text>
            <Text style={styles.pickerChevron}>›</Text>
          </TouchableOpacity>
        ) : (
          <TextInput
            style={styles.input}
            value={rod}
            onChangeText={onRodChange}
            placeholder="e.g. 9ft 5wt"
            placeholderTextColor={C.muted}
            returnKeyType="next"
          />
        )}

        <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Fly</Text>
        {gearFlies.length > 0 ? (
          <TouchableOpacity style={styles.picker} onPress={pickFly}>
            <Text style={[styles.pickerText, !fly && styles.pickerPlaceholder]}>
              {fly || 'Select your fly'}
            </Text>
            <Text style={styles.pickerChevron}>›</Text>
          </TouchableOpacity>
        ) : (
          <TextInput
            style={styles.input}
            value={fly}
            onChangeText={onFlyChange}
            placeholder="e.g. Elk Hair Caddis"
            placeholderTextColor={C.muted}
            returnKeyType="done"
          />
        )}

        <TouchableOpacity
          style={[styles.submitBtn, uploading && styles.submitBtnDisabled]}
          onPress={onSubmit}
          disabled={uploading}
          activeOpacity={0.8}
        >
          {uploading
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={styles.submitBtnText}>Add Catch</Text>
          }
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: C.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
  },
  headerCancel: { color: C.muted, fontSize: 16, width: 56 },
  headerTitle: { color: C.text, fontSize: 17, fontWeight: '600' },
  dimmed: { opacity: 0.4 },

  // Location step
  locationBanner: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: C.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
  },
  locatingRow: { flexDirection: 'row', alignItems: 'center' },
  locationBannerText: { color: C.muted, fontSize: 13 },
  pin: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: C.accent,
    borderWidth: 2,
    borderColor: '#fff',
  },
  locationFooter: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 10,
    backgroundColor: C.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.border,
  },
  skipBtn: {
    flex: 1,
    backgroundColor: C.surface,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  skipBtnText: { color: C.muted, fontSize: 15, fontWeight: '600' },
  nextBtn: {
    flex: 2,
    backgroundColor: C.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  nextBtnDisabled: { opacity: 0.4 },
  nextBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },

  // Details step
  detailsContent: { paddingBottom: 32 },
  heroImg: {
    width: SCREEN_W,
    height: SCREEN_W * 0.65,
    backgroundColor: C.surface,
  },
  thumbRow: { backgroundColor: C.surface },
  thumbRowContent: { paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  thumb: { width: THUMB_SIZE, height: THUMB_SIZE },
  thumbImg: { width: THUMB_SIZE, height: THUMB_SIZE, borderRadius: 6 },
  thumbRemove: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 8,
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbRemoveText: { color: '#fff', fontSize: 9, lineHeight: 14 },

  form: { padding: 16 },
  identifyBtn: {
    marginTop: 8,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    alignSelf: 'flex-start',
    alignItems: 'center',
    minWidth: 120,
  },
  identifyBtnDisabled: { opacity: 0.5 },
  identifyBtnText: { color: C.muted, fontSize: 13 },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: C.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  input: {
    backgroundColor: C.surface,
    color: C.text,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: C.border,
  },
  picker: {
    backgroundColor: C.surface,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: C.border,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pickerText: { flex: 1, fontSize: 15, color: C.text },
  pickerPlaceholder: { color: C.muted },
  pickerChevron: { color: C.muted, fontSize: 20, lineHeight: 24 },

  submitBtn: {
    marginTop: 24,
    backgroundColor: C.accent,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
})
