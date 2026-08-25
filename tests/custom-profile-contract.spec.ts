import { describe, expect, it } from 'vitest'
import {
  LEGACY_CUSTOM_PROFILE_ID,
  customProfileFilename,
  customProfileFingerprint,
  normalizeCustomProfiles,
  resolveUniqueCustomProfileName,
} from '../src/custom-profile-contract.js'
import { ShortcutSettingsSchema } from '../src/settings.js'

const binding = {
  command: 'openSettings',
  scope: 'global',
  key: { key: 's', modifiers: ['Meta'] },
}

describe('custom profile contract', () => {
  it('leaves customProfiles absent when the setting is not provided', () => {
    const resolved = ShortcutSettingsSchema({})

    expect(resolved.customProfiles).toBeUndefined()
    expect(resolved).not.toHaveProperty('customProfiles')
  })

  it('preserves an explicitly empty customProfiles array', () => {
    const resolved = ShortcutSettingsSchema({ customProfiles: [] })

    expect(resolved.customProfiles).toEqual([])
    expect(resolved).toHaveProperty('customProfiles')
  })

  it('owns normalized profile data without mutating the caller', () => {
    const metadata = { source: ['imported'] }
    const input = [{ id: 'custom-a', name: ' Work ', bindings: [{ ...binding, metadata }] }]
    const result = normalizeCustomProfiles(input)
    expect(result).toEqual([{ id: 'custom-a', name: 'Work', bindings: [{ ...binding, metadata }] }])
    expect(result).not.toBe(input)
    expect(result[0]!.bindings).not.toBe(input[0]!.bindings)
    expect(result[0]!.bindings[0]!.metadata).not.toBe(metadata)
  })

  it('reserves built-in ids and permits one nameless legacy profile', () => {
    expect(() => normalizeCustomProfiles([{ id: 'standard', name: 'X', bindings: [binding] }])).toThrow('reserved')
    expect(normalizeCustomProfiles([{ id: LEGACY_CUSTOM_PROFILE_ID, bindings: [binding] }])[0]!.name).toBeUndefined()
  })

  it.each(['standard', 'vim'])('rejects reserved built-in id %s', (id) => {
    expect(() => normalizeCustomProfiles([{ id, name: 'Work', bindings: [binding] }])).toThrow('reserved')
  })

  it('rejects duplicate ids', () => {
    expect(() => normalizeCustomProfiles([
      { id: 'custom-a', name: 'Work', bindings: [binding] },
      { id: 'custom-a', name: 'Home', bindings: [binding] },
    ])).toThrow('duplicate')
  })

  it('rejects duplicate explicit names', () => {
    expect(() => normalizeCustomProfiles([
      { id: 'custom-a', name: ' Work ', bindings: [binding] },
      { id: 'custom-b', name: 'Work', bindings: [binding] },
    ])).toThrow('duplicate')
  })

  it('rejects empty bindings and delegates invalid bindings to the binding contract', () => {
    expect(() => normalizeCustomProfiles([{ id: 'custom-a', name: 'Work', bindings: [] }])).toThrow('non-empty')
    expect(() => normalizeCustomProfiles([{
      id: 'custom-a',
      name: 'Work',
      bindings: [{ ...binding, command: 'missing' }],
    }])).toThrow('command')
  })

  it('rejects names longer than 64 unicode code points', () => {
    expect(() => normalizeCustomProfiles([{
      id: 'custom-a',
      name: '😀'.repeat(65),
      bindings: [binding],
    }])).toThrow('64')
  })

  it('counts combining characters as separate unicode code points', () => {
    const combiningName = 'e\u0301'.repeat(32)
    expect(normalizeCustomProfiles([{
      id: 'custom-a',
      name: combiningName,
      bindings: [binding],
    }])[0]!.name).toBe(combiningName)
    expect(() => normalizeCustomProfiles([{
      id: 'custom-a',
      name: `${combiningName}x`,
      bindings: [binding],
    }])).toThrow('64')
  })

  it('numbers duplicate names without splitting unicode code points', () => {
    expect(resolveUniqueCustomProfileName('Work', ['Work', 'Work 1'])).toBe('Work 2')
    const base = '😀'.repeat(64)
    const result = resolveUniqueCustomProfileName(base, [base])
    expect(Array.from(result)).toHaveLength(64)
    expect(result.endsWith(' 1')).toBe(true)
  })

  it('continues numeric suffixes from Name 9 to Name 10', () => {
    expect(resolveUniqueCustomProfileName('Name 9', ['Name 9'])).toBe('Name 10')
  })

  it('uses deterministic safe download names', () => {
    expect(customProfileFilename('CON')).toBe('custom-CON.dsh-shortcuts.json')
    expect(customProfileFilename('../')).toBe('custom-profile.dsh-shortcuts.json')
  })

  it.each(['PRN', 'AUX', 'NUL', 'COM1', 'COM9', 'LPT1', 'LPT9', 'CON.txt', 'COM1.foo', 'lpt9.JSON'])('prefixes Windows reserved filename %s', (name) => {
    expect(customProfileFilename(name)).toBe(`custom-${name}.dsh-shortcuts.json`)
  })

  it.each([
    ['trailing dot', 'Work.', 'Work.dsh-shortcuts.json'],
    ['trailing space', 'Work ', 'Work.dsh-shortcuts.json'],
    ['control characters', 'Wo\u0000rk\u001f', 'Work.dsh-shortcuts.json'],
  ])('sanitizes %s', (_label, name, expected) => {
    expect(customProfileFilename(name)).toBe(expected)
  })

  it('limits the safe filename stem to 80 unicode code points', () => {
    const filename = customProfileFilename('😀'.repeat(81))
    expect(filename).toBe(`${'😀'.repeat(80)}.dsh-shortcuts.json`)
    expect(Array.from(filename.slice(0, -'.dsh-shortcuts.json'.length))).toHaveLength(80)
  })

  it('fingerprints normalized profile content deterministically', () => {
    const profile = normalizeCustomProfiles([{ id: 'custom-a', name: 'Work', bindings: [binding] }])[0]!
    expect(customProfileFingerprint(profile)).toBe(customProfileFingerprint({
      id: 'custom-a',
      name: 'Work',
      bindings: [{ scope: 'global', key: { modifiers: ['Meta'], key: 's' }, command: 'openSettings' }],
    }))
    expect(customProfileFingerprint({ ...profile, name: 'Home' })).not.toBe(customProfileFingerprint(profile))
    expect(() => customProfileFingerprint({
      ...profile,
      bindings: [{ ...binding, invalid: undefined }],
    })).toThrow('JSON')
  })
})
