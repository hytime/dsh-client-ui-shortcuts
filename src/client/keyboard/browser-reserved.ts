import type { ShortcutBinding, ShortcutStroke } from '../contract/profile.js'
import type { ShortcutPlatform } from '../contract/keyboard-visual.js'

export type BrowserReservedSource = 'chrome' | 'safari' | 'firefox' | 'edge'
export interface BrowserReservedDiagnostic { readonly sequence: ShortcutStroke; readonly source: BrowserReservedSource; readonly message: string }

const reserved = [
  ['chrome', ['n', 't', 'w', 'p', 'l', 's', 'f', 'r'], ['Mod']],
  ['chrome', ['n'], ['Mod', 'Shift']],
  ['chrome', ['ArrowLeft', 'ArrowRight'], ['Mod', 'Alt']],
  ['safari', ['n', 't', 'w', 'p', 'l', 'f', 'r'], ['Mod']],
  ['firefox', ['n', 't', 'w', 'l', 'f', 'r'], ['Mod']],
  ['edge', ['n', 't', 'w', 'p', 'l', 'f', 'r'], ['Mod']],
] as const
const normalize = (stroke: ShortcutStroke): ShortcutStroke => ({ key: stroke.key, modifiers: [...stroke.modifiers].sort() })
const same = (left: ShortcutStroke, right: ShortcutStroke): boolean => left.key === right.key && JSON.stringify(normalize(left).modifiers) === JSON.stringify(normalize(right).modifiers)
const sequencesOf = (binding: ShortcutBinding): readonly (readonly (ShortcutBinding['key'])[])[] => binding.sequences ?? (binding.sequence !== undefined ? [binding.sequence] : binding.key !== undefined ? [[binding.key]] : [])
const toSymbolic = (stroke: NonNullable<ShortcutBinding['key']>): ShortcutStroke => 'modifiers' in stroke ? stroke : { key: stroke.key, modifiers: [stroke.ctrl && 'Ctrl', stroke.meta && 'Meta', stroke.alt && 'Alt', stroke.shift && 'Shift'].filter(Boolean) as ShortcutStroke['modifiers'] }

export function browserReservedDiagnostics(binding: ShortcutBinding, platform: ShortcutPlatform): readonly BrowserReservedDiagnostic[] {
  const physicalMod = platform === 'mac' ? 'Meta' : 'Ctrl'
  return sequencesOf(binding).flatMap(sequence => sequence.length === 1 && sequence[0] !== undefined ? reserved.flatMap(([source, keys, modifiers]) => keys.filter(key => same(toSymbolic(sequence[0]!), { key, modifiers: modifiers.map(modifier => modifier === 'Mod' ? physicalMod : modifier) as ShortcutStroke['modifiers'] })).map(key => ({ sequence: { key, modifiers: modifiers as ShortcutStroke['modifiers'] }, source, message: `Shortcut ${key} is reserved by ${source}.` }))) : [])
}
