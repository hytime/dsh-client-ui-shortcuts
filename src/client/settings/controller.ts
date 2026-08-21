import type { SettingsScope, SettingsScopeSnapshot } from '@deepseek-ai/dsh-client-runtime/client'
import type { PersistedShortcutBinding, ShortcutSettings } from '../../settings.js'
import type { ShortcutBinding } from '../contract/profile.js'
import { validateShortcutBindings } from '../profiles/registry.js'
import type { ShortcutProfileRegistry } from '../profiles/types.js'

/** Public settings face consumed by settings cards and keyboard components. */
export interface ShortcutSettingsFace {
  readonly activeProfileId: () => string
  readonly subscribe: (listener: () => void) => () => void
  readonly setActiveProfile: (id: string) => Promise<void>
  readonly customBindings: () => readonly ShortcutBinding[]
  readonly setCustomBindings: (bindings: readonly ShortcutBinding[]) => Promise<void>
  readonly error: () => string | undefined
}

/** Controller joining the durable settings scope to the isolated profile registry. */
export class ShortcutSettingsController implements ShortcutSettingsFace {
  private readonly listeners = new Set<() => void>()
  private readonly disposeScope: () => void
  private customWriteTail: Promise<void> = Promise.resolve()
  private currentId: string
  private lastError: string | undefined
  private disposed = false
  private customGeneration = 0

  constructor(
    private readonly scope: SettingsScope<ShortcutSettings>,
    private readonly registry: ShortcutProfileRegistry,
  ) {
    const snapshot = scope.getSnapshot()
    this.loadCustom(snapshot)
    this.currentId = this.readPersistedId(snapshot) ?? registry.active().id
    registry.setActive(this.currentId)
    this.disposeScope = scope.subscribe(() => this.onScopeChanged())
  }

  activeProfileId(): string { return this.currentId }

  customBindings(): readonly ShortcutBinding[] { return this.registry.custom() }

  async setCustomBindings(bindings: readonly ShortcutBinding[]): Promise<void> {
    if (this.disposed) return
    const normalized = validateShortcutBindings(bindings)
    const persisted = clonePersistedBindings(normalized as unknown as readonly PersistedShortcutBinding[])
    const generation = ++this.customGeneration
    const previous = this.customWriteTail
    const operation = previous.then(async () => {
      if (this.disposed) return
      try {
        // An in-flight scope.set may finish after dispose; persistence is allowed, but publication is suppressed.
        await this.scope.set('customBindings', persisted)
        if (this.disposed || generation !== this.customGeneration) return
        this.registry.replaceCustom(normalized)
        this.lastError = undefined
        this.notify()
      } catch (error) {
        if (generation === this.customGeneration) {
          this.lastError = error instanceof Error ? error.message : String(error)
          this.notify()
        }
        throw error
      }
    })
    this.customWriteTail = operation.catch(() => undefined)
    return operation
  }

  error(): string | undefined { return this.lastError }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  async setActiveProfile(id: string): Promise<void> {
    if (this.disposed) return
    if (this.registry.get(id) === undefined) {
      const error = new Error(`unknown shortcut profile: ${id}`)
      this.lastError = error.message
      this.notify()
      throw error
    }
    const previous = this.currentId
    if (id === previous) return
    try {
      await this.scope.set('activeProfile', id)
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error)
      this.notify()
      throw error
    }
    if (this.disposed) return
    this.registry.setActive(id)
    this.currentId = id
    this.lastError = undefined
    this.notify()
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.disposeScope()
    this.listeners.clear()
  }

  private onScopeChanged(): void {
    if (this.disposed) return
    const snapshot = this.scope.getSnapshot()
    this.loadCustom(snapshot)
    const id = this.readPersistedId(snapshot)
    if (id === undefined || id === this.currentId || this.registry.get(id) === undefined) return
    this.registry.setActive(id)
    this.currentId = id
    this.lastError = undefined
    this.notify()
  }

  private loadCustom(snapshot: SettingsScopeSnapshot<ShortcutSettings>): void {
    const persisted = snapshot.value?.customBindings
    if (persisted === undefined) return
    try {
      this.registry.replaceCustom(persisted as unknown as readonly ShortcutBinding[])
    } catch {
      // Invalid persisted JSON remains visible to Host validation but falls back to standard bindings here.
    }
  }

  private readPersistedId(snapshot: SettingsScopeSnapshot<ShortcutSettings>): string | undefined {
    const id = snapshot.value?.activeProfile
    return typeof id === 'string' && this.registry.get(id) !== undefined ? id : undefined
  }

  private notify(): void {
    for (const listener of [...this.listeners]) listener()
  }
}

function clonePersistedBindings(bindings: readonly PersistedShortcutBinding[]): PersistedShortcutBinding[] {
  return bindings.map(binding => ({
    ...binding,
    ...(binding.key !== undefined ? { key: cloneJsonValue(binding.key) } : {}),
    ...(binding.sequence !== undefined ? { sequence: cloneJsonValue(binding.sequence) } : {}),
    ...(binding.sequences !== undefined ? { sequences: cloneJsonValue(binding.sequences) } : {}),
  }))
}

function cloneJsonValue(value: unknown): any {
  if (Array.isArray(value)) return value.map(cloneJsonValue)
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, cloneJsonValue(child)]))
  }
  return value
}

export function createShortcutSettingsController(
  scope: SettingsScope<ShortcutSettings>,
  registry: ShortcutProfileRegistry,
): ShortcutSettingsController {
  return new ShortcutSettingsController(scope, registry)
}
