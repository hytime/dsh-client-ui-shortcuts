import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import { SettingsProvider, type SettingsNamespace } from '@deepseek-ai/dsh-settings'
import { apply, SHORTCUTS_SETTINGS_NAMESPACE } from '../src/index.js'
import { normalizePersistedShortcutResult, validatePersistedShortcutBindings } from '../src/settings-validation.js'
import { defaultShortcutBindings } from '../src/settings.js'
import type { ShortcutSettings } from '../src/settings.js'

interface MemorySettingsConfig {
  doc?: Record<string, unknown>
  failPersistCount?: number
}

class MemorySettings extends SettingsProvider {
  readonly persisted: Array<{ ns: SettingsNamespace; section: Record<string, unknown> }> = []
  private doc: Record<string, unknown>
  private failures: number

  constructor(ctx: Context, config: MemorySettingsConfig = {}) {
    super(ctx)
    this.doc = structuredClone(config.doc ?? {})
    this.failures = config.failPersistCount ?? 0
  }

  get writable(): boolean { return true }

  protected load(): Promise<Record<string, unknown>> {
    return Promise.resolve(structuredClone(this.doc))
  }

  publishExternal(doc: Record<string, unknown>): void {
    this.doc = structuredClone(doc)
    this.publish(structuredClone(doc), 'provider')
  }

  protected persist(ns: SettingsNamespace, section: Record<string, unknown>): Promise<void> {
    if (this.failures > 0) {
      this.failures -= 1
      return Promise.reject(new Error('persist unavailable'))
    }
    this.doc[ns] = structuredClone(section)
    this.persisted.push({ ns, section: structuredClone(section) })
    return Promise.resolve()
  }
}

const flushSettingsMigration = async (): Promise<void> => {
  await new Promise<void>(resolve => setTimeout(resolve, 0))
}

const validCustomBinding = {
  command: 'openSettings' as const,
  scope: 'global' as const,
  key: { key: 's', modifiers: ['Meta'] as const },
}

describe('shortcut Host settings', () => {
  it('returns owned fresh default binding copies', () => {
    const first = defaultShortcutBindings()
    const second = defaultShortcutBindings()
    expect(first).not.toBe(second)
    expect(first[0]).not.toBe(second[0])
    expect(first[0]?.key).not.toBe(second[0]?.key)
    expect(first[0]?.key?.modifiers).not.toBe(second[0]?.key?.modifiers)
  })

  it.each([
    ['undefined', undefined],
    ['function', () => undefined],
    ['symbol', Symbol('invalid')],
    ['bigint', 1n],
    ['infinite number', Infinity],
    ['date object', new Date()],
  ])('rejects non-JSON value: %s', async (_label, value) => {
    expect(() => validatePersistedShortcutBindings([{
      command: 'openSettings', scope: 'global', key: { key: 's', modifiers: ['Mod', 'Alt'], invalid: value },
    }])).toThrow()
  })

  it('documents nested undefined loss during Schemastery settings resolution', async () => {
    const ctx = new Context()
    await ctx.plugin(MemorySettings).await()
    const fiber = ctx.plugin({ apply })
    await fiber.await()

    await expect(ctx.settings.update(SHORTCUTS_SETTINGS_NAMESPACE, {
      activeProfile: 'standard',
      customBindings: [{ command: 'openSettings', scope: 'global', key: { key: 's', modifiers: ['Mod'], invalid: undefined } }],
    })).resolves.toBeUndefined()
    // Schemastery 3.18.1 strips nested undefined before the provider validate callback.
    await fiber.dispose()
  })

  it.each([
    ['function', () => undefined],
    ['symbol', Symbol('invalid')],
    ['bigint', 1n],
    ['infinite number', Infinity],
    ['date object', new Date()],
  ])('rejects non-JSON value through settings update: %s', async (_label, value) => {
    const ctx = new Context()
    await ctx.plugin(MemorySettings).await()
    const fiber = ctx.plugin({ apply })
    await fiber.await()
    await expect(ctx.settings.update(SHORTCUTS_SETTINGS_NAMESPACE, {
      activeProfile: 'standard',
      customBindings: [{ command: 'openSettings', scope: 'global', key: { key: 's', modifiers: ['Mod'], invalid: value } }],
    })).rejects.toThrow()
    await fiber.dispose()
  })

  it('migrates legacy Mod persisted input to Meta and emits no Mod', () => {
    const result = normalizePersistedShortcutResult([
      { command: 'openSettings', scope: 'global', key: { key: 's', modifiers: ['Mod', 'Alt'] } },
    ])
    expect(result.bindings).toEqual([
      { command: 'openSettings', scope: 'global', key: { key: 's', modifiers: ['Meta', 'Alt'] } },
    ])
  })

  it('migrates legacy customBindings on startup without a user write', async () => {
    const ctx = new Context()
    const providerFiber = ctx.plugin(MemorySettings, { doc: {
      [SHORTCUTS_SETTINGS_NAMESPACE]: { activeProfile: 'custom', customBindings: [validCustomBinding] },
    } })
    await providerFiber.await()
    const provider = providerFiber.ctx.settings as unknown as MemorySettings
    const fiber = ctx.plugin({ apply })
    await fiber.await()
    await flushSettingsMigration()
    expect(provider.persisted).toHaveLength(1)
    expect(provider.persisted[0]?.section).toMatchObject({
      activeProfile: 'custom',
      customProfiles: [{ id: 'custom', bindings: [validCustomBinding] }],
    })
    await flushSettingsMigration()
    expect(provider.persisted).toHaveLength(1)
    await fiber.dispose()
  })

  it('disposes the real provider migration watch with the plugin fiber', async () => {
    const ctx = new Context()
    const providerFiber = ctx.plugin(MemorySettings, { doc: {
      [SHORTCUTS_SETTINGS_NAMESPACE]: {
        activeProfile: 'standard', customBindings: [validCustomBinding], customProfiles: [],
      },
    } })
    await providerFiber.await()
    const provider = providerFiber.ctx.settings as unknown as MemorySettings
    const fiber = ctx.plugin({ apply })
    await fiber.await()
    await fiber.dispose()

    provider.publishExternal({
      [SHORTCUTS_SETTINGS_NAMESPACE]: {
        activeProfile: 'custom', customBindings: [validCustomBinding],
      },
    })
    await flushSettingsMigration()

    expect(provider.persisted).toHaveLength(0)
  })

  it('logs a failed startup migration and retries after a resolved change', async () => {
    const ctx = new Context()
    const warn = vi.fn()
    ctx.logger.warn = warn as never
    const providerFiber = ctx.plugin(MemorySettings, { doc: {
      [SHORTCUTS_SETTINGS_NAMESPACE]: { activeProfile: 'custom', customBindings: [validCustomBinding] },
    }, failPersistCount: 1 })
    await providerFiber.await()
    const provider = providerFiber.ctx.settings as unknown as MemorySettings
    const fiber = ctx.plugin({ apply })
    await fiber.await()
    await flushSettingsMigration()
    const diagnostic = warn.mock.calls.flat().map(String).join(' ')
    expect(diagnostic).toContain(SHORTCUTS_SETTINGS_NAMESPACE)
    expect(diagnostic).toContain('persist unavailable')
    expect(diagnostic).toContain('continuing with legacy projection')
    expect(provider.persisted).toHaveLength(0)
    const settings = ctx.settings.get(SHORTCUTS_SETTINGS_NAMESPACE) as ShortcutSettings
    expect(settings).toMatchObject({
      activeProfile: 'custom', customBindings: [validCustomBinding],
    })
    expect(settings.customProfiles).toBeUndefined()
    await ctx.settings.update(SHORTCUTS_SETTINGS_NAMESPACE, { activeProfile: 'vim' })
    await flushSettingsMigration()
    expect(provider.persisted.at(-1)?.section).toMatchObject({
      activeProfile: 'vim', customProfiles: [{ id: 'custom', bindings: [validCustomBinding] }],
    })
    await fiber.dispose()
  })

  it('retries a failed migration when the plugin restarts', async () => {
    const ctx = new Context()
    const providerFiber = ctx.plugin(MemorySettings, { doc: {
      [SHORTCUTS_SETTINGS_NAMESPACE]: { activeProfile: 'custom', customBindings: [validCustomBinding] },
    }, failPersistCount: 1 })
    await providerFiber.await()
    const first = ctx.plugin({ apply })
    await first.await()
    await flushSettingsMigration()
    await first.dispose()
    const second = ctx.plugin({ apply })
    await second.await()
    await flushSettingsMigration()
    const provider = providerFiber.ctx.settings as unknown as MemorySettings
    expect(provider.persisted.at(-1)?.section).toMatchObject({ customProfiles: [{ id: 'custom' }] })
    await second.dispose()
  })

  it('fails namespace registration for an invalid stored new structure', async () => {
    const ctx = new Context()
    await ctx.plugin(MemorySettings, { doc: {
      [SHORTCUTS_SETTINGS_NAMESPACE]: {
        activeProfile: 'custom-a',
        customBindings: [validCustomBinding],
        customProfiles: [{ id: 'custom-a', name: 'Broken', bindings: [] }],
      },
    } }).await()
    const fiber = ctx.plugin({ apply })
    let failure: unknown
    try {
      await fiber.await()
    } catch (error) {
      failure = error
    }
    expect(failure).toBeInstanceOf(Error)
    expect((failure as Error).message).toContain('bindings')
  })

  it.each([
    ['an explicit empty customProfiles array', []],
    ['the composition base customProfiles array', [{ id: 'custom-a', name: 'Custom A', bindings: [validCustomBinding] }]],
  ])('does not migrate %s', async (_label, customProfiles) => {
    const ctx = new Context()
    const providerFiber = ctx.plugin(MemorySettings, { doc: {
      [SHORTCUTS_SETTINGS_NAMESPACE]: { activeProfile: 'standard', customBindings: [validCustomBinding], customProfiles },
    } })
    await providerFiber.await()
    const provider = providerFiber.ctx.settings as unknown as MemorySettings
    const fiber = ctx.plugin({ apply })
    await fiber.await()
    await flushSettingsMigration()
    expect(provider.persisted).toHaveLength(0)
    expect(ctx.settings.get(SHORTCUTS_SETTINGS_NAMESPACE)).toMatchObject({ customProfiles })
    await fiber.dispose()
  })

  it.each([
    ['null customProfiles', null, 'customProfiles'],
    ['non-array customProfiles', {}, 'customProfiles'],
    ['duplicate profile IDs', [
      { id: 'custom-a', name: 'Custom A', bindings: [validCustomBinding] },
      { id: 'custom-a', name: 'Custom B', bindings: [validCustomBinding] },
    ], 'duplicate custom profile id'],
    ['reserved profile ID', [{ id: 'vim', name: 'Custom Vim', bindings: [validCustomBinding] }], 'reserved custom profile id'],
    ['duplicate profile names', [
      { id: 'custom-a', name: 'Custom', bindings: [validCustomBinding] },
      { id: 'custom-b', name: 'Custom', bindings: [validCustomBinding] },
    ], 'duplicate custom profile name'],
    ['empty bindings', [{ id: 'custom-a', name: 'Custom A', bindings: [] }], 'bindings'],
  ])('rejects %s in the new structure', async (_label, customProfiles, diagnostic) => {
    const ctx = new Context()
    await ctx.plugin(MemorySettings).await()
    const fiber = ctx.plugin({ apply })
    await fiber.await()
    await expect(ctx.settings.update(SHORTCUTS_SETTINGS_NAMESPACE, {
      activeProfile: 'standard',
      customProfiles,
    })).rejects.toThrow(diagnostic)
    await fiber.dispose()
  })

  it('rejects an unknown active profile against the new structure', async () => {
    const ctx = new Context()
    await ctx.plugin(MemorySettings).await()
    const fiber = ctx.plugin({ apply })
    await fiber.await()
    await expect(ctx.settings.update(SHORTCUTS_SETTINGS_NAMESPACE, {
      activeProfile: 'custom-missing',
      customProfiles: [{ id: 'custom-a', name: 'Custom A', bindings: [validCustomBinding] }],
    })).rejects.toThrow('unknown shortcut profile')
    await fiber.dispose()
  })

  it('accepts legacy activeProfile custom while customProfiles is absent', async () => {
    const ctx = new Context()
    await ctx.plugin(MemorySettings).await()
    const fiber = ctx.plugin({ apply })
    await fiber.await()
    await expect(ctx.settings.update(SHORTCUTS_SETTINGS_NAMESPACE, {
      activeProfile: 'custom',
      customBindings: [validCustomBinding],
    })).resolves.toBeUndefined()
    await fiber.dispose()
  })

  it('persists migrated Meta bindings and keeps them after updates', async () => {
    const ctx = new Context()
    const providerFiber = ctx.plugin(MemorySettings)
    await providerFiber.await()
    const provider = providerFiber.ctx.settings as unknown as MemorySettings
    const fiber = ctx.plugin({ apply })
    await fiber.await()

    await ctx.settings.update(SHORTCUTS_SETTINGS_NAMESPACE, {
      activeProfile: 'standard',
      customBindings: [{ command: 'openSettings', scope: 'global', key: { key: 's', modifiers: ['Mod'] } }],
    })
    await flushSettingsMigration()
    const first = provider.persisted.at(-1)?.section
    expect(first).toMatchObject({ customBindings: [{ key: { modifiers: ['Meta'] } }] })
    expect(JSON.stringify(first)).not.toContain('Mod')
    expect(ctx.settings.get(SHORTCUTS_SETTINGS_NAMESPACE)).toMatchObject({ customBindings: [{ key: { modifiers: ['Meta'] } }] })

    await ctx.settings.update(SHORTCUTS_SETTINGS_NAMESPACE, { activeProfile: 'vim' })
    expect(provider.persisted.at(-1)?.section).toMatchObject({ activeProfile: 'vim', customBindings: [{ key: { modifiers: ['Meta'] } }] })
    await expect(ctx.settings.update(SHORTCUTS_SETTINGS_NAMESPACE, { activeProfile: 'unknown' })).rejects.toThrow('unknown')
    await fiber.dispose()
  })
  it('accepts explicit combinations in custom settings', () => {
    expect(() => validatePersistedShortcutBindings([
      { command: 'openSettings', scope: 'global', key: { key: 's', modifiers: ['Meta', 'Alt'] } },
      { command: 'openCommandPalette', scope: 'global', key: { key: 'p', modifiers: ['Meta', 'Shift'] } },
    ])).not.toThrow()
  })

  it('does not require a settings provider', async () => {
    const ctx = new Context()
    const fiber = ctx.plugin({ apply })

    await expect(fiber.await()).resolves.toBeDefined()
    await fiber.dispose()
  })

  it('defaults customBindings to the standard binding set', async () => {
    const ctx = new Context()
    await ctx.plugin(MemorySettings).await()
    const fiber = ctx.plugin({ apply })
    await fiber.await()

    const settings = ctx.settings.get(SHORTCUTS_SETTINGS_NAMESPACE) as ShortcutSettings | undefined
    expect(settings?.customBindings).toEqual(expect.arrayContaining([
      expect.objectContaining({ command: 'openCommandPalette', scope: 'global' }),
      expect.objectContaining({ command: 'startSession', scope: 'global' }),
    ]))
    expect(settings.customBindings.length).toBeGreaterThan(0)

    await fiber.dispose()
  })

  it('accepts custom profile with legal bindings and persists both values', async () => {
    const ctx = new Context()
    await ctx.plugin(MemorySettings).await()
    const fiber = ctx.plugin({ apply })
    await fiber.await()

    await expect(ctx.settings.update(SHORTCUTS_SETTINGS_NAMESPACE, {
      activeProfile: 'custom',
      customBindings: [validCustomBinding],
    })).resolves.toBeUndefined()
    expect(ctx.settings.get(SHORTCUTS_SETTINGS_NAMESPACE)).toMatchObject({
      activeProfile: 'custom',
      customBindings: [validCustomBinding],
    })

    await fiber.dispose()
  })

  it('accepts legal custom bindings and preserves their JSON shape', async () => {
    const ctx = new Context()
    await ctx.plugin(MemorySettings).await()
    const fiber = ctx.plugin({ apply })
    await fiber.await()

    await expect(ctx.settings.update(SHORTCUTS_SETTINGS_NAMESPACE, {
      activeProfile: 'standard',
      customBindings: [validCustomBinding],
    })).resolves.toBeUndefined()
    expect(ctx.settings.get(SHORTCUTS_SETTINGS_NAMESPACE)).toMatchObject({
      activeProfile: 'standard',
      customBindings: [validCustomBinding],
    })

    await fiber.dispose()
  })

  it.each([
    ['unknown command', { ...validCustomBinding, command: 'missing' }],
    ['unknown scope', { ...validCustomBinding, scope: 'panel' }],
    ['empty key', { ...validCustomBinding, key: { key: '', modifiers: ['Meta'] } }],
    ['same-scope conflict', [validCustomBinding, { ...validCustomBinding, command: 'openCommandPalette' as const }]],
  ])('rejects %s in customBindings', async (_label, customBindings) => {
    const ctx = new Context()
    await ctx.plugin(MemorySettings).await()
    const fiber = ctx.plugin({ apply })
    await fiber.await()

    await expect(ctx.settings.update(SHORTCUTS_SETTINGS_NAMESPACE, {
      activeProfile: 'standard',
      customBindings: Array.isArray(customBindings) ? customBindings : [customBindings],
    })).rejects.toThrow()
    expect((ctx.settings.get(SHORTCUTS_SETTINGS_NAMESPACE) as ShortcutSettings).customBindings.length).toBeGreaterThan(0)

    await fiber.dispose()
  })

  it('migrates Mod with Ctrl in custom settings and persists Meta with Ctrl', async () => {
    const ctx = new Context()
    const providerFiber = ctx.plugin(MemorySettings)
    await providerFiber.await()
    const provider = providerFiber.ctx.settings as unknown as MemorySettings
    const fiber = ctx.plugin({ apply })
    await fiber.await()
    await expect(ctx.settings.update(SHORTCUTS_SETTINGS_NAMESPACE, {
      activeProfile: 'standard',
      customBindings: [{ ...validCustomBinding, key: { key: 's', modifiers: ['Mod', 'Ctrl'] } }],
    })).resolves.toBeUndefined()
    await flushSettingsMigration()
    expect(provider.persisted.at(-1)?.section).toMatchObject({ customBindings: [{ key: { modifiers: ['Ctrl', 'Meta'] } }] })
    expect(JSON.stringify(provider.persisted.at(-1)?.section)).not.toContain('Mod')
    expect(ctx.settings.get(SHORTCUTS_SETTINGS_NAMESPACE)).toMatchObject({ customBindings: [{ key: { modifiers: ['Ctrl', 'Meta'] } }] })
    await fiber.dispose()
  })
  it('rejects non-object custom binding JSON at the schema boundary', async () => {
    const ctx = new Context()
    await ctx.plugin(MemorySettings).await()
    const fiber = ctx.plugin({ apply })
    await fiber.await()

    await expect(ctx.settings.update(SHORTCUTS_SETTINGS_NAMESPACE, {
      activeProfile: 'standard',
      customBindings: [null],
    })).rejects.toThrow()
    expect((ctx.settings.get(SHORTCUTS_SETTINGS_NAMESPACE) as ShortcutSettings).customBindings).toEqual(expect.any(Array))

    await fiber.dispose()
  })


  it('accepts declarative sequence alternatives and Mod combinations', async () => {
    const ctx = new Context()
    await ctx.plugin(MemorySettings).await()
    const fiber = ctx.plugin({ apply })
    await fiber.await()

    await expect(ctx.settings.update(SHORTCUTS_SETTINGS_NAMESPACE, {
      activeProfile: 'standard',
      customBindings: [{
        command: 'openSettings',
        scope: 'global',
        sequences: [[
          { key: 'g', modifiers: ['Mod', 'Alt'] },
          { key: 's', modifiers: [] },
        ], [{ key: 's', modifiers: ['Mod', 'Shift'] }]],
      }],
    })).resolves.toBeUndefined()

    await fiber.dispose()
  })

  it('rejects sequence prefix conflicts at the settings boundary', async () => {
    const ctx = new Context()
    await ctx.plugin(MemorySettings).await()
    const fiber = ctx.plugin({ apply })
    await fiber.await()

    await expect(ctx.settings.update(SHORTCUTS_SETTINGS_NAMESPACE, {
      activeProfile: 'standard',
      customBindings: [
        { command: 'openSettings', scope: 'global', sequence: [{ key: 'g', modifiers: [] }] },
        { command: 'openCommandPalette', scope: 'global', sequence: [{ key: 'g', modifiers: [] }, { key: 's', modifiers: [] }] },
      ],
    })).rejects.toThrow()

    await fiber.dispose()
  })

  it('registers defaults, validates profile updates, and disposes with its fiber', async () => {
    const ctx = new Context()
    await ctx.plugin(MemorySettings).await()
    const fiber = ctx.plugin({ apply })
    await fiber.await()

    expect(SHORTCUTS_SETTINGS_NAMESPACE).toBe('dsh-ui-shortcuts')
    expect(ctx.settings.describe().map(row => row.ns)).toContain(SHORTCUTS_SETTINGS_NAMESPACE)
    expect(ctx.settings.get(SHORTCUTS_SETTINGS_NAMESPACE)).toMatchObject({ activeProfile: 'standard' })

    await ctx.settings.update(SHORTCUTS_SETTINGS_NAMESPACE, { activeProfile: 'vim' })
    expect(ctx.settings.get(SHORTCUTS_SETTINGS_NAMESPACE)).toMatchObject({ activeProfile: 'vim' })

    await expect(ctx.settings.update(SHORTCUTS_SETTINGS_NAMESPACE, { activeProfile: 'unknown' }))
      .rejects.toThrow('unknown')
    expect(ctx.settings.get(SHORTCUTS_SETTINGS_NAMESPACE)).toMatchObject({ activeProfile: 'vim' })

    await expect(ctx.settings.update(SHORTCUTS_SETTINGS_NAMESPACE, { activeProfile: 'missing' }))
      .rejects.toThrow('missing')
    expect(ctx.settings.get(SHORTCUTS_SETTINGS_NAMESPACE)).toMatchObject({ activeProfile: 'vim' })

    await expect(ctx.settings.update(SHORTCUTS_SETTINGS_NAMESPACE, { activeProfile: '' }))
      .rejects.toThrow('unknown shortcut profile')
    expect(ctx.settings.get(SHORTCUTS_SETTINGS_NAMESPACE)).toMatchObject({ activeProfile: 'vim' })

    await fiber.dispose()
    expect(ctx.settings.describe().map(row => row.ns)).not.toContain(SHORTCUTS_SETTINGS_NAMESPACE)
  })
})
