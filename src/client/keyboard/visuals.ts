import type { KeyStroke, ShortcutModifier, ShortcutStroke } from '../contract/profile.js'
import { ShortcutKeyIcon, type ShortcutKeyVisual, type ShortcutPlatform } from '../contract/keyboard-visual.js'

const modifierOrder: readonly ShortcutModifier[] = ['Ctrl', 'Mod', 'Alt', 'Shift', 'Meta']

function keyVisual(key: string): ShortcutKeyVisual {
  const normalized = key === 'Esc' ? 'Escape' : key === ' ' ? 'Space' : key
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
    ? [...stroke.modifiers].sort((a, b) => modifierOrder.indexOf(a) - modifierOrder.indexOf(b))
    : [stroke.ctrl && 'Ctrl', stroke.meta && 'Meta', stroke.alt && 'Alt', stroke.shift && 'Shift'].filter(Boolean) as ShortcutModifier[]
  return [...modifiers.map(modifier => modifierVisual(modifier, platform)), keyVisual(stroke.key)]
}

export function isBindingPlatformCompatible(stroke: ShortcutStroke, platform: ShortcutPlatform): boolean {
  return !stroke.modifiers.some(modifier => (modifier === 'Ctrl' && platform === 'mac') || (modifier === 'Meta' && platform !== 'mac'))
}

export function detectShortcutPlatform(navigatorLike: Pick<Navigator, 'platform' | 'userAgent'>): ShortcutPlatform {
  const value = `${navigatorLike.platform} ${navigatorLike.userAgent}`.toLowerCase()
  return value.includes('mac') ? 'mac' : value.includes('win') ? 'windows' : 'linux'
}
