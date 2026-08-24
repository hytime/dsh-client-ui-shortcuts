import { CUSTOM_PROFILE_NAME_MAX_CODE_POINTS } from '../../custom-profile-contract.js'
import { normalizePersistedShortcutResult } from '../../shortcut-binding-contract.js'

import type { PersistedShortcutBinding } from '../../shortcut-binding-contract.js'
import type { PortableCustomProfile } from '../contract/settings.js'

export const CUSTOM_PROFILE_JSON_FORMAT = 'dsh-client-ui-shortcuts/custom-profile'
export const CUSTOM_PROFILE_JSON_VERSION = 1
export const CUSTOM_PROFILE_JSON_MAX_BYTES = 1024 * 1024

const ENVELOPE_KEYS = ['format', 'version', 'profile'] as const
const PROFILE_KEYS = ['name', 'bindings'] as const

export function decodeCustomProfileJson(text: string, bytes: number): PortableCustomProfile {
  if (!Number.isSafeInteger(bytes) || bytes < 0) throw new Error('custom profile JSON byte count must be a non-negative integer')
  if (bytes > CUSTOM_PROFILE_JSON_MAX_BYTES) throw new Error('custom profile JSON must not exceed 1 MiB')

  const envelope = exactRecord(JSON.parse(text) as unknown, ENVELOPE_KEYS, 'invalid custom profile JSON envelope')
  if (envelope.format !== CUSTOM_PROFILE_JSON_FORMAT) throw new Error('invalid custom profile JSON format')
  if (envelope.version !== CUSTOM_PROFILE_JSON_VERSION) throw new Error('unsupported custom profile JSON version')

  const profile = exactRecord(envelope.profile, PROFILE_KEYS, 'invalid custom profile JSON profile')
  return normalizePortableProfile(profile.name, profile.bindings)
}

export function encodeCustomProfileJson(profile: PortableCustomProfile): string {
  const normalized = normalizePortableProfile(profile.name, profile.bindings)
  return `${JSON.stringify({
    format: CUSTOM_PROFILE_JSON_FORMAT,
    version: CUSTOM_PROFILE_JSON_VERSION,
    profile: normalized,
  }, null, 2)}\n`
}

function normalizePortableProfile(nameValue: unknown, bindingsValue: unknown): PortableCustomProfile {
  if (typeof nameValue !== 'string') throw new Error('custom profile name is required')
  const name = nameValue.trim()
  if (name === '') throw new Error('custom profile name is required')
  if (Array.from(name).length > CUSTOM_PROFILE_NAME_MAX_CODE_POINTS) {
    throw new Error(`custom profile name must contain at most ${CUSTOM_PROFILE_NAME_MAX_CODE_POINTS} code points`)
  }
  if (!Array.isArray(bindingsValue)) throw new Error('custom profile bindings must be an array')

  const source = bindingsValue as readonly PersistedShortcutBinding[]
  const normalized = normalizePersistedShortcutResult(source).bindings
  return {
    name,
    bindings: normalized.map((binding, index) => cloneJson(restoreStrokeExtensions(source[index]!, binding))),
  }
}

function restoreStrokeExtensions(
  sourceValue: PersistedShortcutBinding,
  normalizedValue: PersistedShortcutBinding,
): PersistedShortcutBinding {
  const source = sourceValue as Record<string, unknown>
  const normalized = normalizedValue as Record<string, unknown>
  if (normalized.key !== undefined) {
    return { ...normalized, key: mergeStroke(source.key, normalized.key) }
  }
  if (normalized.sequence !== undefined) {
    const sourceSequence = source.sequence as readonly unknown[]
    const normalizedSequence = normalized.sequence as readonly unknown[]
    return {
      ...normalized,
      sequence: normalizedSequence.map((stroke, index) => mergeStroke(sourceSequence[index], stroke)),
    }
  }

  const sourceSequences = source.sequences as readonly (readonly unknown[])[]
  const normalizedSequences = normalized.sequences as readonly (readonly unknown[])[]
  return {
    ...normalized,
    sequences: normalizedSequences.map((sequence, sequenceIndex) => sequence.map((stroke, strokeIndex) => (
      mergeStroke(sourceSequences[sequenceIndex]![strokeIndex], stroke)
    ))),
  }
}

function mergeStroke(source: unknown, normalized: unknown): Record<string, unknown> {
  return {
    ...(source as Record<string, unknown>),
    ...(normalized as Record<string, unknown>),
  }
}

function exactRecord(
  value: unknown,
  allowedKeys: readonly string[],
  message: string,
): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(message)
  const keys = Object.keys(value)
  if (keys.length !== allowedKeys.length || keys.some(key => !allowedKeys.includes(key))) throw new Error(message)
  return value as Record<string, unknown>
}

function cloneJson<T>(value: T): T {
  if (Array.isArray(value)) return value.map(cloneJson) as T
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, cloneJson(child)])) as T
  }
  return value
}
