import { useState, useEffect, useRef, useCallback } from 'react'
import {
  View, Text, Modal, TouchableOpacity, TextInput, ScrollView,
  Image, StyleSheet, Alert, ActivityIndicator, Platform, ActionSheetIOS,
  KeyboardAvoidingView,
} from 'react-native'
import DraggableFlatList, { ScaleDecorator } from 'react-native-draggable-flatlist'
import { supabase } from '../lib/supabase'
import { C } from '../lib/theme'
import { photoUrl } from '../lib/storage'
import { useAuthStore } from '../store/useAuthStore'
import { usePhotoStore } from '../store/usePhotoStore'

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

export function EditCatchModal({ visible, group, onClose, onSaved }) {
  const user = useAuthStore(s => s.user)
  const updatePhoto = usePhotoStore(s => s.updatePhoto)
  const reorderGroup = usePhotoStore(s => s.reorderGroup)

  const [species, setSpecies] = useState('')
  const [rod, setRod] = useState('')
  const [fly, setFly] = useState('')
  const [saving, setSaving] = useState(false)
  const [localPhotos, setLocalPhotos] = useState([])
  const initialOrderRef = useRef([])

  useEffect(() => {
    if (visible && group?.length) {
      const lead = group[0]
      setSpecies(lead.species ?? '')
      setRod(lead.meta?.rod ?? '')
      setFly(lead.meta?.fly ?? '')
      const sorted = [...group].sort((a, b) => (a.meta?.order ?? 999) - (b.meta?.order ?? 999))
      setLocalPhotos(sorted)
      initialOrderRef.current = sorted.map(p => p.id ?? p.filename)
    }
  }, [visible])

  const gearRods = user?.user_metadata?.gear_rods ?? []
  const gearFlies = user?.user_metadata?.gear_flies ?? []

  async function save() {
    if (!user || !group?.length) return
    setSaving(true)
    const lead = group[0]
    try {
      const updatedMeta = { ...lead.meta, rod: rod || undefined, fly: fly || undefined }

      if (lead.catchId) {
        // Bulk-update species for all photos in the catch, then update lead meta
        const { error: speciesErr } = await supabase.from('photos')
          .update({ species: species || null })
          .eq('catch_id', lead.catchId)
        if (speciesErr) throw speciesErr

        let metaQuery = supabase.from('photos').update({ meta: updatedMeta })
        metaQuery = lead.id
          ? metaQuery.eq('id', lead.id)
          : metaQuery.eq('filename', lead.filename).eq('user_id', user.id)
        const { error: metaErr } = await metaQuery
        if (metaErr) throw metaErr

        const { error: catchErr } = await supabase.from('catches')
          .update({ species: species || null, rod: rod || null, fly: fly || null })
          .eq('id', lead.catchId)
          .eq('user_id', user.id)
        if (catchErr) throw catchErr
      } else {
        let photoQuery = supabase.from('photos').update({ species: species || null, meta: updatedMeta })
        photoQuery = lead.id
          ? photoQuery.eq('id', lead.id)
          : photoQuery.eq('filename', lead.filename).eq('user_id', user.id)
        const { error } = await photoQuery
        if (error) throw error
      }

      // Update all group photos in the store
      group.forEach((p, i) => {
        updatePhoto(i === 0
          ? { ...p, species: species || undefined, meta: updatedMeta }
          : { ...p, species: species || undefined }
        )
      })

      const currentOrder = localPhotos.map(p => p.id ?? p.filename)
      const orderChanged = localPhotos.length > 1 &&
        initialOrderRef.current.some((id, i) => id !== currentOrder[i])
      if (orderChanged) {
        const results = await Promise.all(localPhotos.map((p, i) => {
          let q = supabase.from('photos').update({ meta: { ...p.meta, order: i } })
          q = p.id ? q.eq('id', p.id) : q.eq('filename', p.filename).eq('user_id', user.id)
          return q
        }))
        const reorderErr = results.find(r => r.error)?.error
        if (reorderErr) throw reorderErr
        reorderGroup(localPhotos)
      }

      onSaved?.()
      onClose()
    } catch (err) {
      console.error('[EditCatchModal] save:', err)
      Alert.alert('Error', 'Failed to save changes.')
    } finally {
      setSaving(false)
    }
  }

  const renderPhotoItem = useCallback(({ item, drag, isActive }) => (
    <ScaleDecorator>
      <TouchableOpacity onLongPress={drag} disabled={isActive} activeOpacity={0.8} style={styles.photoThumb}>
        <Image
          source={{ uri: photoUrl(item.user_id, item.filename, item.storage_path) }}
          style={styles.photoThumbImg}
          resizeMode="cover"
        />
      </TouchableOpacity>
    </ScaleDecorator>
  ), [])

  if (!group?.length) return null

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} disabled={saving} hitSlop={8}>
            <Text style={[styles.headerCancel, saving && styles.dimmed]}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Catch</Text>
          <TouchableOpacity onPress={save} disabled={saving} hitSlop={8}>
            {saving
              ? <ActivityIndicator size="small" color={C.accent} />
              : <Text style={styles.headerSave}>Save</Text>
            }
          </TouchableOpacity>
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
        >
          {localPhotos.length > 1 && (
            <View style={styles.photoSection}>
              <Text style={styles.sectionHint}>Long-press a photo to reorder</Text>
              <DraggableFlatList
                horizontal
                data={localPhotos}
                keyExtractor={p => String(p.id ?? p.filename)}
                onDragEnd={({ data }) => setLocalPhotos(data)}
                renderItem={renderPhotoItem}
                contentContainerStyle={styles.photoStrip}
                showsHorizontalScrollIndicator={false}
              />
            </View>
          )}

          <View style={styles.form}>
            <Text style={styles.fieldLabel}>Species</Text>
            <TextInput
              style={styles.input}
              value={species}
              onChangeText={setSpecies}
              placeholder="e.g. Brown Trout"
              placeholderTextColor={C.muted}
              autoCapitalize="words"
              returnKeyType="next"
            />

            <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Rod</Text>
            {gearRods.length > 0 ? (
              <TouchableOpacity style={styles.picker} onPress={() => selectFromActionSheet('Select Rod', gearRods, setRod)}>
                <Text style={[styles.pickerText, !rod && styles.pickerPlaceholder]}>{rod || 'Select your rod'}</Text>
                <Text style={styles.pickerChevron}>›</Text>
              </TouchableOpacity>
            ) : (
              <TextInput
                style={styles.input}
                value={rod}
                onChangeText={setRod}
                placeholder="e.g. 9ft 5wt"
                placeholderTextColor={C.muted}
                returnKeyType="next"
              />
            )}

            <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Fly</Text>
            {gearFlies.length > 0 ? (
              <TouchableOpacity style={styles.picker} onPress={() => selectFromActionSheet('Select Fly', gearFlies, setFly)}>
                <Text style={[styles.pickerText, !fly && styles.pickerPlaceholder]}>{fly || 'Select your fly'}</Text>
                <Text style={styles.pickerChevron}>›</Text>
              </TouchableOpacity>
            ) : (
              <TextInput
                style={styles.input}
                value={fly}
                onChangeText={setFly}
                placeholder="e.g. Elk Hair Caddis"
                placeholderTextColor={C.muted}
                returnKeyType="done"
              />
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
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
  headerSave: { color: C.accent, fontSize: 16, fontWeight: '600', textAlign: 'right', width: 56 },
  dimmed: { opacity: 0.4 },

  body: { paddingBottom: 40 },

  photoSection: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
    paddingVertical: 12,
  },
  sectionHint: {
    color: C.muted,
    fontSize: 12,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  photoStrip: { paddingHorizontal: 16, gap: 8 },
  photoThumb: {
    width: 80,
    height: 80,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: C.surface,
  },
  photoThumbImg: { width: 80, height: 80 },

  form: { padding: 16 },
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
})
