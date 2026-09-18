import type { ShortcutBinding } from '../contract/profile.js'
import type { PersistedCustomShortcutProfile } from '../../custom-profile-contract.js'
import type { PersistedShortcutBinding } from '../../shortcut-binding-contract.js'
import { standardProfile } from './builtins.js'
import { validateShortcutBindings } from './registry.js'

/**
 * A profile saved before a command existed has no binding for that command, and
 * the binding editor can only rebind a row — it cannot remove one. A missing
 * command is therefore never a deliberate choice, and without this completion an
 * upgraded plugin would silently lose the documented default key for it.
 */

/** Identity of one binding slot: a command is bindable once per scope. */
function slotOf(binding: ShortcutBinding): string {
  return `${binding.command}:${binding.scope}`
}

function isBindable(bindings: readonly ShortcutBinding[]): boolean {
  try {
    validateShortcutBindings(bindings)
    return true
  } catch {
    return false
  }
}

/**
 * Append the template's binding for every command+scope the profile omits.
 *
 * A candidate that would collide with the profile's own bindings is skipped
 * rather than rejecting the profile: an unusable default must never cost the
 * user their saved bindings.
 * @param bindings - persisted bindings of one custom profile.
 * @param template - binding source for commands the profile does not define.
 * @returns the original array when nothing is missing, otherwise a completed copy.
 */
export function completeProfileBindings(
  bindings: readonly ShortcutBinding[],
  template: readonly ShortcutBinding[] = standardProfile.bindings,
): readonly ShortcutBinding[] {
  const present = new Set(bindings.map(slotOf))
  const missing = template.filter(binding => !present.has(slotOf(binding)))
  if (missing.length === 0) return bindings

  const completed = [...bindings]
  for (const candidate of missing) {
    if (!isBindable([...completed, candidate])) continue
    completed.push(candidate)
  }
  return completed
}

/**
 * Project one persisted custom profile with its missing commands filled in.
 * @param profile - persisted profile as stored.
 * @returns the same profile when complete, otherwise a completed copy.
 */
export function completePersistedProfile(
  profile: PersistedCustomShortcutProfile,
): PersistedCustomShortcutProfile {
  const bindings = profile.bindings as unknown as readonly ShortcutBinding[]
  const completed = completeProfileBindings(bindings)
  if (completed === bindings) return profile
  return { ...profile, bindings: completed as unknown as readonly PersistedShortcutBinding[] }
}
