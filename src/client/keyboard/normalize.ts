import type { KeyInput } from '../contract/keyboard.js'

export function normalizeKeyboardEvent(event: Pick<KeyboardEvent, 'key' | 'code' | 'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'isComposing' | 'repeat' | 'keyCode'>): KeyInput {
  return {
    key: normalizeKey(event.code, event.key),
    ...(event.code !== undefined ? { code: event.code } : {}),
    alt: event.altKey,
    ctrl: event.ctrlKey,
    meta: event.metaKey,
    shift: event.shiftKey,
    composing: event.isComposing,
    repeat: event.repeat,
    keyCode: event.keyCode,
  }
}

function normalizeKey(code: string | undefined, key: string): string {
  const physicalKey = codeToKey(code)
  if (physicalKey !== undefined) return physicalKey
  if (key === 'Esc') return 'Escape'
  return key.length === 1 ? key.toLowerCase() : key
}

function codeToKey(code: string | undefined): string | undefined {
  if (code?.startsWith('Key') && code.length === 4) return code.slice(3).toLowerCase()
  if (code?.startsWith('Digit') && code.length === 6) return code.slice(5)
  return undefined
}
