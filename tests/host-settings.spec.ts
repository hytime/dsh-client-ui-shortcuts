import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import { SettingsProvider, type SettingsNamespace } from '@deepseek-ai/dsh-settings'
import { apply, SHORTCUTS_SETTINGS_NAMESPACE } from '../src/index.js'

class MemorySettings extends SettingsProvider {
  readonly writable = true

  protected load(): Promise<Record<string, unknown>> {
    return Promise.resolve({})
  }

  protected persist(_ns: SettingsNamespace, _section: Record<string, unknown>): Promise<void> {
    return Promise.resolve()
  }
}

describe('shortcut Host settings', () => {
  it('does not require a settings provider', async () => {
    const ctx = new Context()
    const fiber = ctx.plugin({ apply })

    await expect(fiber.await()).resolves.toBeDefined()
    await fiber.dispose()
  })

  it('registers defaults, validates updates, and disposes with its fiber', async () => {
    const ctx = new Context()
    await ctx.plugin(MemorySettings).await()
    const fiber = ctx.plugin({ apply })
    await fiber.await()

    expect(SHORTCUTS_SETTINGS_NAMESPACE).toBe('ui-shortcuts')
    expect(ctx.settings.describe().map(row => row.ns)).toContain(SHORTCUTS_SETTINGS_NAMESPACE)
    expect(ctx.settings.get(SHORTCUTS_SETTINGS_NAMESPACE)).toEqual({ activeProfile: 'standard' })

    await ctx.settings.update(SHORTCUTS_SETTINGS_NAMESPACE, { activeProfile: 'vim' })
    expect(ctx.settings.get(SHORTCUTS_SETTINGS_NAMESPACE)).toEqual({ activeProfile: 'vim' })

    await expect(ctx.settings.update(SHORTCUTS_SETTINGS_NAMESPACE, { activeProfile: 'unknown' }))
      .rejects.toThrow('unknown')
    expect(ctx.settings.get(SHORTCUTS_SETTINGS_NAMESPACE)).toEqual({ activeProfile: 'vim' })

    await expect(ctx.settings.update(SHORTCUTS_SETTINGS_NAMESPACE, { activeProfile: 'missing' }))
      .rejects.toThrow('missing')
    expect(ctx.settings.get(SHORTCUTS_SETTINGS_NAMESPACE)).toEqual({ activeProfile: 'vim' })

    await expect(ctx.settings.update(SHORTCUTS_SETTINGS_NAMESPACE, { activeProfile: '' }))
      .rejects.toThrow('unknown shortcut profile')
    expect(ctx.settings.get(SHORTCUTS_SETTINGS_NAMESPACE)).toEqual({ activeProfile: 'vim' })

    await fiber.dispose()
    expect(ctx.settings.describe().map(row => row.ns)).not.toContain(SHORTCUTS_SETTINGS_NAMESPACE)
  })
})
