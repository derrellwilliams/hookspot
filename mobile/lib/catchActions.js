import { Alert, Share } from 'react-native'
import * as Haptics from 'expo-haptics'
import { supabase } from './supabase'
import { storageKey, photoUrl } from './storage'

export function shareCatch(photo) {
  if (!photo) return
  Haptics.selectionAsync()
  Share.share({ url: photoUrl(photo.user_id, photo.filename, photo.storage_path) })
}

export function deleteCatch(group, user, { removePhotos, onDeleted } = {}) {
  if (!group?.length) return
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
            removePhotos?.(group)
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
            onDeleted?.()
          } catch (err) {
            console.error('[delete]', err)
            Alert.alert('Error', 'Failed to delete. Please try again.')
          }
        },
      },
    ],
  )
}
