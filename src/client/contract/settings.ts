import type { PersistedShortcutBinding } from '../../shortcut-binding-contract.js'
import type { ShortcutBinding, ShortcutProfile } from './profile.js'

export interface PortableCustomProfile {
  readonly name: string
  readonly bindings: readonly PersistedShortcutBinding[]
}

export type ShortcutSettingsOperation = 'select' | 'create' | 'import' | 'save' | 'delete' | 'export'
export type ShortcutSettingsErrorCode =
  | 'UNAVAILABLE'
  | 'NOT_APPLIED'
  | 'PROFILE_MISSING'
  | 'ID_UNAVAILABLE'
  | 'ID_COLLISION'
export type ShortcutSettingsPartialResult = 'profile-saved' | 'selection-changed'

export interface ShortcutSettingsFailure {
  readonly code: ShortcutSettingsErrorCode
  readonly operation: ShortcutSettingsOperation
  readonly phase: 'id' | 'collection' | 'selection'
  readonly message: string
  readonly profileId?: string
  readonly partial?: ShortcutSettingsPartialResult
}

export interface ManagedShortcutProfile extends ShortcutProfile {
  readonly kind: 'builtin' | 'custom'
  readonly displayName: string
  readonly persistedName?: string
  readonly fingerprint: string
}

export interface ShortcutSettingsMutation {
  readonly field: 'customProfiles' | 'activeProfile'
  readonly value: unknown
  readonly expectedRevision: number
}

export interface ShortcutSettingsMutationView {
  readonly value: unknown
  readonly base?: unknown
  readonly user?: unknown
  readonly revision: number
}

export type ShortcutSettingsMutationResult =
  | { readonly ok: true; readonly view: ShortcutSettingsMutationView }
  | {
    readonly ok: false
    readonly kind: 'conflict' | 'rejected' | 'transport'
    readonly message: string
    readonly actualRevision?: number
  }

export type MutateShortcutSettings = (
  request: ShortcutSettingsMutation,
) => Promise<ShortcutSettingsMutationResult>

export interface ShortcutSettingsFace {
  writable(): boolean
  profiles(): readonly ManagedShortcutProfile[]
  activeProfileId(): string
  isCustomProfile(id: string): boolean
  createCustomProfile(): Promise<string>
  importCustomProfile(profile: PortableCustomProfile): Promise<string>
  saveCustomProfile(
    id: string,
    baselineFingerprint: string,
    name: string | undefined,
    bindings: readonly ShortcutBinding[],
  ): Promise<void>
  deleteCustomProfile(id: string): Promise<void>
  exportActiveCustomProfile(): PortableCustomProfile
  setActiveProfile(id: string): Promise<void>
  subscribe(listener: () => void): () => void
  error(): ShortcutSettingsFailure | undefined
}
