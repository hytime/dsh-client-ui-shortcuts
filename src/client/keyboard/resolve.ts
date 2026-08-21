import type { KeyInput, ShortcutDecision } from '../contract/keyboard.js'
import type { ShortcutBinding, ShortcutProfile, ShortcutScope, KeyStroke } from '../contract/profile.js'

let pending: { profile: ShortcutProfile; scope: ShortcutScope; strokes: KeyInput[] } | undefined

export function normalizeKeyStroke(stroke: KeyStroke): KeyStroke {
  return { ...stroke, key: stroke.key === 'Esc' ? 'Escape' : stroke.key }
}

export function resolveKey(profile: ShortcutProfile, scope: ShortcutScope, input: KeyInput): ShortcutDecision {
  if (input.disabled || input.composing || input.keyCode === 229 || input.repeat) return { kind: 'pass' }
  const next = [...(pending?.profile === profile && pending.scope === scope ? pending.strokes : []), normalizeInput(input)]
  const candidates = profile.bindings
    .filter(entry => entry.scope === scope)
    .flatMap(entry => sequencesFor(entry).map(sequence => ({ entry, sequence })))
  const exact = candidates.find(candidate => sameSequence(candidate.sequence, next))
  const prefix = candidates.some(candidate => candidate.sequence.length > next.length && sameSequence(candidate.sequence.slice(0, next.length), next))
  if (exact) {
    pending = undefined
    return { kind: 'command', command: exact.entry.command }
  }
  if (prefix) {
    pending = { profile, scope, strokes: next }
    return { kind: 'pass' }
  }
  pending = undefined
  return { kind: 'pass' }
}

function sequencesFor(binding: ShortcutBinding): readonly (readonly KeyStroke[])[] {
  if (binding.sequences) return binding.sequences
  if (binding.sequence) return [binding.sequence]
  if (binding.key) return [[binding.key]]
  return []
}

function normalizeInput(input: KeyInput): KeyInput {
  return { ...input, key: input.key === 'Esc' ? 'Escape' : input.key }
}

function sameSequence(left: readonly KeyStroke[] | readonly KeyInput[], right: readonly KeyStroke[] | readonly KeyInput[]): boolean {
  return left.length === right.length && left.every((stroke, index) => sameStroke(stroke, right[index]!))
}

function sameStroke(left: KeyStroke | KeyInput, right: KeyStroke | KeyInput): boolean {
  const key = left.key === 'Esc' ? 'Escape' : left.key
  const rightKey = right.key === 'Esc' ? 'Escape' : right.key
  const mod = left.meta || left.ctrl
  const rightMod = right.meta || right.ctrl
  return key === rightKey
    && left.alt === right.alt
    && (mod === rightMod || (left.meta === false && left.ctrl === false && right.meta === false && right.ctrl === false))
    && left.shift === right.shift
}
