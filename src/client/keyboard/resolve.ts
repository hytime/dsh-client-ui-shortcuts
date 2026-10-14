import type { KeyInput, ShortcutDecision } from '../contract/keyboard.js'
import type { KeyStroke, ShortcutBinding, ShortcutProfile, ShortcutScope, ShortcutStroke } from '../contract/profile.js'

/** Resolve one key press against the enabled interaction profile. Single strokes only:
 * sequential chords and multi-candidate bindings now belong to DSH's own shortcut service. */
export function resolveKey(profile: ShortcutProfile, scope: ShortcutScope, input: KeyInput): ShortcutDecision {
  if (input.disabled || input.composing || input.keyCode === 229 || input.repeat) return { kind: 'pass' }
  const match = profile.bindings.find(binding => binding.scope === scope && sameStroke(binding.key, input))
  return match === undefined ? { kind: 'pass' } : { kind: 'command', command: match.command }
}

function sameStroke(stroke: KeyStroke | ShortcutStroke, input: KeyInput): boolean {
  const modifiers = 'modifiers' in stroke
    ? stroke.modifiers
    : [stroke.ctrl && 'Ctrl', stroke.meta && 'Meta', stroke.alt && 'Alt', stroke.shift && 'Shift'].filter(Boolean) as string[]
  return normalizeKey(stroke.key) === normalizeKey(input.key)
    && modifiers.includes('Ctrl') === input.ctrl
    && modifiers.includes('Meta') === input.meta
    && modifiers.includes('Alt') === input.alt
    && modifiers.includes('Shift') === input.shift
}

function normalizeKey(key: string): string {
  if (key === 'Esc') return 'Escape'
  return key.length === 1 ? key.toLowerCase() : key
}

/** Storage shape kept only for reading a legacy profile; never written back. */
export type PersistedProfileShape = ShortcutBinding
