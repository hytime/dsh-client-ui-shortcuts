import type { KeyStroke, ShortcutBinding, ShortcutModifier, ShortcutStroke } from '../contract/profile.js'
import { ShortcutKeyIcon, type ShortcutKeyVisual, type ShortcutPlatform } from '../contract/keyboard-visual.js'

const modifierOrder: readonly ShortcutModifier[] = ['Ctrl', 'Mod', 'Alt', 'Shift', 'Meta']

function keyVisual(key: string): ShortcutKeyVisual {
  const normalized = key === 'Esc' ? 'Escape' : key === ' ' ? 'Space' : ({ Up: 'ArrowUp', Down: 'ArrowDown', Left: 'ArrowLeft', Right: 'ArrowRight' } as Record<string, string>)[key] ?? key
  const controls: Record<string, [ShortcutKeyIcon, string, string]> = {
    Escape: [ShortcutKeyIcon.Escape, 'Esc', 'Escape'],
    Enter: [ShortcutKeyIcon.Enter, 'Enter', 'Enter'],
    Space: [ShortcutKeyIcon.Space, 'Space', 'Space'],
    ArrowUp: [ShortcutKeyIcon.ArrowUp, '↑', 'Arrow Up'],
    ArrowDown: [ShortcutKeyIcon.ArrowDown, '↓', 'Arrow Down'],
    ArrowLeft: [ShortcutKeyIcon.ArrowLeft, '←', 'Arrow Left'],
    ArrowRight: [ShortcutKeyIcon.ArrowRight, '→', 'Arrow Right'],
  }
  const control = controls[normalized]
  if (control) return { icon: control[0], label: control[1], ariaLabel: control[2] }
  const label = key.length === 1 ? key.toUpperCase() : key
  return { icon: ShortcutKeyIcon.Character, label, ariaLabel: label }
}

function modifierVisual(modifier: ShortcutModifier, platform: ShortcutPlatform): ShortcutKeyVisual {
  if (modifier === 'Mod') return platform === 'mac'
    ? { icon: ShortcutKeyIcon.Command, label: '⌘', ariaLabel: 'Command' }
    : { icon: ShortcutKeyIcon.Control, label: 'Ctrl', ariaLabel: 'Control' }
  if (modifier === 'Ctrl') return { icon: ShortcutKeyIcon.Control, label: 'Ctrl', ariaLabel: 'Control' }
  if (modifier === 'Meta') return { icon: ShortcutKeyIcon.Command, label: '⌘', ariaLabel: 'Command' }
  if (modifier === 'Alt') return { icon: ShortcutKeyIcon.Option, label: 'Alt', ariaLabel: 'Option' }
  return { icon: ShortcutKeyIcon.Shift, label: 'Shift', ariaLabel: 'Shift' }
}

export function visualizeStroke(stroke: KeyStroke | ShortcutStroke, platform: ShortcutPlatform): readonly ShortcutKeyVisual[] {
  const modifiers: ShortcutModifier[] = 'modifiers' in stroke
    ? [...stroke.modifiers].filter(modifier => !(modifier === 'Ctrl' && platform === 'mac') && !(modifier === 'Meta' && platform !== 'mac')).sort((a, b) => modifierOrder.indexOf(a) - modifierOrder.indexOf(b))
    : [stroke.ctrl && 'Ctrl', stroke.meta && 'Meta', stroke.alt && 'Alt', stroke.shift && 'Shift'].filter(Boolean) as ShortcutModifier[]
  return [...modifiers.map(modifier => modifierVisual(modifier, platform)), keyVisual(stroke.key)]
}

export function isBindingPlatformCompatible(stroke: KeyStroke | ShortcutStroke, platform: ShortcutPlatform): boolean {
  if ('modifiers' in stroke) return !stroke.modifiers.some(modifier => (modifier === 'Ctrl' && platform === 'mac') || (modifier === 'Meta' && platform !== 'mac'))
  if (stroke.ctrl && platform === 'mac') return false
  if (stroke.meta && platform !== 'mac') return false
  return true
}

export function bindingSequenceCandidates(binding: ShortcutBinding): readonly (readonly (KeyStroke | ShortcutStroke)[])[] {
  if (binding.sequences !== undefined) return binding.sequences
  if (binding.sequence !== undefined) return [binding.sequence]
  return binding.key === undefined ? [] : [[binding.key]]
}

export function compatibleBindingSequences(binding: ShortcutBinding, platform: ShortcutPlatform): readonly (readonly (KeyStroke | ShortcutStroke)[])[] {
  return bindingSequenceCandidates(binding).filter(sequence => sequence.length > 0 && sequence.every(stroke => isBindingPlatformCompatible(stroke, platform)))
}
export function detectShortcutPlatform(navigatorLike: Pick<Navigator, 'platform' | 'userAgent'>): ShortcutPlatform {
  const platform = typeof navigatorLike.platform === 'string' ? navigatorLike.platform.toLowerCase() : ''
  if (platform === 'macintel' || platform.includes('mac')) return 'mac'
  if (platform === 'win32' || platform.includes('win')) return 'windows'
  return 'linux'
}
