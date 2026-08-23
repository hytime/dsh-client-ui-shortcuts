import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import { SettingsProvider, type SettingsNamespace } from '@deepseek-ai/dsh-settings'
import { apply, SHORTCUTS_SETTINGS_NAMESPACE } from '../src/index.js'
import { validatePersistedShortcutBindings } from '../src/settings-validation.js'
import { defaultShortcutBindings } from '../src/settings.js'
import type { ShortcutSettings } from '../src/settings.js'

class MemorySettings extends SettingsProvider {
  readonly writable = true

  protected load(): Promise<Record<string, unknown>> {
    return Promise.resolve({})
  }

  protected persist(_ns: SettingsNamespace, _section: Record<string, unknown>): Promise<void> {
    return Promise.resolve()
  }
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
    expect(validatePersistedShortcutBindings([
      { command: 'openSettings', scope: 'global', key: { key: 's', modifiers: ['Mod', 'Alt'] } },
    ])).toBeUndefined()
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
    await ctx.plugin(MemorySettings).await()
    const fiber = ctx.plugin({ apply })
    await fiber.await()
    await expect(ctx.settings.update(SHORTCUTS_SETTINGS_NAMESPACE, {
      activeProfile: 'standard',
      customBindings: [{ ...validCustomBinding, key: { key: 's', modifiers: ['Mod', 'Ctrl'] } }],
    })).resolves.toBeUndefined()
    expect(ctx.settings.get(SHORTCUTS_SETTINGS_NAMESPACE)).toMatchObject({ customBindings: [{ key: { key: 's', modifiers: ['Mod', 'Ctrl'] } }] })
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
