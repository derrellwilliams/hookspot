// Native port of web UserRow (src/components/UserRow/): 36px avatar, display
// name, @username. Used by search results and follow lists.
import { View, Text, Image, Pressable, StyleSheet } from 'react-native'
import { C, FONTS } from '../lib/theme'

export function UserRow({ user, onPress, right = null }) {
  const name = user.display_name || user.username
  const initial = (name || '?')[0].toUpperCase()
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={name}
    >
      {user.avatar_url
        ? <Image source={{ uri: user.avatar_url }} style={styles.avatar} />
        : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarInitial}>{initial}</Text>
          </View>
        )
      }
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{name}</Text>
        <Text style={styles.username} numberOfLines={1}>@{user.username}</Text>
      </View>
      {right}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  rowPressed: { backgroundColor: 'rgba(255,255,255,0.05)' },
  avatar: { width: 36, height: 36, borderRadius: 18 },
  avatarFallback: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { fontSize: 15, fontFamily: FONTS.sansSemiBold, color: C.muted },
  info: { flex: 1, minWidth: 0 },
  name: { fontFamily: FONTS.sansSemiBold, fontSize: 14, color: C.text },
  username: { fontFamily: FONTS.mono, fontSize: 12, color: C.muted, marginTop: 1 },
})
