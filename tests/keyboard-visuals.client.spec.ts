import { describe, expect, it } from 'vitest'
import { ShortcutKeyIcon } from '../src/client/contract/keyboard-visual.js'
import { isBindingPlatformCompatible, visualizeStroke } from '../src/client/keyboard/visuals.js'

describe('keyboard visuals', () => {
  it('maps Mod to Command on macOS and Control elsewhere', () => {
    expect(visualizeStroke({ key: 'n', modifiers: ['Mod'] }, 'mac')).toEqual([
      { icon: ShortcutKeyIcon.Command, label: '⌘', ariaLabel: 'Command' },
      { icon: ShortcutKeyIcon.Character, label: 'N', ariaLabel: 'N' },
    ])
    expect(visualizeStroke({ key: 'n', modifiers: ['Mod'] }, 'windows')).toEqual([
      { icon: ShortcutKeyIcon.Control, label: 'Ctrl', ariaLabel: 'Control' },
      { icon: ShortcutKeyIcon.Character, label: 'N', ariaLabel: 'N' },
    ])
  })

  it('maps platform-specific physical modifiers only on their compatible platform', () => {
    expect(isBindingPlatformCompatible({ key: 'p', modifiers: ['Ctrl'] }, 'mac')).toBe(false)
    expect(isBindingPlatformCompatible({ key: 'p', modifiers: ['Meta'] }, 'windows')).toBe(false)
    expect(isBindingPlatformCompatible({ key: 'p', modifiers: ['Mod'] }, 'linux')).toBe(true)
  })

  it('maps control keys and arrows to semantic icons', () => {
    expect(visualizeStroke({ key: 'ArrowUp', modifiers: ['Mod', 'Alt'] }, 'mac')).toEqual([
      expect.objectContaining({ icon: ShortcutKeyIcon.Command }),
      expect.objectContaining({ icon: ShortcutKeyIcon.Option }),
      expect.objectContaining({ icon: ShortcutKeyIcon.ArrowUp }),
    ])
    expect(visualizeStroke({ key: 'Enter', modifiers: [] }, 'linux')[0]).toEqual(
      expect.objectContaining({ icon: ShortcutKeyIcon.Enter }),
    )
  })

  it('maps physical modifier flags and aliases without changing input', () => {
    const stroke = { key: 'Esc', alt: true, ctrl: false, meta: false, shift: true }
    expect(visualizeStroke(stroke, 'linux')).toEqual([
      { icon: ShortcutKeyIcon.Option, label: 'Alt', ariaLabel: 'Option' },
      { icon: ShortcutKeyIcon.Shift, label: 'Shift', ariaLabel: 'Shift' },
      { icon: ShortcutKeyIcon.Escape, label: 'Esc', ariaLabel: 'Escape' },
    ])
    expect(stroke).toEqual({ key: 'Esc', alt: true, ctrl: false, meta: false, shift: true })
  })
})
