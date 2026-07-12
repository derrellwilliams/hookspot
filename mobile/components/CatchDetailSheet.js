// Glass bottom-sheet catch detail — native port of the web CatchDialog +
// PopupCarousel (sheet mode). Shared by home, search, and profile. Owns the
// full action set (share via native sheet, edit via EditCatchModal, delete,
// add photos) so screens only pass a group.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  View, Text, Image, Pressable, StyleSheet, Alert, Share,
  ActivityIndicator, ScrollView, useWindowDimensions,
} from 'react-native'
import { BottomSheetModal, BottomSheetView, BottomSheetBackdrop } from '@gorhom/bottom-sheet'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { BlurView } from 'expo-blur'
import { router } from 'expo-router'
import * as Haptics from 'expo-haptics'
import * as ImagePicker from 'expo-image-picker'
import { supabase } from '../lib/supabase'
import { storageKey, photoUrl } from '../lib/storage'
import { addPhotosToGroup } from '../lib/upload'
import { enrichPhotos } from '../lib/enrich'
import { useAuthStore } from '../store/useAuthStore'
import { usePhotoStore } from '../store/usePhotoStore'
import { EditCatchModal } from './EditCatchModal'
import { EditPencil, ShareIos, Xmark } from './icons.js'
import { formatDateFull, formatCatchLocation, cleanSpecies, getDisplayName } from '../lib/formatters'
import { C, GLASS, RADII, FONTS } from '../lib/theme'

function GlassBackground({ style }) {
  return (
    <View style={[style, styles.glassWrap]}>
      <BlurView tint="dark" intensity={GLASS.sheetBlur} style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: GLASS.sheetBg }]} />
      <View style={styles.glassHairline} />
    </View>
  )
}

function IconButton({ Icon, label, onPress }) {
  return (
    <Pressable
      style={styles.iconBtn}
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Icon color="#fff" size={16} strokeWidth={2} />
    </Pressable>
  )
}

export function CatchDetailSheet({ group, onDismiss }) {
  const sheetRef = useRef(null)
  const user = useAuthStore(s => s.user)
  const profilesById = usePhotoStore(s => s.profilesById)
  const groups = usePhotoStore(s => s.groups)
  const removePhotos = usePhotoStore(s => s.removePhotos)
  const addPhotos = usePhotoStore(s => s.addPhotos)
  const insets = useSafeAreaInsets()
  const { width: screenW, height: screenH } = useWindowDimensions()

  const [current, setCurrent] = useState(0)
  const [editOpen, setEditOpen] = useState(false)
  const [addingPhotos, setAddingPhotos] = useState(false)

  // Track the live group from the store so edits/additions reflect immediately;
  // fall back to the prop for groups not in the store (e.g. search results).
  const liveGroup = useMemo(() => {
    if (!group?.length) return null
    const lead = group[0]
    return groups.find(g =>
      lead.catchId
        ? g[0].catchId === lead.catchId
        : g[0].filename === lead.filename && g[0].user_id === lead.user_id
    ) ?? group
  }, [group, groups])

  useEffect(() => {
    if (group?.length) {
      setCurrent(0)
      sheetRef.current?.present()
    } else {
      sheetRef.current?.dismiss()
    }
  }, [group])

  const lead = liveGroup?.[0]
  const photo = liveGroup?.[Math.min(current, (liveGroup?.length ?? 1) - 1)] ?? lead
  const isOwn = lead?.user_id === user?.id
  const ownerProfile = lead ? profilesById[lead.user_id] : null

  const species = lead ? cleanSpecies(lead.species) : null
  const weatherLocation = lead ? (() => {
    const w = lead.meta?.weather
    const loc = formatCatchLocation(lead.meta)
    const weatherStr = w?.temp != null && w?.condition ? `${w.temp}°F · ${w.condition}` : ''
    if (weatherStr && loc) return `${weatherStr} · ${loc}`
    return weatherStr || loc || null
  })() : null
  const rod = lead?.meta?.rod || null
  const fly = lead?.meta?.fly || null
  const gearLine = rod && fly ? `${rod} · ${fly}` : rod || fly

  const handleShare = useCallback(() => {
    if (!photo) return
    Haptics.selectionAsync()
    Share.share({ url: photoUrl(photo.user_id, photo.filename, photo.storage_path) })
  }, [photo])

  const handleDelete = useCallback(() => {
    if (!liveGroup) return
    Alert.alert(
      'Delete catch?',
      'This will permanently remove this entry and all its photos.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const catchId = liveGroup[0].catchId
            const photoIds = liveGroup.map(p => p.id).filter(Boolean)
            try {
              if (catchId) {
                await supabase.from('photos').delete().eq('catch_id', catchId)
                await supabase.from('catches').delete().eq('id', catchId)
              } else if (photoIds.length) {
                await supabase.from('photos').delete().in('id', photoIds)
              }
              const paths = liveGroup.map(p =>
                p.storage_path ?? `${user.id}/${storageKey(p.filename)}`
              )
              await supabase.storage.from('catches').remove(paths)
              removePhotos(liveGroup)
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
              sheetRef.current?.dismiss()
            } catch (err) {
              console.error('[delete]', err)
              Alert.alert('Error', 'Failed to delete. Please try again.')
            }
          },
        },
      ],
    )
  }, [liveGroup, user, removePhotos])

  const handleAddPhotos = useCallback(async () => {
    if (!lead) return
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo library access to add photos.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.85,
      exif: true,
    })
    if (result.canceled) return
    setAddingPhotos(true)
    try {
      const photos = await addPhotosToGroup(result.assets, lead, user)
      addPhotos(photos)
      enrichPhotos(photos, user.id)
    } catch (err) {
      console.error('[addPhotos]', err)
      Alert.alert('Upload failed', err.message || 'Please try again.')
    } finally {
      setAddingPhotos(false)
    }
  }, [lead, user, addPhotos])

  const openOwnerProfile = useCallback(async () => {
    if (!lead || isOwn) return
    let username = ownerProfile?.username
    if (!username) {
      const { data } = await supabase.from('profiles').select('username').eq('id', lead.user_id).single()
      username = data?.username
    }
    if (username) {
      sheetRef.current?.dismiss()
      router.push(`/user/${username}`)
    }
  }, [lead, isOwn, ownerProfile])

  const renderBackdrop = useCallback(props => (
    <BottomSheetBackdrop
      {...props}
      appearsOnIndex={0}
      disappearsOnIndex={-1}
      opacity={0.6}
      pressBehavior="close"
    />
  ), [])

  const imageHeight = Math.min(screenW, screenH * 0.48)

  return (
    <>
      <BottomSheetModal
        ref={sheetRef}
        enableDynamicSizing
        maxDynamicContentSize={screenH - 24 - insets.top}
        backgroundComponent={GlassBackground}
        backdropComponent={renderBackdrop}
        handleIndicatorStyle={styles.handle}
        onDismiss={onDismiss}
      >
        <BottomSheetView style={{ paddingBottom: insets.bottom }}>
          {lead && (
            <>
              <View style={[styles.imageWrap, { height: imageHeight }]}>
                <Image
                  source={{ uri: photoUrl(photo.user_id, photo.filename, photo.storage_path) }}
                  style={styles.image}
                  resizeMode="cover"
                />
                <View style={styles.topBtns}>
                  {isOwn && <IconButton Icon={EditPencil} label="Edit catch" onPress={() => setEditOpen(true)} />}
                  <IconButton Icon={ShareIos} label="Share" onPress={handleShare} />
                  <IconButton Icon={Xmark} label="Close" onPress={() => sheetRef.current?.dismiss()} />
                </View>
                {liveGroup.length > 1 && (
                  <View style={styles.stripScrim}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stripRow}>
                      {liveGroup.map((p, i) => (
                        <Pressable key={p.id ?? p.filename} onPress={() => setCurrent(i)}>
                          <Image
                            source={{ uri: photoUrl(p.user_id, p.filename, p.storage_path) }}
                            style={[styles.stripThumb, i === current && styles.stripThumbActive]}
                          />
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>

              <View style={styles.body}>
                {!isOwn && ownerProfile && (
                  <Pressable style={styles.attribution} onPress={openOwnerProfile}>
                    {ownerProfile.avatar_url
                      ? <Image source={{ uri: ownerProfile.avatar_url }} style={styles.attrAvatar} />
                      : (
                        <View style={[styles.attrAvatar, styles.attrFallback]}>
                          <Text style={styles.attrInitial}>
                            {(getDisplayName(ownerProfile) || '?')[0].toUpperCase()}
                          </Text>
                        </View>
                      )
                    }
                    <Text style={styles.attrName}>@{ownerProfile.username}</Text>
                  </Pressable>
                )}
                <Text style={styles.species} numberOfLines={1}>{species || '—'}</Text>
                {lead.time ? <Text style={styles.metaLine}>{formatDateFull(lead.time)}</Text> : null}
                {weatherLocation ? <Text style={styles.metaLine}>{weatherLocation}</Text> : null}
                {gearLine ? <Text style={styles.metaLine}>{gearLine}</Text> : null}
                {addingPhotos && (
                  <View style={styles.addingRow}>
                    <ActivityIndicator size="small" color={C.muted} />
                    <Text style={styles.addingText}>Adding photos…</Text>
                  </View>
                )}
              </View>
            </>
          )}
        </BottomSheetView>
      </BottomSheetModal>

      <EditCatchModal
        visible={editOpen}
        group={liveGroup}
        onClose={() => setEditOpen(false)}
        onSaved={() => {}}
        onAddPhotos={handleAddPhotos}
        addingPhotos={addingPhotos}
        onDelete={() => {
          setEditOpen(false)
          handleDelete()
        }}
      />
    </>
  )
}

const styles = StyleSheet.create({
  glassWrap: {
    borderTopLeftRadius: RADII.sheet,
    borderTopRightRadius: RADII.sheet,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: GLASS.borderSoft,
  },
  glassHairline: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: GLASS.hairline,
  },
  handle: { backgroundColor: 'rgba(255,255,255,0.2)', width: 40 },
  imageWrap: {
    width: '100%',
    backgroundColor: C.border,
  },
  image: { width: '100%', height: '100%' },
  topBtns: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    gap: 8,
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stripScrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingVertical: 8,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  stripRow: {
    paddingHorizontal: 10,
    gap: 8,
  },
  stripThumb: {
    width: 56,
    height: 56,
    borderRadius: 8,
    opacity: 0.7,
  },
  stripThumbActive: {
    opacity: 1,
    borderWidth: 2,
    borderColor: '#fff',
  },
  body: {
    padding: 20,
    gap: 4,
  },
  attribution: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 6,
  },
  attrAvatar: { width: 22, height: 22, borderRadius: 11 },
  attrFallback: {
    backgroundColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attrInitial: { color: C.muted, fontSize: 11, fontFamily: FONTS.sansBold },
  attrName: {
    fontFamily: FONTS.mono,
    fontSize: 13,
    color: C.muted,
  },
  species: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 20,
    color: '#fff',
  },
  metaLine: {
    fontFamily: FONTS.mono,
    fontSize: 13,
    color: C.muted,
  },
  addingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  addingText: { fontFamily: FONTS.sans, fontSize: 13, color: C.muted },
})
