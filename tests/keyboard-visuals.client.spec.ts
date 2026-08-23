import { describe, expect, it } from 'vitest'
import { ShortcutKeyIcon } from '../src/client/contract/keyboard-visual.js'
import { detectShortcutPlatform, isBindingPlatformCompatible, visualizeStroke } from '../src/client/keyboard/visuals.js'

describe('keyboard visuals', () => {
  it('renders physical modifiers consistently while adapting Meta and macOS Alt labels', () => {
    expect(visualizeStroke({ key: 'n', modifiers: ['Meta'] }, 'mac')).toEqual([
      { icon: ShortcutKeyIcon.Command, label: '⌘', ariaLabel: 'Command' },
      { icon: ShortcutKeyIcon.Character, label: 'N', ariaLabel: 'N' },
    ])
    expect(visualizeStroke({ key: 'n', modifiers: ['Meta'] }, 'windows')).toEqual([
      { icon: ShortcutKeyIcon.Windows, label: '⊞', ariaLabel: 'Windows key' },
      { icon: ShortcutKeyIcon.Character, label: 'N', ariaLabel: 'N' },
    ])
    expect(visualizeStroke({ key: 'n', modifiers: ['Ctrl'] }, 'mac')).toEqual([
      { icon: ShortcutKeyIcon.Control, label: 'Ctrl', ariaLabel: 'Control' },
      { icon: ShortcutKeyIcon.Character, label: 'N', ariaLabel: 'N' },
    ])
    expect(visualizeStroke({ key: 'n', modifiers: ['Alt'] }, 'mac')).toEqual([
      { icon: ShortcutKeyIcon.Option, label: '⌥', ariaLabel: 'Option' },
      { icon: ShortcutKeyIcon.Character, label: 'N', ariaLabel: 'N' },
    ])
  })

  it('keeps every explicit physical modifier compatible on every platform', () => {
    expect(isBindingPlatformCompatible({ key: 'p', modifiers: ['Ctrl'] }, 'mac')).toBe(true)
    expect(isBindingPlatformCompatible({ key: 'p', modifiers: ['Meta'] }, 'windows')).toBe(true)
    expect(isBindingPlatformCompatible({ key: 'p', modifiers: ['Alt'] }, 'linux')).toBe(true)
  })

  it('maps control keys and arrows to semantic icons', () => {
    expect(visualizeStroke({ key: 'ArrowUp', modifiers: ['Meta', 'Alt'] }, 'mac')).toEqual([
      expect.objectContaining({ icon: ShortcutKeyIcon.Command }),
      expect.objectContaining({ icon: ShortcutKeyIcon.Option }),
      expect.objectContaining({ icon: ShortcutKeyIcon.ArrowUp }),
    ])
    expect(visualizeStroke({ key: 'Enter', modifiers: [] }, 'linux')[0]).toEqual(
      expect.objectContaining({ icon: ShortcutKeyIcon.Enter }),
    )
  })

  it('visualizes explicit modifiers instead of hiding them by platform', () => {
    expect(visualizeStroke({ key: 'p', modifiers: ['Ctrl'] }, 'mac')).toEqual([
      { icon: ShortcutKeyIcon.Control, label: 'Ctrl', ariaLabel: 'Control' },
      { icon: ShortcutKeyIcon.Character, label: 'P', ariaLabel: 'P' },
    ])
    expect(visualizeStroke({ key: 'p', modifiers: ['Meta'] }, 'linux')).toEqual([
      { icon: ShortcutKeyIcon.Windows, label: '⊞', ariaLabel: 'Windows key' },
      { icon: ShortcutKeyIcon.Character, label: 'P', ariaLabel: 'P' },
    ])
  })

  it('normalizes short arrow aliases in all four directions', () => {
    expect(visualizeStroke({ key: 'Up', modifiers: [] }, 'linux')[0].icon).toBe(ShortcutKeyIcon.ArrowUp)
    expect(visualizeStroke({ key: 'Down', modifiers: [] }, 'linux')[0].icon).toBe(ShortcutKeyIcon.ArrowDown)
    expect(visualizeStroke({ key: 'Left', modifiers: [] }, 'linux')[0].icon).toBe(ShortcutKeyIcon.ArrowLeft)
    expect(visualizeStroke({ key: 'Right', modifiers: [] }, 'linux')[0].icon).toBe(ShortcutKeyIcon.ArrowRight)
  })

  it('detects explicit platform strings and defaults unknown values to linux', () => {
    expect(detectShortcutPlatform({ platform: 'MacIntel', userAgent: '' })).toBe('mac')
    expect(detectShortcutPlatform({ platform: 'Win32', userAgent: '' })).toBe('windows')
    expect(detectShortcutPlatform({ platform: '', userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)' })).toBe('mac')
    expect(detectShortcutPlatform({ platform: '', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' })).toBe('windows')
    expect(detectShortcutPlatform({ platform: 'Other', userAgent: 'Unknown' })).toBe('linux')
  })
})
