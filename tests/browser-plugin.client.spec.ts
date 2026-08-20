// Browser runtime artifact reads the platform object during module initialization.
if (typeof globalThis.window === 'undefined') (globalThis as typeof globalThis & { window: unknown }).window = {}
if (typeof globalThis.document === 'undefined') (globalThis as typeof globalThis & { document: unknown }).document = {}
import { describe, expect, it, vi } from 'vitest'
import { SlotRegistry } from '@deepseek-ai/dsh-client-runtime/client'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { apply, inject } from '../src/client/index.ts'
import type { SettingsScope } from '@deepseek-ai/dsh-client-runtime/client'
import type { ShortcutSettings } from '../src/settings.ts'

function makeScope(value: ShortcutSettings = { activeProfile: 'standard' }) {
  let snapshot = { status: 'ready' as const, value, base: undefined, user: undefined, revision: 0, writable: true, mode: 'host' as const }
  const listeners = new Set<() => void>()
  const scope: SettingsScope<ShortcutSettings> = {
    getSnapshot: () => snapshot,
    subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener) },
    set: vi.fn(async (_field: string, next: unknown) => {
      snapshot = { ...snapshot, value: { activeProfile: String(next) } }
      for (const listener of listeners) listener()
    }),
    unset: vi.fn(async () => {}),
  }
  return scope
}

async function bench() {
  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  const locale = new LocaleRuntime(ctx)
  ctx.provide('locale', locale)
  const scope = makeScope()
  ctx.provide('settingsScope', { bind: vi.fn(() => scope) })
  const feature = ctx.plugin({ inject: [...inject], apply })
  await feature.await()
  return { ctx, feature, slots: ctx.get('slots') as SlotRegistry, locale, scope }
}

describe('shortcut client slot wiring', () => {
  it('declares its client services', () => {
    expect(inject).toEqual(['slots', 'locale', 'settingsScope'])
  })

  it('registers locale, composer selector and keyed settings card', async () => {
    const b = await bench()
    expect(b.locale.get('shortcuts', 'profile.standard.label')).toBe('标准')
    expect(b.slots.entries('conversation.composer')).toHaveLength(1)
    expect(b.slots.entries('conversation.composer')[0]!.options).toMatchObject({ locale: 'shortcuts' })
    expect(b.slots.entries('settings.plugin.item')[0]!.options).toMatchObject({ key: 'shortcuts', locale: 'shortcuts' })
    await b.feature.dispose()
  })

  it('selector prefers question, accepts approval, and declines other or empty interactions', async () => {
    const b = await bench()
    const select = b.slots.entries('conversation.composer')[0]!.options.select as (owner: { interactions: readonly { kind: string }[] }) => unknown
    const question = { kind: 'question' }
    const approval = { kind: 'approval' }
    expect(select({ interactions: [approval] })).toBe(approval)
    expect(select({ interactions: [approval, question] })).toBe(question)
    expect(select({ interactions: [{ kind: 'other' }] })).toBeNull()
    expect(select({ interactions: [] })).toBeNull()
    await b.feature.dispose()
  })

  it('removes entries, locale and settings subscription on dispose', async () => {
    const b = await bench()
    const listener = vi.fn()
    const card = b.slots.entries('settings.plugin.item')[0]!
    const face = (card.options.inject as () => { subscribe: (listener: () => void) => () => void })()
    const off = face.subscribe(listener)
    await b.feature.dispose()
    off()
    expect(b.slots.entries('conversation.composer')).toHaveLength(0)
    expect(b.slots.entries('settings.plugin.item')).toHaveLength(0)
    expect(b.locale.get('shortcuts', 'profile.standard.label')).toBeUndefined()
    expect(b.scope.set).not.toHaveBeenCalled()
  })
})
