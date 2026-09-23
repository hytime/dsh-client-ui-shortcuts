import type { SettingsScope, SettingsScopeSnapshot, WorkspaceId } from './versioned-types.js'
import type {
  MutateShortcutSettings,
  ShortcutSettingsMutationResult,
  ShortcutSettingsMutationView,
} from './contract/settings.js'
import { SHORTCUTS_SETTINGS_NAMESPACE } from '../settings-namespace.js'

/**
 * Where a running composition accepts this plugin's Plugins-page configuration
 * card. `bundle-config` is DSH 0.1.6 and later: a bundle's own configuration,
 * keyed by package name and rendered on that bundle's detail page between its
 * description and its rows. `namespace-item` is every earlier supported
 * generation: a plugin card keyed by the settings namespace it edits, inside
 * the Plugins section's configurable tab.
 */
export type PluginSettingsCardSeat =
  | { readonly generation: 'bundle-config'; readonly slot: 'plugins.bundle.config'; readonly key: string }
  | { readonly generation: 'namespace-item'; readonly slot: 'settings.plugin.item'; readonly key: string }

/** The two cardinal keys a Plugins page can file this plugin's card under. */
export interface PluginSettingsCardIdentity {
  /** Package name the bundle-config generation keys a bundle's configuration by. */
  readonly bundleKey: string
  /** Settings namespace the namespace-item generation keys a plugin card by. */
  readonly namespaceKey: string
}

/** Runtime capabilities exposed to the rest of the browser plugin. */
export interface DshCompatibility {
  /** Bind the settings namespace through the current or legacy DSH service. */
  readonly bindSettingsScope: <T>(namespace: string) => SettingsScope<T> | undefined
  readonly mutateSettings: MutateShortcutSettings
  readonly startSession?: (workspaceId?: WorkspaceId) => void
  readonly isInteractionPending: () => boolean
  /** Mount the Plugins-page card on whichever seat this composition declares. */
  readonly mountPluginSettingsCard: (
    identity: PluginSettingsCardIdentity,
    mount: (seat: PluginSettingsCardSeat) => () => void,
  ) => () => void
}

type ServiceGetter = (name: string) => unknown
type SlotInjectionEffect = () => void
type ConfigFormService = {
  readonly get?: <T>(namespace: string) => ConfigForm<T>
}
type ConfigForm<T> = {
  readonly getSnapshot: () => SettingsScopeSnapshot<T>
  readonly subscribe: (listener: () => void) => () => void
  readonly set: (field: string, value: unknown) => Promise<unknown>
  readonly unset: (field: string) => Promise<unknown>
}
type LegacySettingsScopeService = {
  readonly bind?: <T>(spec: { readonly namespace: string }) => SettingsScope<T>
}
type SlotInjectionService = {
  readonly inject?: (key: string, callback: () => SlotInjectionEffect) => () => void
}
type SettingsOperation = readonly [{
  readonly op: 'set'
  readonly path: readonly [string]
  readonly value: unknown
}]
type CurrentSettingsService = {
  readonly mutate?: (namespace: string, ops: SettingsOperation, expectedRevision: number) => Promise<unknown>
}
type LegacySettingsService = {
  readonly api?: {
    readonly settings?: {
      readonly mutate?: (request: {
        readonly ns: string
        readonly ops: SettingsOperation
        readonly expectedRevision: number
      }) => Promise<unknown>
    }
  }
}
type SessionListService = {
  readonly list?: {
    readonly getSnapshot?: () => unknown
  }
}
type PendingInteractionService = {
  readonly pendingInteractions?: {
    readonly getSnapshot?: () => unknown
  }
}

/** Create a compatibility face by probing the services available in one DSH composition. */
export function createDshCompatibility(get: ServiceGetter): DshCompatibility {
  const mutateSettings: MutateShortcutSettings = async request => {
    const currentSettings = get('remote.settings') as CurrentSettingsService | undefined
    const connection = get('connection') as LegacySettingsService | undefined
    const currentMutate = typeof currentSettings?.mutate === 'function' ? currentSettings.mutate : undefined
    const legacyMutate = typeof connection?.api?.settings?.mutate === 'function'
      ? connection.api.settings.mutate
      : undefined
    if (currentMutate !== undefined) return createCurrentMutation(currentMutate)(request)
    if (legacyMutate !== undefined) return createLegacyMutation(legacyMutate)(request)
    return unavailableMutation(request)
  }

  const uiWorkspace = get('uiWorkspace') as { readonly startSession?: (workspaceId?: WorkspaceId) => void } | undefined
  const workspaces = get('workspaces') as { readonly startSession?: (workspaceId?: WorkspaceId) => void } | undefined
  const startSession = uiWorkspace?.startSession !== undefined
    ? (workspaceId?: WorkspaceId) => { uiWorkspace.startSession?.(workspaceId) }
    : workspaces?.startSession !== undefined
      ? (workspaceId?: WorkspaceId) => { workspaces.startSession?.(workspaceId) }
      : undefined

  const uiSession = get('uiSession') as PendingInteractionService | undefined
  const sessions = get('sessions') as SessionListService | undefined
  const currentPending = uiSession?.pendingInteractions?.getSnapshot
  const legacySnapshot = sessions?.list?.getSnapshot
  return {
    bindSettingsScope: createSettingsScopeBinder(get),
    mutateSettings,
    ...(startSession === undefined ? {} : { startSession }),
    isInteractionPending: () => readPending(currentPending, legacySnapshot),
    mountPluginSettingsCard: createPluginSettingsCardMounter(get),
  }
}

/** Prefer DSH 0.1.7's shared ConfigForms service and retain the prior binder as fallback. */
function createSettingsScopeBinder(get: ServiceGetter): DshCompatibility['bindSettingsScope'] {
  return <T>(namespace: string): SettingsScope<T> | undefined => {
    const configForms = get('configForms') as ConfigFormService | undefined
    if (typeof configForms?.get === 'function') {
      return adaptConfigForm(configForms.get<T>(namespace))
    }
    const legacy = get('settingsScope') as LegacySettingsScopeService | undefined
    if (typeof legacy?.bind === 'function') return legacy.bind<T>({ namespace })
    return undefined
  }
}

function adaptConfigForm<T>(form: ConfigForm<T>): SettingsScope<T> {
  return {
    getSnapshot: () => form.getSnapshot(),
    subscribe: listener => form.subscribe(listener),
    set: async (field, value) => { await form.set(field, value) },
    unset: async field => { await form.unset(field) },
  }
}

/** Safe settings face for compositions that omit the optional settings provider. */
export function createUnavailableSettingsScope<T>(): SettingsScope<T> {
  const snapshot: SettingsScopeSnapshot<T> = {
    status: 'unavailable',
    value: undefined,
    base: undefined,
    user: undefined,
    revision: undefined,
    writable: false,
    mode: 'memory',
  }
  return {
    getSnapshot: () => snapshot,
    subscribe: () => () => {},
    set: async () => {},
    unset: async () => {},
  }
}

/**
 * Mount the plugin's configuration card on the first seat this composition
 * declares. DSH moved the surface in 0.1.6 — `settings.plugin.item`, keyed by
 * settings namespace, became `plugins.bundle.config`, keyed by bundle package —
 * and both are injected so one source tree serves every supported generation.
 * The injection itself is the capability probe: registering into a slot that is
 * never declared cannot fail here, because `inject` runs its callback only once
 * the declaring entry is mounted (and re-runs it when that owner remounts).
 * Ordering decides a composition that declares both, so exactly one card mounts.
 */
function createPluginSettingsCardMounter(
  get: ServiceGetter,
): DshCompatibility['mountPluginSettingsCard'] {
  return (identity, mount) => {
    const slots = get('slots') as SlotInjectionService | undefined
    const inject = slots?.inject
    if (typeof inject !== 'function') return () => {}
    const seats: readonly PluginSettingsCardSeat[] = [
      { generation: 'bundle-config', slot: 'plugins.bundle.config', key: identity.bundleKey },
      { generation: 'namespace-item', slot: 'settings.plugin.item', key: identity.namespaceKey },
    ]
    let mounted: SlotInjectionEffect | undefined
    const injections = seats.map(seat => inject.call(slots, seat.slot, () => {
      if (mounted !== undefined) return () => {}
      const dispose = mount(seat)
      mounted = dispose
      return () => {
        if (mounted !== dispose) return
        mounted = undefined
        dispose()
      }
    }))
    return () => { for (const off of injections) off() }
  }
}

function createCurrentMutation(
  mutate: NonNullable<CurrentSettingsService['mutate']>,
): MutateShortcutSettings {
  return async request => {
    try {
      const response = await mutate(
        SHORTCUTS_SETTINGS_NAMESPACE,
        [{ op: 'set', path: [request.field], value: request.value }],
        request.expectedRevision,
      )
      return normalizeMutationResponse(response)
    } catch (error) {
      return transportFailure(error)
    }
  }
}

function createLegacyMutation(
  mutate: NonNullable<NonNullable<NonNullable<LegacySettingsService['api']>['settings']>['mutate']>,
): MutateShortcutSettings {
  return async request => {
    try {
      const response = await mutate({
        ns: SHORTCUTS_SETTINGS_NAMESPACE,
        ops: [{ op: 'set', path: [request.field], value: request.value }],
        expectedRevision: request.expectedRevision,
      })
      return normalizeMutationResponse(response)
    } catch (error) {
      return transportFailure(error)
    }
  }
}

const unavailableMutation: MutateShortcutSettings = async () => ({
  ok: false,
  kind: 'transport',
  message: 'settings mutation unavailable',
})

function normalizeMutationResponse(response: unknown): ShortcutSettingsMutationResult {
  const result = isRecord(response) && isRecord(response.result) ? response.result : response
  if (isRecord(result) && result.ok === true) {
    return { ok: true, view: result.value as ShortcutSettingsMutationView }
  }
  const error = isRecord(result) && isRecord(result.error) ? result.error : undefined
  const code = error?.code
  const message = typeof error?.message === 'string' ? error.message : 'settings mutation rejected'
  const actualRevision = numericConflictRevision(error?.details)
  return {
    ok: false,
    kind: code === 'settings-conflict' ? 'conflict' : 'rejected',
    message,
    ...(actualRevision === undefined ? {} : { actualRevision }),
  }
}

function transportFailure(error: unknown): ShortcutSettingsMutationResult {
  return {
    ok: false,
    kind: 'transport',
    message: error instanceof Error ? error.message : String(error),
  }
}

function numericConflictRevision(details: unknown): number | undefined {
  if (!isRecord(details) || Array.isArray(details)) return undefined
  const actual = Reflect.get(details, 'actual')
  return typeof actual === 'number' && Number.isFinite(actual) ? actual : undefined
}

function readPending(
  currentSnapshot: (() => unknown) | undefined,
  legacySnapshot: (() => unknown) | undefined,
): boolean {
  const current = legacyCurrentSession(legacySnapshot)
  if (current === undefined) return false
  if (currentSnapshot !== undefined) {
    const snapshot = currentSnapshot()
    if (isMapLike(snapshot)) return snapshot.get(current) !== undefined
    return false
  }
  const snapshot = legacySnapshot?.()
  if (!isRecord(snapshot) || !isRecord(snapshot.byId)) return false
  const summary = Reflect.get(snapshot.byId, current)
  return isRecord(summary) && Reflect.get(summary, 'pendingInteraction') !== undefined
}

function legacyCurrentSession(snapshotGetter: (() => unknown) | undefined): string | undefined {
  const snapshot = snapshotGetter?.()
  if (!isRecord(snapshot)) return undefined
  const current = Reflect.get(snapshot, 'current')
  return typeof current === 'string' ? current : undefined
}

function isMapLike(value: unknown): value is { get(key: string): unknown } {
  return isRecord(value) && typeof Reflect.get(value, 'get') === 'function'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
