// Native port of the web CatchGrid card (src/components/CatchGrid/): 4:3 image,
// angler row, species, date, location. Shared by home feed, profile, and search.
import { memo } from 'react'
import { View, Text, Image, StyleSheet } from 'react-native'
import { photoUrl } from '../lib/storage'
import { formatDateNumeric, formatCatchLocation, cleanSpecies, getDisplayName } from '../lib/formatters'
import { C, RADII, FONTS } from '../lib/theme'
import { selectFromActionSheet } from '../lib/actionSheet'
import { shareCatch, deleteCatch } from '../lib/catchActions'
import { useAuthStore } from '../store/useAuthStore'
import { usePhotoStore } from '../store/usePhotoStore'
import { PressableFeedback } from './PressableFeedback'

function Avatar({ profile }) {
  const name = getDisplayName(profile)
  if (profile?.avatar_url) {
    return <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
  }
  return (
    <View style={[styles.avatar, styles.avatarFallback]}>
      <Text style={styles.avatarInitial}>{name ? name[0].toUpperCase() : '?'}</Text>
    </View>
  )
}

export const CatchCard = memo(function CatchCard({
  group,
  profile, // owner profile row from profilesById
  isOwn = false,
  onPress,
}) {
  const user = useAuthStore(s => s.user)
  const removePhotos = usePhotoStore(s => s.removePhotos)
  const lead = group[0]
  const species = cleanSpecies(lead.species)
  const location = formatCatchLocation(lead.meta)
  const anglerName = getDisplayName(profile)

  const openActions = () => {
    if (!isOwn) return
    selectFromActionSheet(species || 'Catch', ['Edit', 'Share', 'Delete'], option => {
      if (option === 'Edit') onPress?.(group)
      else if (option === 'Share') shareCatch(lead)
      else if (option === 'Delete') deleteCatch(group, user, { removePhotos })
    }, { destructiveIndex: 2 })
  }

  return (
    <PressableFeedback
      style={styles.card}
      pressedStyle={styles.cardPressed}
      onPress={() => onPress?.(group)}
      onLongPress={openActions}
      accessibilityRole="button"
      accessibilityLabel={species || 'Catch'}
    >
      <View style={styles.imageWrap}>
        <Image
          source={{ uri: photoUrl(lead.user_id, lead.filename, lead.storage_path) }}
          style={styles.image}
          resizeMode="cover"
        />
      </View>
      {anglerName ? (
        <View style={styles.anglerRow}>
          <Avatar profile={profile} />
          <Text style={styles.anglerName} numberOfLines={1}>{anglerName}</Text>
        </View>
      ) : null}
      <Text style={species ? styles.species : styles.speciesEmpty} numberOfLines={1}>
        {species || 'Unknown'}
      </Text>
      {lead.time ? <Text style={styles.meta}>{formatDateNumeric(lead.time)}</Text> : null}
      {location ? <Text style={styles.meta} numberOfLines={1}>{location}</Text> : null}
    </PressableFeedback>
  )
})

const styles = StyleSheet.create({
  card: {
    gap: 3,
  },
  cardPressed: { opacity: 0.85 },
  imageWrap: {
    aspectRatio: 4 / 3,
    borderRadius: RADII.card,
    overflow: 'hidden',
    backgroundColor: C.border,
    marginBottom: 7,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  anglerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 1,
  },
  avatar: { width: 18, height: 18, borderRadius: 9 },
  avatarFallback: {
    backgroundColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { color: C.cardMuted, fontSize: 10, fontFamily: FONTS.sansBold },
  anglerName: {
    fontFamily: FONTS.condensed,
    fontSize: 12,
    color: C.cardMuted,
    flexShrink: 1,
  },
  species: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 16,
    color: '#fff',
  },
  speciesEmpty: {
    fontFamily: FONTS.sans,
    fontSize: 16,
    color: C.cardMuted,
    fontStyle: 'italic',
  },
  meta: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: C.cardMuted,
  },
})
