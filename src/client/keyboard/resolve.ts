import type { KeyInput, ShortcutDecision } from '../contract/keyboard.js'
import type { KeyStroke, ShortcutBinding, ShortcutProfile, ShortcutScope, ShortcutModifier } from '../contract/profile.js'

type ResolverState = { profile: ShortcutProfile; scope: ShortcutScope; strokes: KeyInput[] } | undefined

export interface KeyResolver {
  resolve(profile: ShortcutProfile, scope: ShortcutScope, input: KeyInput): ShortcutDecision
  reset(): void
}

export function createKeyResolver(): KeyResolver {
  let pending: ResolverState
  return {
    resolve(profile, scope, input) {
      const result = resolveWithState(profile, scope, input, pending)
      pending = result.state
      return result.decision
    },
    reset() {
      pending = undefined
    },
  }
}

export function normalizeKeyStroke(stroke: KeyStroke): KeyStroke {
  return { ...stroke, key: normalizeKey(stroke.key) }
}

export function resolveKey(profile: ShortcutProfile, scope: ShortcutScope, input: KeyInput): ShortcutDecision {
  return resolveWithState(profile, scope, input, undefined).decision
}

function resolveWithState(
  profile: ShortcutProfile,
  scope: ShortcutScope,
  input: KeyInput,
  pending: ResolverState,
): { decision: ShortcutDecision; state: ResolverState } {
  if (input.disabled || input.composing || input.keyCode === 229 || input.repeat) {
    return { decision: { kind: 'pass' }, state: pending }
  }

  const prior = pending?.profile === profile && pending.scope === scope ? pending.strokes : []
  const next = [...prior, normalizeInput(input)]
  const candidates = profile.bindings
    .filter(entry => entry.scope === scope)
    .flatMap(entry => sequencesFor(entry).map(sequence => ({
      entry,
      sequence: sequence.map(stroke => ({ ...stroke, modifier: entry.modifier })),
    })))
  const exact = candidates.find(candidate => sameSequence(candidate.sequence, next))
  if (exact) return { decision: { kind: 'command', command: exact.entry.command }, state: undefined }

  const prefix = candidates.some(candidate => candidate.sequence.length > next.length
    && sameSequence(candidate.sequence.slice(0, next.length), next))
  return prefix
    ? { decision: { kind: 'pass' }, state: { profile, scope, strokes: next } }
    : { decision: { kind: 'pass' }, state: undefined }
}

function sequencesFor(binding: ShortcutBinding): readonly (readonly KeyStroke[])[] {
  if (binding.sequences) return binding.sequences
  if (binding.sequence) return [binding.sequence]
  return [[binding.key]]
}

function normalizeInput(input: KeyInput): KeyInput {
  return { ...input, key: normalizeKey(input.key) }
}

function normalizeKey(key: string): string {
  return key === 'Esc' ? 'Escape' : key
}

function sameSequence(left: readonly KeyStroke[] | readonly KeyInput[], right: readonly KeyStroke[] | readonly KeyInput[]): boolean {
  return left.length === right.length && left.every((stroke, index) => sameStroke(stroke, right[index]!))
}

function sameStroke(left: KeyStroke | KeyInput, right: KeyStroke | KeyInput): boolean {
  const leftModifier = 'modifier' in left ? left.modifier : undefined
  const effectiveLeftModifier = leftModifier ?? (left.ctrl ? 'Ctrl' : left.meta ? 'Meta' : undefined)
  const rightCtrl = right.ctrl
  const rightMeta = right.meta
  const modifierMatches = effectiveLeftModifier === 'Mod'
    ? rightCtrl || rightMeta
    : effectiveLeftModifier === 'Ctrl'
      ? rightCtrl && !rightMeta
      : effectiveLeftModifier === 'Meta'
        ? rightMeta && !rightCtrl
        : left.ctrl === right.ctrl && left.meta === right.meta
  return normalizeKey(left.key) === normalizeKey(right.key)
    && left.alt === right.alt
    && modifierMatches
    && left.shift === right.shift
}

export function modifierForStroke(binding: ShortcutBinding): ShortcutModifier | undefined {
  return binding.modifier
}
