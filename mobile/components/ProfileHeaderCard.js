// Shared dither header card for the own-profile and other-user-profile
// screens: DitherMesh background, a screen-specific corner action (settings
// gear vs follow button), avatar-or-fallback, name, bio, and the
// Catches/Followers/Following stats row.
import { View, Text, Image, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native'
import { DitherMesh } from './DitherMesh'
import { PressableFeedback } from './PressableFeedback'
import { RADII, FONTS } from '../lib/theme'

export function ProfileHeaderCard({
  cornerAction,
  avatarUrl,
  displayName,
  avatarUploading = false,
  onAvatarPress,
  bio,
  catchCount,
  followerCount,
  followingCount,
  onOpenFollowList,
}) {
  const initial = (displayName || '?')[0].toUpperCase()
  const AvatarWrap = onAvatarPress ? TouchableOpacity : View
  const avatarWrapProps = onAvatarPress
    ? { onPress: onAvatarPress, disabled: avatarUploading, accessibilityLabel: 'Change profile photo' }
    : {}

  return (
    <View style={styles.headerCard}>
      <DitherMesh />
      {cornerAction}

      <View style={styles.headerInner}>
        <AvatarWrap {...avatarWrapProps}>
          {avatarUrl
            ? <Image source={{ uri: avatarUrl }} style={styles.avatar} />
            : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarInitial}>{initial}</Text>
              </View>
            )
          }
          {avatarUploading && (
            <View style={styles.avatarOverlay}>
              <ActivityIndicator color="#fff" size="small" />
            </View>
          )}
        </AvatarWrap>
        <Text style={styles.displayName}>{displayName}</Text>
        {bio ? <Text style={styles.bio} numberOfLines={2}>{bio}</Text> : null}

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{catchCount}</Text>
            <Text style={styles.statLabel}>Catches</Text>
          </View>
          <PressableFeedback
            style={styles.stat}
            pressedStyle={styles.statPressed}
            onPress={() => onOpenFollowList('followers')}
            accessibilityRole="button"
          >
            <Text style={styles.statValue}>{followerCount ?? '—'}</Text>
            <Text style={styles.statLabel}>Followers</Text>
          </PressableFeedback>
          <PressableFeedback
            style={styles.stat}
            pressedStyle={styles.statPressed}
            onPress={() => onOpenFollowList('following')}
            accessibilityRole="button"
          >
            <Text style={styles.statValue}>{followingCount ?? '—'}</Text>
            <Text style={styles.statLabel}>Following</Text>
          </PressableFeedback>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  headerCard: {
    borderRadius: RADII.sheet,
    overflow: 'hidden',
    marginBottom: 18,
  },
  headerInner: {
    alignItems: 'center',
    paddingTop: 48,
    paddingBottom: 26,
    paddingHorizontal: 20,
  },
  avatar: { width: 100, height: 100, borderRadius: 50 },
  avatarFallback: {
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { fontSize: 40, fontFamily: FONTS.sansSemiBold, color: '#fff' },
  avatarOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 50,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  displayName: {
    fontFamily: FONTS.condensedSemiBold,
    fontSize: 20,
    color: '#fff',
    marginTop: 14,
    textAlign: 'center',
  },
  bio: {
    fontFamily: FONTS.sans,
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    // No fixed lineHeight: it wouldn't scale with Dynamic Type and would clip
    // wrapped text at larger accessibility text sizes.
    marginTop: 6,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 36,
    marginTop: 22,
  },
  stat: { alignItems: 'center' },
  statPressed: { opacity: 0.6 },
  statValue: {
    fontFamily: FONTS.mono,
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
  },
  statLabel: {
    fontFamily: FONTS.condensed,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
  },
})
