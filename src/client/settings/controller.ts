import type { SettingsScope, SettingsScopeSnapshot } from '@deepseek-ai/dsh-client-runtime/client'
import {
  LEGACY_CUSTOM_PROFILE_ID,
  customProfileFingerprint,
  normalizeCustomProfiles,
  resolveUniqueCustomProfileName,
} from '../../custom-profile-contract.js'
import { DEFAULT_SHORTCUT_PROFILE_ID } from '../../profile-catalog.js'
import { standardProfile } from '../profiles/builtins.js'
import type { PersistedCustomShortcutProfile } from '../../custom-profile-contract.js'
import type { PersistedShortcutBinding, ShortcutSettings } from '../../settings.js'
import type { ShortcutBinding } from '../contract/profile.js'
import type {
  ManagedShortcutProfile,
  MutateShortcutSettings,
  PortableCustomProfile,
  ShortcutSettingsErrorCode,
  ShortcutSettingsFace,
  ShortcutSettingsFailure,
  ShortcutSettingsMutationView,
  ShortcutSettingsOperation,
  ShortcutSettingsPartialResult,
} from '../contract/settings.js'
import { validateShortcutBindings } from '../profiles/registry.js'
import type { ShortcutProfileRegistry } from '../profiles/types.js'

export interface ShortcutSettingsControllerOptions {
  readonly createId: () => string
  readonly legacyName: () => string
}

interface FailureContext {
  readonly operation: ShortcutSettingsOperation
  readonly phase: ShortcutSettingsFailure['phase']
  readonly profileId?: string
  readonly partial?: ShortcutSettingsPartialResult
}

/** Stable operation failure published through the public settings face. */
export class ShortcutSettingsOperationError extends Error implements ShortcutSettingsFailure {
  constructor(
    readonly code: ShortcutSettingsErrorCode,
    readonly operation: ShortcutSettingsOperation,
    readonly phase: ShortcutSettingsFailure['phase'],
    message: string,
    readonly profileId?: string,
    readonly partial?: ShortcutSettingsPartialResult,
  ) {
    super(message)
    this.name = 'ShortcutSettingsOperationError'
  }
}

/** Controller joining the durable settings mirror to the CAS mutation port. */
export class ShortcutSettingsController implements ShortcutSettingsFace {
  private readonly listeners = new Set<() => void>()
  private readonly disposeScope: () => void
  private operationTail: Promise<void> = Promise.resolve()
  private managedProfiles: readonly ManagedShortcutProfile[] = Object.freeze([])
  private currentId: string = DEFAULT_SHORTCUT_PROFILE_ID
  private lastError: ShortcutSettingsFailure | undefined
  private authoritative: SettingsScopeSnapshot<ShortcutSettings>
  private disposed = false
  private operationGeneration = 0
  private writeInFlight = false
  private pendingScopeChange = false
  private recoveryRevision: number | undefined
  private recoveryRequiresNewer = false
  private ready = false
  private canWrite = false

  constructor(
    private readonly scope: SettingsScope<ShortcutSettings>,
    private readonly registry: ShortcutProfileRegistry,
    private readonly mutate: MutateShortcutSettings,
    private readonly options: ShortcutSettingsControllerOptions,
  ) {
    this.authoritative = cloneSnapshot(scope.getSnapshot())
    this.rebuild(this.authoritative)
    this.disposeScope = scope.subscribe(() => this.onScopeChanged())
  }

  available(): boolean { return this.ready }

  writable(): boolean { return this.ready && this.canWrite && this.recoveryRevision === undefined }

  profiles(): readonly ManagedShortcutProfile[] { return this.managedProfiles }

  activeProfileId(): string { return this.currentId }

  isCustomProfile(id: string): boolean {
    return this.managedProfiles.some(profile => profile.id === id && profile.kind === 'custom')
  }

  createCustomProfile(): Promise<string> {
    return this.enqueue('create', async generation => {
      const snapshot = this.prepareWritable({ operation: 'create', phase: 'collection' })
      const profiles = this.readCustomProfiles(snapshot)
      const id = this.createProfileId('create', this.existingProfileIds(profiles))
      const name = resolveUniqueCustomProfileName(
        this.options.legacyName(),
        profiles.flatMap(profile => profile.name === undefined ? [] : [profile.name]),
      )
      const activeProfileId = snapshot.value?.activeProfile
      if (typeof activeProfileId !== 'string') {
        throw this.failure('PROFILE_MISSING', {
          operation: 'create', phase: 'collection',
        }, 'active shortcut profile is unavailable')
      }
      const source = this.registry.get(activeProfileId)
      if (source === undefined) {
        throw this.failure('PROFILE_MISSING', {
          operation: 'create', phase: 'collection', profileId: activeProfileId,
        }, `active shortcut profile "${activeProfileId}" is unavailable`)
      }
      const next = normalizeCustomProfiles([
        ...profiles,
        { id, name, bindings: source.bindings as unknown as readonly PersistedShortcutBinding[] },
      ])
      const expected = next.find(profile => profile.id === id)!
      const readBack = await this.write(
        'customProfiles', next, snapshot.revision,
        { operation: 'create', phase: 'collection', profileId: id },
      )
      if (readBack === undefined) return id
      const appended = this.readCustomProfiles(readBack).find(profile => profile.id === id)
      if (appended === undefined || customProfileFingerprint(appended) !== customProfileFingerprint(expected)) {
        throw this.failure('NOT_APPLIED', {
          operation: 'create', phase: 'collection', profileId: id,
        }, `custom profile "${id}" was not saved`)
      }
      if (this.disposed) return id
      await this.selectAfterCreate(id, 'create', readBack.revision)
      this.publishSuccess(generation)
      return id
    })
  }

  importCustomProfile(profile: PortableCustomProfile): Promise<string> {
    return this.enqueue('import', async generation => {
      const snapshot = this.prepareWritable({ operation: 'import', phase: 'collection' })
      const profiles = this.readCustomProfiles(snapshot)
      const id = this.createProfileId('import', this.existingProfileIds(profiles))
      const name = resolveUniqueCustomProfileName(
        profile.name,
        profiles.flatMap(entry => entry.name === undefined ? [] : [entry.name]),
      )
      const next = normalizeCustomProfiles([...profiles, { id, name, bindings: profile.bindings }])
      const expected = next.find(entry => entry.id === id)!
      const readBack = await this.write(
        'customProfiles', next, snapshot.revision,
        { operation: 'import', phase: 'collection', profileId: id },
      )
      if (readBack === undefined) return id
      const appended = this.readCustomProfiles(readBack).find(entry => entry.id === id)
      if (appended === undefined || customProfileFingerprint(appended) !== customProfileFingerprint(expected)) {
        throw this.failure('NOT_APPLIED', {
          operation: 'import', phase: 'collection', profileId: id,
        }, `custom profile "${id}" was not saved`)
      }
      if (this.disposed) return id
      await this.selectAfterCreate(id, 'import', readBack.revision)
      this.publishSuccess(generation)
      return id
    })
  }

  saveCustomProfile(
    id: string,
    baselineFingerprint: string,
    name: string | undefined,
    bindings: readonly ShortcutBinding[],
  ): Promise<void> {
    return this.enqueue('save', async generation => {
      const context = { operation: 'save', phase: 'collection', profileId: id } as const
      const snapshot = this.prepareWritable(context)
      const profiles = this.readCustomProfiles(snapshot)
      const index = profiles.findIndex(profile => profile.id === id)
      if (index < 0) throw this.failure('PROFILE_MISSING', context, `custom profile "${id}" is unavailable`)
      const current = profiles[index]!
      if (customProfileFingerprint(current) !== baselineFingerprint) {
        throw this.failure('NOT_APPLIED', context, `custom profile "${id}" changed before it could be saved`)
      }
      const normalizedBindings = validateShortcutBindings(bindings)
      const replacement = {
        id,
        ...(name !== undefined ? { name } : {}),
        bindings: normalizedBindings as unknown as readonly PersistedShortcutBinding[],
      }
      const next = normalizeCustomProfiles(profiles.map((profile, profileIndex) => (
        profileIndex === index ? replacement : profile
      )))
      const expected = next[index]!
      const readBack = await this.write('customProfiles', next, snapshot.revision, context)
      if (readBack === undefined) return
      const saved = this.readCustomProfiles(readBack).find(profile => profile.id === id)
      if (saved === undefined || customProfileFingerprint(saved) !== customProfileFingerprint(expected)) {
        throw this.failure('NOT_APPLIED', context, `custom profile "${id}" was not saved`)
      }
      this.publishSuccess(generation)
    })
  }

  resetCustomProfile(id: string, baselineFingerprint: string): Promise<void> {
    return this.enqueue('reset', async generation => {
      const context = { operation: 'reset', phase: 'collection', profileId: id } as const
      const snapshot = this.prepareWritable(context)
      const profiles = this.readCustomProfiles(snapshot)
      const index = profiles.findIndex(profile => profile.id === id)
      if (index < 0) throw this.failure('PROFILE_MISSING', context, `custom profile "${id}" is unavailable`)
      const current = profiles[index]!
      if (customProfileFingerprint(current) !== baselineFingerprint) {
        throw this.failure('NOT_APPLIED', context, `custom profile "${id}" changed before it could be reset`)
      }
      const standard = standardProfile
      const replacement = {
        id: current.id,
        ...(current.name !== undefined ? { name: current.name } : {}),
        bindings: cloneJson(standard.bindings) as unknown as readonly PersistedShortcutBinding[],
      }
      const next = normalizeCustomProfiles(profiles.map((profile, profileIndex) => (
        profileIndex === index ? replacement : profile
      )))
      const expected = next[index]!
      const readBack = await this.write('customProfiles', next, snapshot.revision, context)
      if (readBack === undefined) return
      const saved = this.readCustomProfiles(readBack).find(profile => profile.id === id)
      if (saved === undefined || customProfileFingerprint(saved) !== customProfileFingerprint(expected)) {
        throw this.failure('NOT_APPLIED', context, `custom profile "${id}" was not reset`)
      }
      this.publishSuccess(generation)
    })
  }
  deleteCustomProfile(id: string): Promise<void> {
    return this.enqueue('delete', async generation => {
      const selectionContext = { operation: 'delete', phase: 'selection', profileId: id } as const
      let snapshot = this.prepareWritable(selectionContext)
      let profiles = this.readCustomProfiles(snapshot)
      if (profiles.every(profile => profile.id !== id)) {
        throw this.failure('PROFILE_MISSING', {
          operation: 'delete', phase: 'collection', profileId: id,
        }, `custom profile "${id}" is unavailable`)
      }

      let selectionChanged = false
      if (snapshot.value?.activeProfile === id) {
        const readBack = await this.write(
          'activeProfile', DEFAULT_SHORTCUT_PROFILE_ID, snapshot.revision, selectionContext,
        )
        if (readBack === undefined) return
        if (!this.activePredicate(readBack, DEFAULT_SHORTCUT_PROFILE_ID)) {
          throw this.failure('NOT_APPLIED', selectionContext, `active shortcut profile was not changed to "${DEFAULT_SHORTCUT_PROFILE_ID}"`)
        }
        selectionChanged = true
        if (this.disposed) return
        snapshot = readBack
        profiles = this.readCustomProfiles(snapshot)
        if (profiles.every(profile => profile.id !== id)) {
          this.publishSuccess(generation)
          return
        }
        if (snapshot.value?.activeProfile === id) {
          throw this.failure('NOT_APPLIED', {
            operation: 'delete', phase: 'collection', profileId: id, partial: 'selection-changed',
          }, `custom profile "${id}" became active before it could be deleted`)
        }
      }

      const context: FailureContext = {
        operation: 'delete', phase: 'collection', profileId: id,
        ...(selectionChanged ? { partial: 'selection-changed' as const } : {}),
      }
      const next = profiles.filter(profile => profile.id !== id)
      const readBack = await this.write('customProfiles', next, snapshot.revision, context)
      if (readBack === undefined) return
      const remaining = this.readCustomProfiles(readBack)
      if (remaining.some(profile => profile.id === id) || readBack.value?.activeProfile === id) {
        throw this.failure('NOT_APPLIED', context, `custom profile "${id}" was not deleted`)
      }
      this.publishSuccess(generation)
    })
  }

  exportActiveCustomProfile(): PortableCustomProfile {
    const snapshot = this.authoritative
    if (snapshot.status !== 'ready') {
      throw this.failure('UNAVAILABLE', { operation: 'export', phase: 'selection' }, 'shortcut settings are unavailable')
    }
    const profile = this.readCustomProfiles(snapshot).find(entry => entry.id === snapshot.value?.activeProfile)
    if (profile === undefined || profile.name === undefined) {
      throw this.failure(
        'PROFILE_MISSING',
        { operation: 'export', phase: 'selection', profileId: snapshot.value?.activeProfile },
        'the active custom shortcut profile is unavailable',
      )
    }
    return { name: profile.name, bindings: cloneJson(profile.bindings) }
  }

  setActiveProfile(id: string): Promise<void> {
    return this.enqueue('select', async generation => {
      const context = { operation: 'select', phase: 'selection', profileId: id } as const
      const snapshot = this.prepareWritable(context)
      if (this.registry.get(id) === undefined) {
        throw this.failure('PROFILE_MISSING', context, `unknown shortcut profile: ${id}`)
      }
      if (id === this.currentId) {
        this.publishSuccess(generation)
        return
      }
      const readBack = await this.write('activeProfile', id, snapshot.revision, context)
      if (readBack === undefined) return
      if (!this.activePredicate(readBack, id)) {
        throw this.failure('NOT_APPLIED', context, `active shortcut profile was not changed to "${id}"`)
      }
      this.publishSuccess(generation)
    })
  }

  error(): ShortcutSettingsFailure | undefined { return this.lastError }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.pendingScopeChange = false
    this.disposeScope()
    this.listeners.clear()
  }

  private enqueue<T>(operation: ShortcutSettingsOperation, task: (generation: number) => Promise<T>): Promise<T> {
    if (this.disposed) return Promise.resolve(undefined as T)
    const generation = ++this.operationGeneration
    const result = this.operationTail.then(async () => {
      if (this.disposed) return undefined as T
      try {
        return await task(generation)
      } catch (error) {
        const failure = error instanceof ShortcutSettingsOperationError
          ? error
          : this.failure('NOT_APPLIED', { operation, phase: defaultPhase(operation) }, errorMessage(error))
        this.publishFailure(failure, generation)
        throw failure
      }
    })
    this.operationTail = result.then(() => undefined, () => undefined)
    return result
  }

  private prepareWritable(context: FailureContext): ReadyShortcutSettingsSnapshot {
    this.mergeMirror(false)
    if (!isReadySnapshot(this.authoritative) || this.authoritative.writable !== true || this.recoveryRevision !== undefined) {
      throw this.failure('UNAVAILABLE', context, 'shortcut settings are unavailable')
    }
    return this.authoritative
  }

  private existingProfileIds(customProfiles: readonly PersistedCustomShortcutProfile[]): ReadonlySet<string> {
    const ids = new Set(this.registry.list().filter(profile => !this.registry.customProfiles().some(custom => custom.id === profile.id)).map(profile => profile.id))
    for (const profile of customProfiles) ids.add(profile.id)
    return ids
  }

  private createProfileId(operation: 'create' | 'import', existingIds: ReadonlySet<string>): string {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      let generated: string
      try {
        generated = this.options.createId()
      } catch (error) {
        throw this.failure('ID_UNAVAILABLE', { operation, phase: 'id' }, errorMessage(error))
      }
      if (typeof generated !== 'string' || generated.trim() === '') {
        throw this.failure('ID_UNAVAILABLE', { operation, phase: 'id' }, 'custom profile id generation is unavailable')
      }
      const candidate = `custom-${generated}`
      if (!existingIds.has(candidate)) return candidate
    }
    throw this.failure('ID_COLLISION', { operation, phase: 'id' }, 'could not allocate a unique custom profile id')
  }

  private async selectAfterCreate(id: string, operation: 'create' | 'import', expectedRevision: number): Promise<void> {
    const context = {
      operation, phase: 'selection', profileId: id, partial: 'profile-saved',
    } as const
    const readBack = await this.write('activeProfile', id, expectedRevision, context)
    if (readBack === undefined) return
    if (!this.activePredicate(readBack, id)) {
      throw this.failure('NOT_APPLIED', context, `saved custom profile "${id}" was not selected`)
    }
  }

  private async write(
    field: 'customProfiles' | 'activeProfile',
    value: unknown,
    expectedRevision: number,
    context: FailureContext,
  ): Promise<ReadyShortcutSettingsSnapshot | undefined> {
    this.writeInFlight = true
    let result
    try {
      result = await this.mutate({ field, value: cloneJson(value), expectedRevision })
    } finally {
      this.writeInFlight = false
    }
    if (this.disposed) return undefined
    if (!result.ok) {
      if (result.kind === 'conflict') {
        this.recoveryRevision = result.actualRevision ?? expectedRevision + 1
        this.recoveryRequiresNewer = false
      } else if (result.kind === 'transport') {
        this.recoveryRevision = this.authoritative.revision ?? expectedRevision
        this.recoveryRequiresNewer = true
      }
      this.flushPendingScopeChange()
      throw this.failure('NOT_APPLIED', context, result.message)
    }
    this.acceptMutationView(result.view)
    this.flushPendingScopeChange()
    if (!isReadySnapshot(this.authoritative)) return undefined
    return this.authoritative
  }

  private acceptMutationView(view: ShortcutSettingsMutationView): void {
    const currentRevision = this.authoritative.revision ?? -1
    if (this.disposed || view.revision < currentRevision) return
    this.authoritative = {
      status: 'ready',
      value: cloneJson(view.value) as ShortcutSettings,
      base: cloneJson(view.base) as ShortcutSettings | undefined,
      user: cloneJson(view.user) as ShortcutSettings | undefined,
      revision: view.revision,
      writable: this.scope.getSnapshot().writable,
      mode: 'host',
    }
    this.recoveryRevision = undefined
    this.recoveryRequiresNewer = false
    this.rebuild(this.authoritative)
  }

  private activePredicate(snapshot: SettingsScopeSnapshot<ShortcutSettings>, id: string): boolean {
    return snapshot.status === 'ready'
      && snapshot.value?.activeProfile === id
      && this.registry.get(id) !== undefined
  }

  private onScopeChanged(): void {
    if (this.disposed) return
    if (this.writeInFlight) {
      this.pendingScopeChange = true
      return
    }
    this.mergeMirror(true)
  }

  private flushPendingScopeChange(): void {
    if (this.disposed || !this.pendingScopeChange) return
    this.pendingScopeChange = false
    this.mergeMirror(false)
    if (!this.disposed) this.notify()
  }

  private mergeMirror(notify: boolean): void {
    const snapshot = this.scope.getSnapshot()
    if (!isReadySnapshot(snapshot)) {
      this.authoritative = cloneSnapshot(snapshot)
      this.rebuild(this.authoritative)
      if (notify) this.notify()
      return
    }
    const currentRevision = this.authoritative.revision ?? -1
    const catchesRecovery = this.recoveryRevision !== undefined && (
      this.recoveryRequiresNewer
        ? snapshot.revision > this.recoveryRevision
        : snapshot.revision >= this.recoveryRevision
    )
    if (snapshot.revision > currentRevision || catchesRecovery) {
      this.authoritative = cloneSnapshot(snapshot)
      if (catchesRecovery) {
        this.recoveryRevision = undefined
        this.recoveryRequiresNewer = false
      }
      this.rebuild(this.authoritative)
    } else if (snapshot.revision === currentRevision) {
      this.authoritative = cloneSnapshot(snapshot)
      this.rebuild(this.authoritative)
    }
    if (notify) this.notify()
  }

  private rebuild(snapshot: SettingsScopeSnapshot<ShortcutSettings>): void {
    if (snapshot.status !== 'ready') {
      this.ready = false
      this.canWrite = false
      this.registry.replaceCustomProfiles([])
      this.registry.setActive(DEFAULT_SHORTCUT_PROFILE_ID)
      const standard = this.registry.get(DEFAULT_SHORTCUT_PROFILE_ID)
      this.managedProfiles = Object.freeze(standard === undefined ? [] : [managedBuiltin(standard)])
      this.currentId = DEFAULT_SHORTCUT_PROFILE_ID
      return
    }

    this.ready = true
    this.canWrite = snapshot.writable === true
    const customProfiles = this.readCustomProfiles(snapshot)
    this.registry.replaceCustomProfiles(customProfiles)
    const requestedId = snapshot.value?.activeProfile
    const activeId = typeof requestedId === 'string' && this.registry.get(requestedId) !== undefined
      ? requestedId
      : DEFAULT_SHORTCUT_PROFILE_ID
    this.registry.setActive(activeId)
    this.currentId = activeId
    const customById = new Map(customProfiles.map(profile => [profile.id, profile]))
    this.managedProfiles = Object.freeze(this.registry.list().map(profile => {
      const persisted = customById.get(profile.id)
      if (persisted === undefined) return managedBuiltin(profile)
      return Object.freeze({
        ...profile,
        kind: 'custom' as const,
        displayName: persisted.name ?? this.options.legacyName(),
        ...(persisted.name !== undefined ? { persistedName: persisted.name } : {}),
        fingerprint: customProfileFingerprint(persisted),
      })
    }))
  }

  private readCustomProfiles(snapshot: SettingsScopeSnapshot<ShortcutSettings>): readonly PersistedCustomShortcutProfile[] {
    if (snapshot.status !== 'ready') return []
    const value = snapshot.value
    if (value?.customProfiles !== undefined) {
      try { return normalizeCustomProfiles(value.customProfiles) } catch { return [] }
    }
    const standard = this.registry.get(DEFAULT_SHORTCUT_PROFILE_ID)
    try {
      return normalizeCustomProfiles([{
        id: LEGACY_CUSTOM_PROFILE_ID,
        bindings: value?.customBindings ?? standard?.bindings ?? [],
      }])
    } catch {
      if (standard === undefined) return []
      return normalizeCustomProfiles([{
        id: LEGACY_CUSTOM_PROFILE_ID,
        bindings: standard.bindings as unknown as readonly PersistedShortcutBinding[],
      }])
    }
  }

  private publishSuccess(generation: number): void {
    if (this.disposed || generation !== this.operationGeneration) return
    this.lastError = undefined
    this.notify()
  }

  private publishFailure(failure: ShortcutSettingsOperationError, generation: number): void {
    if (this.disposed || generation !== this.operationGeneration) return
    this.lastError = failure
    this.notify()
  }

  private failure(code: ShortcutSettingsErrorCode, context: FailureContext, message: string): ShortcutSettingsOperationError {
    return new ShortcutSettingsOperationError(
      code, context.operation, context.phase, message, context.profileId, context.partial,
    )
  }

  private notify(): void {
    for (const listener of [...this.listeners]) listener()
  }
}

interface ReadyShortcutSettingsSnapshot extends SettingsScopeSnapshot<ShortcutSettings> {
  readonly status: 'ready'
  readonly revision: number
}

function isReadySnapshot(
  snapshot: SettingsScopeSnapshot<ShortcutSettings>,
): snapshot is ReadyShortcutSettingsSnapshot {
  return snapshot.status === 'ready' && typeof snapshot.revision === 'number'
}

function managedBuiltin(profile: ReturnType<ShortcutProfileRegistry['active']>): ManagedShortcutProfile {
  return Object.freeze({
    ...profile,
    kind: 'builtin' as const,
    displayName: profile.label,
    fingerprint: `builtin:${profile.id}`,
  })
}

function defaultPhase(operation: ShortcutSettingsOperation): ShortcutSettingsFailure['phase'] {
  return operation === 'select' ? 'selection' : 'collection'
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function cloneSnapshot(snapshot: SettingsScopeSnapshot<ShortcutSettings>): SettingsScopeSnapshot<ShortcutSettings> {
  return {
    ...snapshot,
    value: cloneJson(snapshot.value),
    base: cloneJson(snapshot.base),
    user: cloneJson(snapshot.user),
  }
}

function cloneJson<T>(value: T): T {
  if (Array.isArray(value)) return value.map(cloneJson) as T
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, cloneJson(child)])) as T
  }
  return value
}

export function createShortcutSettingsController(
  scope: SettingsScope<ShortcutSettings>,
  registry: ShortcutProfileRegistry,
  mutate: MutateShortcutSettings,
  options: ShortcutSettingsControllerOptions,
): ShortcutSettingsController {
  return new ShortcutSettingsController(scope, registry, mutate, options)
}
