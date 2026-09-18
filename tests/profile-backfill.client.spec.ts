import { describe, expect, it } from 'vitest'
import { standardProfile, vimProfile } from '../src/client/profiles/builtins.js'
import { completePersistedProfile, completeProfileBindings } from '../src/client/profiles/backfill.js'
import type { ShortcutBinding } from '../src/client/contract/profile.js'

const openSettings: ShortcutBinding = {
  command: 'openSettings',
  scope: 'global',
  key: { key: 's', modifiers: ['Meta'] },
}

function commands(bindings: readonly ShortcutBinding[]): readonly string[] {
  return bindings.map(binding => binding.command)
}

describe('custom profile command completion', () => {
  it('returns the same array when the profile already defines every slot', () => {
    expect(completeProfileBindings(standardProfile.bindings)).toBe(standardProfile.bindings)
  })

  it('appends the default for each command the profile omits, keeping its own bindings first', () => {
    const completed = completeProfileBindings([openSettings])

    expect(completed[0]).toBe(openSettings)
    expect(completed).toHaveLength(standardProfile.bindings.length)
    expect(new Set(commands(completed))).toEqual(new Set(commands(standardProfile.bindings)))
  })

  it('restores the documented panel key a profile saved before the command existed omits', () => {
    const saved = vimProfile.bindings.filter(binding => binding.command !== 'showShortcuts')

    const completed = completeProfileBindings(saved)

    expect(completed.find(binding => binding.command === 'showShortcuts')).toEqual(
      standardProfile.bindings.find(binding => binding.command === 'showShortcuts'),
    )
  })

  it('completes per command and scope rather than per command alone', () => {
    // `cancelTask` exists in two scopes; dropping only the approval one must
    // re-add exactly that slot and leave the question binding untouched.
    const bindings = standardProfile.bindings.filter(
      binding => !(binding.command === 'cancelTask' && binding.scope === 'approval'),
    )

    const completed = completeProfileBindings(bindings)

    expect(completed).toHaveLength(standardProfile.bindings.length)
    expect(completed.filter(binding => binding.command === 'cancelTask').map(binding => binding.scope))
      .toEqual(['question', 'approval'])
  })

  it('skips a default that would collide with the profile own bindings instead of rejecting it', () => {
    // The old panel key, deliberately repurposed: the default showShortcuts
    // binding must not be forced on top of it.
    const repurposed: ShortcutBinding = {
      command: 'openCommandPalette',
      scope: 'global',
      key: { key: 's', modifiers: ['Meta', 'Alt', 'Shift'] },
    }

    const completed = completeProfileBindings([repurposed])

    expect(completed[0]).toBe(repurposed)
    // Only the colliding default is skipped; the rest still land.
    expect(completed.some(binding => binding.command === 'showShortcuts')).toBe(false)
    expect(commands(completed)).toContain('openSettings')
    expect(completed).toHaveLength(standardProfile.bindings.length - 1)
  })

  it('leaves a malformed profile untouched rather than throwing', () => {
    const malformed = [{ command: 'not-a-command', scope: 'global', key: { key: 's', modifiers: [] } }] as unknown as readonly ShortcutBinding[]

    expect(() => completeProfileBindings(malformed)).not.toThrow()
  })

  it('projects a persisted profile only when something is missing', () => {
    const complete = { id: 'custom-a', name: 'Work', bindings: standardProfile.bindings }
    const incomplete = { id: 'custom-b', name: 'Other', bindings: [openSettings] }

    expect(completePersistedProfile(complete)).toBe(complete)
    expect(completePersistedProfile(incomplete).bindings).toHaveLength(standardProfile.bindings.length)
  })
})
