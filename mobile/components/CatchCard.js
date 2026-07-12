// Native port of the web CatchGrid card (src/components/CatchGrid/): 4:3 image,
// angler row, species, date, location. Shared by home feed, profile, and search.
import { memo } from 'react'
import { View, Text, Image, Pressable, StyleSheet, ActionSheetIOS, Platform } from 'react-native'
import { photoUrl } from '../lib/storage'
import { formatDateNumeric, formatCatchLocation, cleanSpecies, getDisplayName } from '../lib/formatters'
import { C, RADII, FONTS } from '../lib/theme'

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
  onEdit,
  onShare,
  onDelete,
}) {
  const lead = group[0]
  const species = cleanSpecies(lead.species)
  const location = formatCatchLocation(lead.meta)
  const anglerName = getDisplayName(profile)

  const openActions = () => {
    if (!isOwn || Platform.OS !== 'ios') return
    const options = ['Edit', 'Share', 'Delete', 'Cancel']
    ActionSheetIOS.showActionSheetWithOptions(
      { options, destructiveButtonIndex: 2, cancelButtonIndex: 3 },
      i => {
        if (i === 0) onEdit?.(group)
        else if (i === 1) onShare?.(group)
        else if (i === 2) onDelete?.(group)
      },
    )
  }

  return (
    <Pressable
      style={styles.card}
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
    </Pressable>
  )
})

const styles = StyleSheet.create({
  card: {
    gap: 3,
  },
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
