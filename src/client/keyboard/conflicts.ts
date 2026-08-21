import type { ShortcutBinding, ShortcutProfile, ShortcutScope } from '../contract/profile.js'
import { canonicalSequenceKey, normalizeBindingSequences } from '../profiles/registry.js'
import type { NormalizedSequence } from '../profiles/registry.js'

export interface ShortcutConflict {
  readonly scope: ShortcutScope
  readonly key: string
  readonly first: ShortcutBinding
  readonly second: ShortcutBinding
}

export function findShortcutConflicts(profile: ShortcutProfile): ShortcutConflict[] {
  const entries = profile.bindings.flatMap(binding => normalizeBindingSequences(binding).map(sequence => ({ binding, sequence })))
  const conflicts: ShortcutConflict[] = []
  for (let index = 0; index < entries.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < entries.length; otherIndex += 1) {
      const first = entries[index]!
      const second = entries[otherIndex]!
      if (first.binding.scope !== second.binding.scope || !isPrefix(first.sequence, second.sequence)) continue
      conflicts.push({
        scope: first.binding.scope,
        key: canonicalSequenceKey(first.sequence).replace(/^\|\|\|\|\|/, '||||'),
        first: first.binding,
        second: second.binding,
      })
    }
  }
  return conflicts
}

function isPrefix(first: NormalizedSequence, second: NormalizedSequence): boolean {
  const shorter = first.strokes.length <= second.strokes.length ? first : second
  const longer = shorter === first ? second : first
  return shorter.strokes.every((stroke, index) => {
    const other = longer.strokes[index]!
    return stroke.key === other.key
      && stroke.alt === other.alt
      && stroke.shift === other.shift
      && (stroke.modifier === other.modifier
        || (stroke.modifier === 'Mod' && (other.ctrl || other.meta))
        || (other.modifier === 'Mod' && (stroke.ctrl || stroke.meta)))
  })
}
