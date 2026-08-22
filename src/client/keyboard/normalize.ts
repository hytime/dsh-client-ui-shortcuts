import type { KeyInput } from '../contract/keyboard.js'

export function normalizeKeyboardEvent(event: Pick<KeyboardEvent, 'key' | 'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'isComposing' | 'repeat' | 'keyCode'>): KeyInput {
  return {
    key: normalizeKey(event.key),
    alt: event.altKey,
    ctrl: event.ctrlKey,
    meta: event.metaKey,
    shift: event.shiftKey,
    composing: event.isComposing,
    repeat: event.repeat,
    keyCode: event.keyCode,
  }
}

function normalizeKey(key: string): string {
  if (key === 'Esc') return 'Escape'
  return key.length === 1 ? key.toLowerCase() : key
}
