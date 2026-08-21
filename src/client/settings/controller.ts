import type { SettingsScope, SettingsScopeSnapshot } from '@deepseek-ai/dsh-client-runtime/client'
import type { ShortcutSettings } from '../../settings.js'
import type { ShortcutBinding } from '../contract/profile.js'
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
  private currentId: string
  private lastError: string | undefined
  private disposed = false

  constructor(
    private readonly scope: SettingsScope<ShortcutSettings>,
    private readonly registry: ShortcutProfileRegistry,
  ) {
    const snapshot = scope.getSnapshot()
    this.currentId = this.readPersistedId(snapshot) ?? registry.active().id
    registry.setActive(this.currentId)
    if (snapshot.value?.customBindings !== undefined) {
      try { registry.replaceCustom(snapshot.value.customBindings) } catch { /* invalid persisted custom data falls back to standard */ }
    }
    this.disposeScope = scope.subscribe(() => this.onScopeChanged())
  }

  activeProfileId(): string { return this.currentId }

  customBindings(): readonly ShortcutBinding[] { return this.registry.custom() }

  async setCustomBindings(bindings: readonly ShortcutBinding[]): Promise<void> {
    if (this.disposed) return
    try {
      await this.scope.set('customBindings', bindings)
      if (this.disposed) return
      this.registry.replaceCustom(bindings)
      this.lastError = undefined
      this.notify()
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error)
      this.notify()
      throw error
    }
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
      // The registry is deliberately untouched until persistence settles.
      this.lastError = error instanceof Error ? error.message : String(error)
      this.notify()
      throw error
    }
    if (this.disposed) return
    try {
      this.registry.setActive(id)
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error)
      this.notify()
      throw error
    }
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
    const id = this.readPersistedId(this.scope.getSnapshot())
    if (id === undefined || id === this.currentId || this.registry.get(id) === undefined) return
    try {
      this.registry.setActive(id)
      this.currentId = id
      this.lastError = undefined
      this.notify()
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error)
      this.notify()
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

export function createShortcutSettingsController(
  scope: SettingsScope<ShortcutSettings>,
  registry: ShortcutProfileRegistry,
): ShortcutSettingsController {
  return new ShortcutSettingsController(scope, registry)
}
