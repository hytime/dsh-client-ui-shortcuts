// @vitest-environment jsdom
import { Context } from '@deepseek-ai/cordis'
import React from 'react'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, afterEach } from 'vitest'
import type { SettingsScope } from '@deepseek-ai/dsh-client-runtime/client'
import { apply, inject } from '../src/client/index.ts'
import { ShortcutComposer } from '../src/client/components/ShortcutComposer.js'
import type { ShortcutWait } from '../src/client/contract/slots.js'

type SlotEntry = {
  readonly options: Record<string, unknown>
  readonly component: unknown
}
type SlotCallback = () => () => void

type SlotChildren = Record<string, unknown>

type Receipt = { accepted: true } | { accepted: false; reason: string }

function pendingQuestion(sessionId: string, key: string): ShortcutWait {
  return {
    kind: 'question',
    key,
    sessionId: sessionId as never,
    payload: { questions: [{ id: 'q', question: 'Pick', options: [{ label: 'A' }] }] },
    respond: vi.fn(async () => ({ accepted: true } as Receipt)),
  } as unknown as ShortcutWait
}

class FakeSlotRegistry {
  private readonly declarations = new Set<string>()
  private readonly pending = new Map<string, Set<SlotCallback>>()
  private readonly registered = new Map<string, SlotEntry[]>()

  entries(name: string): readonly SlotEntry[] {
    return this.registered.get(name) ?? []
  }

  register(options: Record<string, unknown>, component: unknown): () => void {
    const name = String(options.name)
    const children = options.children as SlotChildren | undefined
    if (children !== undefined) {
      for (const child of Object.keys(children)) this.declare(child)
    }
    const entry: SlotEntry = { options, component }
    const entries = this.registered.get(name) ?? []
    entries.push(entry)
    this.registered.set(name, entries)
    return () => {
      const current = this.registered.get(name)
      if (current === undefined) return
      const index = current.indexOf(entry)
      if (index >= 0) current.splice(index, 1)
      if (current.length === 0) this.registered.delete(name)
    }
  }

  inject(name: string, callback: SlotCallback): () => void {
    if (this.declarations.has(name)) return callback()
    const callbacks = this.pending.get(name) ?? new Set<SlotCallback>()
    callbacks.add(callback)
    this.pending.set(name, callbacks)
    return () => {
      callbacks.delete(callback)
      if (callbacks.size === 0) this.pending.delete(name)
    }
  }

  private declare(name: string): void {
    this.declarations.add(name)
    const callbacks = this.pending.get(name)
    if (callbacks === undefined) return
    this.pending.delete(name)
    for (const callback of callbacks) callback()
  }
}

class FakeLocale {
  private readonly dictionaries = new Map<string, Record<string, string>>()

  register(namespace: string, dictionaries: { zh: Record<string, string>; en: Record<string, string> }): () => void {
    this.dictionaries.set(namespace, dictionaries.zh)
    return () => { this.dictionaries.delete(namespace) }
  }

  bind(namespace: string): (key: string) => string {
    return (key: string) => this.dictionaries.get(namespace)?.[key] ?? key
  }
}

function makeScope(value: ShortcutSettings = { activeProfile: 'standard' }) {
  let snapshot = {
    status: 'ready' as const,
    value,
    base: undefined,
    user: undefined,
    revision: 0,
    writable: true,
    mode: 'host' as const,
  }
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
  return { scope, setSnapshot: (next: ShortcutSettings) => { snapshot = { ...snapshot, value: next } } }
}

async function bench() {
  const ctx = new Context()
  const slots = new FakeSlotRegistry()
  slots.register({
    name: 'root',
    children: {
      'conversation.composer': { kind: 'chain', scope: 'session' },
      'settings.plugin.item': { kind: 'keyed', scope: 'root' },
    },
  }, () => null)
  const locale = new FakeLocale()
  ctx.provide('slots', slots)
  ctx.provide('locale', locale)
  const settings = makeScope()
  ctx.provide('settingsScope', { bind: vi.fn(() => settings.scope) })
  ctx.provide('sessions', { scope: vi.fn(() => undefined) })
  const feature = ctx.plugin({ inject: [...inject], apply })
  await feature.await()
  return { ctx, feature, slots, locale, settings }
}

afterEach(cleanup)

describe('shortcut client slot wiring', () => {
  it('preserves external composer focus through injected composer session transition', async () => {
    const b = await bench()
    const sessions = b.ctx.get('sessions') as { scope: (id: string) => unknown }
    vi.mocked(sessions.scope).mockImplementation(() => ({ get: () => ({ cancel: vi.fn(async () => {}) }) }) as never)
    const entry = b.slots.entries('conversation.composer')[0]!
    const injected = entry.options.inject as (sessionId: string) => { activeProfile: unknown; t: (key: string) => string; cancelTask: () => Promise<void>; focusCoordinator: unknown }
    const first = injected('s1')
    const hostInput = document.createElement('textarea')
    document.body.append(hostInput)
    hostInput.focus()
    const { rerender } = render(React.createElement(ShortcutComposer, { matched: pendingQuestion('s1', 'q:1'), ...first }))
    rerender(React.createElement(ShortcutComposer, { matched: pendingQuestion('s2', 'q:2'), ...injected('s2') }))
    await waitFor(() => expect(document.activeElement).toBe(hostInput))
    expect(document.activeElement).not.toBe(screen.getByRole('radio', { name: 'A' }))
    await b.feature.dispose()
  })

  it('declares its client services', () => {
    expect(inject).toEqual(['slots', 'locale', 'settingsScope', 'sessions'])
  })

  it('registers locale, composer selector and keyed settings card', async () => {
    const b = await bench()
    expect(b.locale.bind('dsh-shortcuts')('profile.standard.label')).toBe('标准')
    expect(b.slots.entries('conversation.composer')).toHaveLength(1)
    expect(b.slots.entries('conversation.composer')[0]!.options).toMatchObject({ locale: 'dsh-shortcuts', priority: -1 })
    expect(b.slots.entries('settings.plugin.item')[0]!.options).toMatchObject({ key: 'dsh-ui-shortcuts', locale: 'dsh-shortcuts' })
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

  it('isolates injected cancelTask by session and does not respond', async () => {
    const b = await bench()
    const cancelOne = vi.fn(async () => {})
    const cancelTwo = vi.fn(async () => {})
    const sessions = b.ctx.get('sessions') as { scope: (id: string) => unknown }
    vi.mocked(sessions.scope).mockImplementation((id: string) => ({
      get: (name: string) => name === 'conversation' ? { cancel: id === 's1' ? cancelOne : cancelTwo } : undefined,
    }) as never)
    const entry = b.slots.entries('conversation.composer')[0]!
    const inject = entry.options.inject as (sessionId: string) => { cancelTask: () => Promise<void> }
    await inject('s1').cancelTask()
    expect(cancelOne).toHaveBeenCalledOnce()
    expect(cancelTwo).not.toHaveBeenCalled()
    await b.feature.dispose()
  })
  it('persists settings, reports errors, and cleans subscriptions', async () => {
    const b = await bench()
    const listener = vi.fn()
    const card = b.slots.entries('settings.plugin.item')[0]!
    const injected = (card.options.inject as () => {
      settings: {
        activeProfileId: () => string
        subscribe: (listener: () => void) => () => void
        setActiveProfile: (id: string) => Promise<void>
        error: () => string | undefined
      }
      profiles: readonly unknown[]
    })()
    const face = injected.settings
    expect(injected.profiles.map(profile => (profile as { id: string }).id)).toEqual(['standard', 'vim'])
    const off = face.subscribe(listener)
    await face.setActiveProfile('vim')
    expect(face.activeProfileId()).toBe('vim')
    expect(b.settings.scope.set).toHaveBeenCalledWith('activeProfile', 'vim')
    expect(listener).toHaveBeenCalled()
    await expect(face.setActiveProfile('missing')).rejects.toThrow('unknown shortcut profile: missing')
    expect(face.error()).toContain('unknown shortcut profile')
    await b.feature.dispose()
    off()
    expect(b.slots.entries('conversation.composer')).toHaveLength(0)
    expect(b.slots.entries('settings.plugin.item')).toHaveLength(0)
    expect(b.locale.bind('dsh-shortcuts')('profile.standard.label')).toBe('profile.standard.label')
    expect(b.settings.scope.set).toHaveBeenCalledTimes(1)
  })
})
