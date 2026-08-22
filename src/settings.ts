import z from '@deepseek-ai/schemastery'
import { DEFAULT_SHORTCUT_PROFILE_ID } from './profile-catalog.js'
import { SHORTCUTS_SETTINGS_NAMESPACE } from './settings-namespace.js'

import type { PersistedShortcutBinding } from './shortcut-binding-contract.js'

export type { PersistedShortcutBinding } from './shortcut-binding-contract.js'

export { SHORTCUTS_SETTINGS_NAMESPACE } from './settings-namespace.js'

/** Persisted shortcut settings for the active profile selection and custom bindings. */
export interface ShortcutSettings {
  readonly activeProfile: string
  readonly customBindings: PersistedShortcutBinding[]
}

const jsonArray = z.array(z.any())

const defaultCustomBindings: PersistedShortcutBinding[] = [
  { command: 'openCommandPalette', scope: 'global', key: { key: 'p', modifiers: ['Mod'] } },
  { command: 'openSettings', scope: 'global', key: { key: ',', modifiers: ['Mod'] } },
  { command: 'startSession', scope: 'global', key: { key: 'n', modifiers: ['Mod'] } },
  { command: 'previousSession', scope: 'global', key: { key: 'ArrowUp', modifiers: ['Mod', 'Alt'] } },
  { command: 'nextSession', scope: 'global', key: { key: 'ArrowDown', modifiers: ['Mod', 'Alt'] } },
  { command: 'previousWorkspace', scope: 'global', key: { key: 'ArrowLeft', modifiers: ['Mod', 'Shift'] } },
  { command: 'nextWorkspace', scope: 'global', key: { key: 'ArrowRight', modifiers: ['Mod', 'Shift'] } },
  { command: 'forkSession', scope: 'global', key: { key: 'b', modifiers: ['Mod', 'Shift'] } },
  { command: 'toggleTheme', scope: 'global', key: { key: 'l', modifiers: ['Mod', 'Shift'] } },
  { command: 'focusPrevious', scope: 'question', key: { key: 'ArrowUp', modifiers: [] } },
  { command: 'focusNext', scope: 'question', key: { key: 'ArrowDown', modifiers: [] } },
  { command: 'activate', scope: 'question', key: { key: 'Enter', modifiers: [] } },
  { command: 'activate', scope: 'approval', key: { key: 'Enter', modifiers: [] } },
  { command: 'focusPrevious', scope: 'approval', key: { key: 'ArrowUp', modifiers: [] } },
  { command: 'focusNext', scope: 'approval', key: { key: 'ArrowDown', modifiers: [] } },
  { command: 'cancelTask', scope: 'question', key: { key: 'Escape', modifiers: [] } },
  { command: 'cancelTask', scope: 'approval', key: { key: 'Escape', modifiers: [] } },
]

const clonePersistedBindings = (bindings: readonly PersistedShortcutBinding[]): PersistedShortcutBinding[] => (
  bindings.map(binding => ({
    ...binding,
    ...(binding.key !== undefined ? { key: cloneJsonValue(binding.key) } : {}),
    ...(binding.sequence !== undefined ? { sequence: cloneJsonValue(binding.sequence) } : {}),
    ...(binding.sequences !== undefined ? { sequences: cloneJsonValue(binding.sequences) } : {}),
  }))
)

function cloneJsonValue(value: unknown): any {
  if (Array.isArray(value)) return value.map(cloneJsonValue)
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, cloneJsonValue(child)]))
  }
  return value
}

/** Schema and defaults for the shortcut settings namespace. */
export const ShortcutSettingsSchema: z<ShortcutSettings> = z.object({
  activeProfile: z.string().default(DEFAULT_SHORTCUT_PROFILE_ID),
  customBindings: jsonArray.default(clonePersistedBindings(defaultCustomBindings)),
})

export function defaultShortcutBindings(): readonly PersistedShortcutBinding[] {
  return clonePersistedBindings(defaultCustomBindings)
}
