import type { ShortcutBinding, ShortcutProfile, ShortcutScope } from '../contract/profile.js'
import type { ShortcutPlatform } from '../contract/keyboard-visual.js'
import { canonicalSequenceKey, normalizeBindingSequences } from '../profiles/registry.js'
import type { NormalizedSequence, NormalizedStroke } from '../profiles/registry.js'
import { isBindingPlatformCompatible } from './visuals.js'

export interface ShortcutConflict { readonly scope: ShortcutScope; readonly key: string; readonly first: ShortcutBinding; readonly second: ShortcutBinding }
type Entry = { readonly binding: ShortcutBinding; readonly index: number; readonly sequence: NormalizedSequence }

export function findShortcutConflicts(profile: ShortcutProfile): ShortcutConflict[] {
  return compareEntries(profile.bindings.flatMap(binding => normalizeBindingSequences(binding).map(sequence => ({ binding, index: -1, sequence }))), false)
}

export function findNewShortcutConflicts(baseline: readonly ShortcutBinding[], draftEntries: readonly { readonly binding: ShortcutBinding; readonly index: number }[], platform: ShortcutPlatform): ShortcutConflict[] {
  const entries = draftEntries
    .filter(entry => bindingPlatformCompatible(entry.binding, platform))
    .flatMap(entry => platformSequences(entry.binding, platform).map(sequence => ({ ...entry, sequence })))
  const baselineEntries = baseline.flatMap((binding, index) => platformSequences(binding, platform).map(sequence => ({ binding, index, sequence })))
  const conflicts: ShortcutConflict[] = []
  const reported = new Set<string>()
  for (let index = 0; index < entries.length; index += 1) for (let otherIndex = index + 1; otherIndex < entries.length; otherIndex += 1) {
    const first = entries[index]!
    const second = entries[otherIndex]!
    if (first.binding.scope === second.binding.scope || !isPrefix(first.sequence, second.sequence)) continue
    if (isInheritedConflict(baseline, baselineEntries, first, second, platform)) continue
    const firstSequences = platformSequences(first.binding, platform).map(canonicalSequenceKey).join('~')
    const secondSequences = platformSequences(second.binding, platform).map(canonicalSequenceKey).join('~')
    const key = [first.index, first.binding.command, first.binding.scope, firstSequences, second.index, second.binding.command, second.binding.scope, secondSequences].join('|')
    if (reported.has(key)) continue
    reported.add(key)
    conflicts.push({ scope: first.binding.scope, key: canonicalSequenceKey(first.sequence), first: first.binding, second: second.binding })
  }
  return conflicts
}

function bindingPlatformCompatible(binding: ShortcutBinding, platform: ShortcutPlatform): boolean {
  const strokes = binding.sequence !== undefined
    ? binding.sequence
    : binding.sequences !== undefined
      ? binding.sequences.flat()
      : [binding.key]
  return strokes.every(stroke => isBindingPlatformCompatible(stroke, platform))
}

function platformSequences(binding: ShortcutBinding, platform: ShortcutPlatform): NormalizedSequence[] {
  return normalizeBindingSequences(binding).map(sequence => ({ strokes: sequence.strokes.map(stroke => platformStroke(stroke, platform)) }))
}

function platformStroke(stroke: NormalizedStroke, platform: ShortcutPlatform): NormalizedStroke {
  if (stroke.modifier === 'Mod') return { ...stroke, modifier: undefined, ctrl: platform !== 'mac', meta: platform === 'mac' }
  return { ...stroke, modifier: undefined }
}

function isInheritedConflict(baseline: readonly ShortcutBinding[], baselineEntries: readonly Entry[], first: Entry, second: Entry, platform: ShortcutPlatform): boolean {
  const baselineFirst = baseline[first.index]
  const baselineSecond = baseline[second.index]
  if (baselineFirst === undefined || baselineSecond === undefined) return false
  if (!sameBindingSequences(baselineFirst, first.binding, platform) || !sameBindingSequences(baselineSecond, second.binding, platform)) return false
  const firstBase = baselineEntries.filter(entry => entry.index === first.index)
  const secondBase = baselineEntries.filter(entry => entry.index === second.index)
  return firstBase.some(left => secondBase.some(right => isPrefix(left.sequence, right.sequence)))
}

function sameBindingSequences(first: ShortcutBinding, second: ShortcutBinding, platform: ShortcutPlatform): boolean {
  if (first.command !== second.command || first.scope !== second.scope) return false
  const left = platformSequences(first, platform).map(canonicalSequenceKey)
  const right = platformSequences(second, platform).map(canonicalSequenceKey)
  return left.length === right.length && left.every((value, index) => value === right[index])
}

function compareEntries(entries: readonly Entry[], crossScope: boolean): ShortcutConflict[] {
  const conflicts: ShortcutConflict[] = []
  for (let index = 0; index < entries.length; index += 1) for (let otherIndex = index + 1; otherIndex < entries.length; otherIndex += 1) {
    const first = entries[index]!
    const second = entries[otherIndex]!
    if ((!crossScope && first.binding.scope !== second.binding.scope) || !isPrefix(first.sequence, second.sequence)) continue
    conflicts.push({ scope: first.binding.scope, key: canonicalSequenceKey(first.sequence), first: first.binding, second: second.binding })
  }
  return conflicts
}

function isPrefix(first: NormalizedSequence, second: NormalizedSequence): boolean {
  const shorter = first.strokes.length <= second.strokes.length ? first : second
  const longer = shorter === first ? second : first
  return shorter.strokes.every((stroke, index) => equivalentStroke(stroke, longer.strokes[index]!))
}

function equivalentStroke(first: NormalizedStroke, second: NormalizedStroke): boolean {
  return first.key === second.key && first.alt === second.alt && first.shift === second.shift && first.ctrl === second.ctrl && first.meta === second.meta
}
