import { isBuiltinShortcutProfileId } from './profile-catalog.js'
import { normalizePersistedShortcutResult } from './shortcut-binding-contract.js'

import type { PersistedShortcutBinding } from './shortcut-binding-contract.js'

export const LEGACY_CUSTOM_PROFILE_ID = 'custom'
export const CUSTOM_PROFILE_NAME_MAX_CODE_POINTS = 64

const CUSTOM_PROFILE_FILENAME_MAX_CODE_POINTS = 80
const CUSTOM_PROFILE_FILENAME_SUFFIX = '.dsh-shortcuts.json'
const WINDOWS_RESERVED_FILENAME = /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i

export interface PersistedCustomShortcutProfile {
  readonly id: string
  readonly name?: string
  readonly bindings: readonly PersistedShortcutBinding[]
}

export function normalizeCustomProfiles(value: unknown): PersistedCustomShortcutProfile[] {
  if (!Array.isArray(value)) throw new Error('customProfiles must be an array')
  const ids = new Set<string>()
  const names = new Set<string>()
  return value.map((entry) => {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      throw new Error('invalid custom profile')
    }
    const profile = entry as Record<string, unknown>
    if (typeof profile.id !== 'string' || profile.id.trim() === '') throw new Error('invalid custom profile id')
    const id = profile.id.trim()
    if (isBuiltinShortcutProfileId(id)) throw new Error(`reserved custom profile id: ${id}`)
    if (ids.has(id)) throw new Error(`duplicate custom profile id: ${id}`)
    ids.add(id)

    let name: string | undefined
    if (profile.name === undefined && id === LEGACY_CUSTOM_PROFILE_ID) {
      name = undefined
    } else {
      if (typeof profile.name !== 'string') throw new Error('custom profile name is required')
      name = profile.name.trim()
      if (name === '') throw new Error('custom profile name is required')
      if (Array.from(name).length > CUSTOM_PROFILE_NAME_MAX_CODE_POINTS) {
        throw new Error(`custom profile name must contain at most ${CUSTOM_PROFILE_NAME_MAX_CODE_POINTS} code points`)
      }
      if (names.has(name)) throw new Error(`duplicate custom profile name: ${name}`)
      names.add(name)
    }

    if (!Array.isArray(profile.bindings)) throw new Error('custom profile bindings must be an array')
    const bindings = normalizePersistedShortcutResult(profile.bindings as readonly PersistedShortcutBinding[]).bindings
    return {
      id,
      ...(name !== undefined ? { name } : {}),
      bindings: bindings.map(binding => cloneJson(binding)),
    }
  })
}

export function resolveUniqueCustomProfileName(base: string, existing: readonly string[]): string {
  const existingNames = new Set(existing)
  const codePoints = Array.from(base.trim())
  const initial = codePoints.slice(0, CUSTOM_PROFILE_NAME_MAX_CODE_POINTS).join('')
  if (!existingNames.has(initial)) return initial

  const numbered = /^(.*) (\d+)$/.exec(initial)
  const root = numbered?.[1] ?? initial
  let index = numbered === null ? 1 : Number(numbered[2]) + 1
  while (true) {
    const suffix = ` ${index}`
    const candidate = `${Array.from(root).slice(0, CUSTOM_PROFILE_NAME_MAX_CODE_POINTS - Array.from(suffix).length).join('')}${suffix}`
    if (!existingNames.has(candidate)) return candidate
    index += 1
  }
}

export function customProfileFilename(name: string): string {
  let stem = name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '').trim().replace(/[. ]+$/g, '')
  stem = Array.from(stem).slice(0, CUSTOM_PROFILE_FILENAME_MAX_CODE_POINTS).join('')
  if (stem === '' || stem === '.' || stem === '..') stem = 'custom-profile'
  if (WINDOWS_RESERVED_FILENAME.test(stem)) stem = `custom-${stem}`
  return `${stem}${CUSTOM_PROFILE_FILENAME_SUFFIX}`
}

export function customProfileFingerprint(profile: PersistedCustomShortcutProfile): string {
  const normalized = normalizeCustomProfiles([profile])[0]!
  return stableJson(normalized)
}

function cloneJson<T>(value: T): T {
  if (Array.isArray(value)) return value.map(cloneJson) as T
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, cloneJson(child)])) as T
  }
  return value
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (typeof value === 'object' && value !== null) {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableJson((value as Record<string, unknown>)[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}
