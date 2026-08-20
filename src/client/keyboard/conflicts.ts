import type { ShortcutBinding, ShortcutProfile, ShortcutScope } from '../contract/profile.js'
import { canonicalBindingKey } from '../profiles/registry.js'

export interface ShortcutConflict {
  readonly scope: ShortcutScope
  readonly key: string
  readonly first: ShortcutBinding
  readonly second: ShortcutBinding
}

export function findShortcutConflicts(profile: ShortcutProfile): ShortcutConflict[] {
  const seen = new Map<string, ShortcutBinding>()
  const conflicts: ShortcutConflict[] = []
  for (const binding of profile.bindings) {
    const key = canonicalBindingKey(binding)
    const first = seen.get(key)
    if (first) conflicts.push({ scope: binding.scope, key, first, second: binding })
    else seen.set(key, binding)
  }
  return conflicts
}
