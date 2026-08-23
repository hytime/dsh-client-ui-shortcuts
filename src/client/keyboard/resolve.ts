import type { KeyInput, ShortcutDecision } from '../contract/keyboard.js'
import type { KeyStroke, ShortcutBinding, ShortcutProfile, ShortcutScope, ShortcutModifier, ShortcutStroke } from '../contract/profile.js'
import type { ShortcutPlatform } from '../contract/keyboard-visual.js'

type ResolverState = { profile: ShortcutProfile; scope: ShortcutScope; strokes: KeyInput[] } | undefined

export interface KeyResolver {
  resolve(profile: ShortcutProfile, scope: ShortcutScope, input: KeyInput, platform: ShortcutPlatform): ShortcutDecision
  reset(): void
}

export function createKeyResolver(): KeyResolver {
  let pending: ResolverState
  return {
    resolve(profile, scope, input, platform) {
      const result = resolveWithState(profile, scope, input, pending, platform)
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

export function resolveKey(profile: ShortcutProfile, scope: ShortcutScope, input: KeyInput, platform: ShortcutPlatform): ShortcutDecision {
  return resolveWithState(profile, scope, input, undefined, platform).decision
}

function resolveWithState(
  profile: ShortcutProfile,
  scope: ShortcutScope,
  input: KeyInput,
  pending: ResolverState,
  platform: ShortcutPlatform,
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
       sequence: sequence.map(stroke => ({ ...stroke, modifier: ('modifier' in stroke ? stroke.modifier : undefined) })),
    })))
  const exact = candidates.find(candidate => sameSequence(candidate.sequence, next, platform))
  if (exact) return { decision: { kind: 'command', command: exact.entry.command }, state: undefined }

  const prefix = candidates.some(candidate => candidate.sequence.length > next.length
    && sameSequence(candidate.sequence.slice(0, next.length), next, platform))
  return prefix
    ? { decision: { kind: 'pass' }, state: { profile, scope, strokes: next } }
    : { decision: { kind: 'pass' }, state: undefined }
}

function sequencesFor(binding: ShortcutBinding): readonly (readonly KeyStroke[])[] {
  const legacyModifier = (binding as ShortcutBinding & { readonly modifier?: ShortcutModifier }).modifier
  const convert = (stroke: KeyStroke | ShortcutStroke): KeyStroke & { readonly modifier?: ShortcutModifier } => {
    if ('modifiers' in stroke) {
      const modifiers = stroke.modifiers
      return {
        key: normalizeKey(stroke.key),
        alt: modifiers.includes('Alt'),
        ctrl: modifiers.includes('Ctrl'),
        meta: modifiers.includes('Meta'),
        shift: modifiers.includes('Shift'),
        modifier: modifiers.includes('Mod') ? 'Mod' : undefined,
      }
    }
    return { ...stroke, modifier: legacyModifier }
  }
  if (binding.sequences) return binding.sequences.map(sequence => sequence.map(convert))
  if (binding.sequence) return [binding.sequence.map(convert)]
  return binding.key === undefined ? [] : [[convert(binding.key)]]
}

function normalizeInput(input: KeyInput): KeyInput {
  return { ...input, key: normalizeKey(input.key) }
}

function normalizeKey(key: string): string {
  if (key === 'Esc') return 'Escape'
  return key.length === 1 ? key.toLowerCase() : key
}

function sameSequence(
  left: readonly KeyStroke[] | readonly KeyInput[],
  right: readonly KeyStroke[] | readonly KeyInput[],
  platform: ShortcutPlatform,
): boolean {
  return left.length === right.length && left.every((stroke, index) => sameStroke(stroke, right[index]!, platform))
}

function sameStroke(left: KeyStroke | KeyInput, right: KeyStroke | KeyInput, platform?: ShortcutPlatform): boolean {
  const leftModifier = 'modifier' in left ? left.modifier : undefined
  const effectiveLeftModifier = leftModifier ?? (left.ctrl ? 'Ctrl' : left.meta ? 'Meta' : undefined)
  const rightCtrl = right.ctrl
  const rightMeta = right.meta
  if (rightCtrl && rightMeta) return false
  if (effectiveLeftModifier === 'Ctrl' && platform === 'mac') return false
  if (effectiveLeftModifier === 'Meta' && platform !== undefined && platform !== 'mac') return false
  const modifierMatches = effectiveLeftModifier === 'Mod'
    ? platform === 'mac' ? rightMeta && !rightCtrl : rightCtrl && !rightMeta
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
  const stroke = binding.key
  return stroke !== undefined && 'modifiers' in stroke ? stroke.modifiers.find(modifier => modifier === 'Mod') : undefined
}
