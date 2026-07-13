// Shared wrapper for the "dim/tint on press" Pressable pattern used across
// nav tabs, cards, chips, and icon buttons — keeps each caller's own
// style/pressedStyle values, just removes the repeated ({ pressed }) => [...] glue.
import { Pressable } from 'react-native'

export function PressableFeedback({ style, pressedStyle, ...props }) {
  return <Pressable style={({ pressed }) => [style, pressed && pressedStyle]} {...props} />
}
