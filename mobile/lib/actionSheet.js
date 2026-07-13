import { Platform, ActionSheetIOS, Alert } from 'react-native'

export function selectFromActionSheet(title, options, onSelect, { destructiveIndex } = {}) {
  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: ['Cancel', ...options],
        cancelButtonIndex: 0,
        ...(destructiveIndex != null ? { destructiveButtonIndex: destructiveIndex + 1 } : {}),
      },
      idx => { if (idx > 0) onSelect(options[idx - 1]) }
    )
  } else {
    Alert.alert(title, undefined, [
      ...options.map((o, i) => ({
        text: o,
        style: i === destructiveIndex ? 'destructive' : undefined,
        onPress: () => onSelect(o),
      })),
      { text: 'Cancel', style: 'cancel' },
    ])
  }
}
