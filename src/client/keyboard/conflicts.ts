import type { ShortcutBinding, ShortcutProfile, ShortcutScope } from '../contract/profile.js'
import type { ShortcutPlatform } from '../contract/keyboard-visual.js'
import { canonicalSequenceKey, normalizeBindingSequences } from '../profiles/registry.js'
import type { NormalizedSequence } from '../profiles/registry.js'
import { isBindingPlatformCompatible } from './visuals.js'

export interface ShortcutConflict {
  readonly scope: ShortcutScope
  readonly key: string
  readonly first: ShortcutBinding
  readonly second: ShortcutBinding
}

export function findShortcutConflicts(profile: ShortcutProfile): ShortcutConflict[] {
  const entries = profile.bindings.flatMap(binding => normalizeBindingSequences(binding).map(sequence => ({ binding, sequence })))
  return findConflicts(entries, false)
}

export function findNewShortcutConflicts(
  baseline: readonly ShortcutBinding[],
  draftEntries: readonly { readonly binding: ShortcutBinding; readonly index: number }[],
  platform: ShortcutPlatform,
): ShortcutConflict[] {
  const visible = draftEntries.filter(entry => isBindingPlatformCompatible(entry.binding.key, platform))
  const entries = visible.flatMap(entry => normalizeBindingSequences(normalizeForConflict(entry.binding)).map(sequence => ({ ...entry, sequence })))
  const conflicts: ShortcutConflict[] = []
  const reported = new Set<string>()

  for (let index = 0; index < entries.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < entries.length; otherIndex += 1) {
      const first = entries[index]!
      const second = entries[otherIndex]!
      if (first.binding.scope === second.binding.scope || !isPrefix(first.sequence, second.sequence)) continue
      if (isInheritedConflict(baseline, first, second)) continue
      const pair = canonicalSequenceKey(first.sequence)
      if (reported.has(pair)) continue
      reported.add(pair)
      conflicts.push({ scope: first.binding.scope, key: canonicalSequenceKey(first.sequence), first: first.binding, second: second.binding })
    }
  }
  return conflicts
}

type DraftSequence = { readonly binding: ShortcutBinding; readonly index: number; readonly sequence: NormalizedSequence }

function isInheritedConflict(baseline: readonly ShortcutBinding[], first: DraftSequence, second: DraftSequence): boolean {
  const baselineFirst = baseline[first.index]
  const baselineSecond = baseline[second.index]
  if (baselineFirst === undefined || baselineSecond === undefined) return false
  const normalizedFirst = normalizeForConflict(first.binding)
  const normalizedSecond = normalizeForConflict(second.binding)
  if (!sameBinding(normalizedFirst, normalizeForConflict(baselineFirst))) return false
  if (!sameBinding(normalizedSecond, normalizeForConflict(baselineSecond))) return false
  const firstSequences = normalizeBindingSequences(normalizeForConflict(baselineFirst))
  const secondSequences = normalizeBindingSequences(normalizeForConflict(baselineSecond))
  return baselineFirst.scope !== baselineSecond.scope
    && firstSequences.some(firstSequence => secondSequences.some(secondSequence => isPrefix(firstSequence, secondSequence)))
}

function sameBinding(first: ShortcutBinding, second: ShortcutBinding): boolean {
  return JSON.stringify(first) === JSON.stringify(second)
}

function normalizeForConflict(binding: ShortcutBinding): ShortcutBinding {
  const key = binding.key
  if ('modifiers' in key && key.modifiers.length === 0) {
    return { ...binding, key: { key: key.key, alt: false, ctrl: false, meta: false, shift: false } }
  }
  return binding
}

function findConflicts(entries: readonly { readonly binding: ShortcutBinding; readonly sequence: NormalizedSequence }[], crossScope: boolean): ShortcutConflict[] {
  const conflicts: ShortcutConflict[] = []
  for (let index = 0; index < entries.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < entries.length; otherIndex += 1) {
      const first = entries[index]!
      const second = entries[otherIndex]!
      if ((!crossScope && first.binding.scope !== second.binding.scope) || !isPrefix(first.sequence, second.sequence)) continue
      conflicts.push({ scope: first.binding.scope, key: canonicalSequenceKey(first.sequence).replace(/^\|\|\|\|\|/, '||||'), first: first.binding, second: second.binding })
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
        || (stroke.modifier === 'Mod' && other.ctrl !== other.meta)
        || (other.modifier === 'Mod' && stroke.ctrl !== stroke.meta))
  })
}
