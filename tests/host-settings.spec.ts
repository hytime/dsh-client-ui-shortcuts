import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import { SettingsProvider, type SettingsNamespace } from '@deepseek-ai/dsh-settings'
import { apply, SHORTCUTS_SETTINGS_NAMESPACE } from '../src/index.js'
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
  key: { key: 's', modifiers: ['Mod'] as const },
}

describe('shortcut Host settings', () => {
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
    ]))
    expect(settings.customBindings.length).toBeGreaterThan(0)

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
    ['empty key', { ...validCustomBinding, key: { key: '', modifiers: ['Mod'] } }],
    ['contradictory modifiers', { ...validCustomBinding, key: { key: 's', modifiers: ['Mod', 'Ctrl'] } }],
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
