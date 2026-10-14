// @vitest-environment jsdom
import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import { apply, inject } from '../src/client/apply.js'
import type { ShortcutSettings } from '../src/settings.js'
import type { QuickPanelModel } from '../src/client/contract/quick-panel.js'
import type { ShortcutCommand } from '@deepseek-ai/dsh-client-shortcuts/client'

// DSH supplies primitive implementations to the loader; slot wiring tests never render them.
vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => ({ Button: () => null, Modal: () => null, Switch: () => null, ShortcutKeys: () => null }))

function observable<T>(initial: T) {
  let value = initial
  const listeners = new Set<() => void>()
  return { getSnapshot: () => value,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } },
    publish: (next: T) => { value = next; for (const listener of [...listeners]) listener() }, listeners }
}

async function bench(initial: Partial<ShortcutSettings> = {}, withoutShortcuts = false) {
  const ctx = new Context()
  const entries: { options: any; component: unknown }[] = []
  const commands = new Map<string, ShortcutCommand>()
  const catalog = observable<any[]>([])
  const form = { ...observable({ status: 'ready', writable: true, value: initial }), set: vi.fn(async (field: string, value: boolean) => {
    form.publish({ ...form.getSnapshot(), value: { ...form.getSnapshot().value, [field]: value } })
    return true
  }) }
  const slots = {
    inject: (_name: string, callback: () => () => void) => callback(),
    register: (options: any, component: unknown) => {
      const entry = { options, component }; entries.push(entry)
      return () => { const index = entries.indexOf(entry); if (index >= 0) entries.splice(index, 1) }
    },
  }
  ctx.provide('slots', slots)
  ctx.provide('locale', { register: () => () => {}, bind: () => (key: string) => key,
    getSnapshot: () => ({ locales: [{ id: 'ja' }, { id: 'ko' }] }), addLanguage: vi.fn() })
  ctx.provide('configForms', { get: () => form })
  const cancel = vi.fn(async () => {})
  ctx.provide('sessions', { scope: () => ({ conversation: { cancel } }) })
  ctx.provide('conversation', { cancel })
  // Binding edits are gated on the official snapshot reporting `ready`.
  const config = observable({ revision: 'r1', status: 'ready', error: null })
  const shortcuts = {
    catalog, config, register: (command: ShortcutCommand) => {
      commands.set(command.id, command)
      catalog.publish([...commands.values()].map(command => ({ id: command.id, label: 'Open quick panel', keys: ['⌘', '⌥', '⇧', 'S'], issue: null, conflicts: [] })))
      return () => { commands.delete(command.id); catalog.publish([]) }
    },
    describeBinding: () => ({ binding: { code: 'KeyG', modifiers: ['meta'] }, keys: ['⌘', 'G'], issue: null, conflicts: [] }),
    edit: vi.fn(async () => ({ status: 'saved' })),
    recording: vi.fn(async () => {}),
  }
  if (!withoutShortcuts) ctx.provide('shortcuts', shortcuts)
  const feature = ctx.plugin({ inject: [...inject], apply })
  if (!withoutShortcuts) await feature.await()
  const model = () => entries.find(entry => entry.options.name === 'shell.overlay')!.options.inject().model as QuickPanelModel
  return { ctx, entries, commands, catalog, config, form, feature, model, cancel, shortcuts }
}

describe('current DSH integration', () => {
  it('requires official services and never declares a legacy provider', () => {
    expect(inject).toEqual(['slots', 'locale', 'shortcuts', 'configForms', 'sessions', 'conversation'])
  })
  it('keeps DSH as the only keybinding owner: no plugin edit surface is created', async () => {
    const b = await bench()
    // The plugin contributes a panel and a settings row, never its own keybinding store.
    for (const entry of b.entries) expect(entry.options.name).not.toContain('keybinding')
    expect(JSON.stringify(b.entries.map(entry => entry.options.name))).not.toContain('profile')
    await b.feature.dispose()
  })
  it('records, describes, and saves only through the official service', async () => {
    const b = await bench()
    const model = b.model()
    expect(model.describe({ code: 'KeyG', modifiers: ['meta'] })).toMatchObject({ keys: ['⌘', 'G'] })
    await model.startRecording('hytime.shortcuts.open')
    expect(b.shortcuts.recording).toHaveBeenCalledWith(true)
    expect(model.getSnapshot().recordingCommand).toBe('hytime.shortcuts.open')
    await model.saveBinding('hytime.shortcuts.open', { code: 'KeyG', modifiers: ['meta'] })
    expect(b.shortcuts.edit).toHaveBeenCalledWith({ type: 'set', id: 'hytime.shortcuts.open', binding: { code: 'KeyG', modifiers: ['meta'] } }, 'r1')
    model.stopRecording()
    expect(b.shortcuts.recording).toHaveBeenLastCalledWith(false)
    await model.resetCommand('hytime.shortcuts.open')
    expect(b.shortcuts.edit).toHaveBeenLastCalledWith({ type: 'reset', id: 'hytime.shortcuts.open' }, 'r1')
    await b.feature.dispose()
  })
  it('registers one official command and no interaction takeovers by default', async () => {
    const b = await bench()
    expect([...b.commands.keys()]).toEqual(['hytime.shortcuts.open'])
    expect(b.entries.map(entry => entry.options.name)).toEqual(['shell.overlay', 'plugins.bundle.config'])
    expect(b.model().getSnapshot()).toMatchObject({ questionEnabled: false, approvalEnabled: false })
    await b.feature.dispose()
    expect(b.commands.size).toBe(0)
    expect(b.entries).toEqual([])
    expect(b.form.listeners.size + b.catalog.listeners.size).toBe(0)
  })
  it('does not install a DOM keyboard listener or run a fallback when official shortcuts is missing', async () => {
    const add = vi.spyOn(window, 'addEventListener')
    const b = await bench({}, true)
    expect(b.entries).toEqual([])
    expect(b.commands.size).toBe(0)
    expect(add.mock.calls.some(([type]) => type === 'keydown')).toBe(false)
    add.mockRestore()
    await b.feature.dispose()
  })
  it('opens through the official command or settings click and toggles within its own modal', async () => {
    const b = await bench()
    const command = b.commands.get('hytime.shortcuts.open')!
    const resolution = command.resolve({ modal: null, region: 'page', target: null })
    if (resolution.status === 'handled') resolution.run()
    expect(b.model().getSnapshot().open).toBe(true)
    const close = command.resolve({ modal: 'hytime-shortcuts', region: 'editable', target: null })
    if (close.status === 'handled') close.run()
    expect(b.model().getSnapshot().open).toBe(false)
    b.entries.find(entry => entry.options.name === 'plugins.bundle.config')!.options.inject().model.open()
    expect(b.model().getSnapshot().open).toBe(true)
    await b.feature.dispose()
  })
  it('enables and disables each takeover independently after accepted settings', async () => {
    const b = await bench()
    const takeovers = () => b.entries.filter(entry => entry.options.name === 'conversation.composer')
    await b.model().setEnabled('questionEnabled', true)
    expect(takeovers()).toHaveLength(1)
    const questionEntry = takeovers()[0]!
    const question = { kind: 'question', key: 'q', questions: [], answer: vi.fn() }
    const approval = { kind: 'approval', key: 'a', toolName: 'bash', answer: vi.fn() }
    expect(questionEntry.options.select({ pendingInteraction: question })).toBe(question)
    expect(questionEntry.options.select({ pendingInteraction: approval })).toBeNull()
    await b.model().setEnabled('approvalEnabled', true)
    expect(takeovers()).toHaveLength(2)
    expect(takeovers()[0]).toBe(questionEntry)
    const approvalEntry = takeovers()[1]!
    expect(approvalEntry.options.select({ pendingInteraction: approval })).toBe(approval)
    await b.model().setEnabled('questionEnabled', false)
    expect(takeovers()).toEqual([approvalEntry])
    expect(question.answer).not.toHaveBeenCalled()
    expect(approval.answer).not.toHaveBeenCalled()
    await b.model().setEnabled('approvalEnabled', false)
    expect(takeovers()).toHaveLength(0)
    await b.feature.dispose()
  })
  it('does not enable old stored profiles and rejects legacy carriers', async () => {
    const b = await bench({ activeProfile: 'vim', customProfiles: [{}] } as never)
    expect(b.entries.filter(entry => entry.options.name === 'conversation.composer')).toHaveLength(0)
    await b.model().setEnabled('questionEnabled', true)
    const entry = b.entries.find(entry => entry.options.name === 'conversation.composer')!
    expect(entry.options.select({ pendingInteraction: { kind: 'question', payload: { questions: [] }, respond: vi.fn() } })).toBeNull()
    await b.feature.dispose()
  })
  it('uses current scoped cancellation and removes takeovers when settings become unavailable', async () => {
    const b = await bench({ approvalEnabled: true })
    const entry = b.entries.find(entry => entry.options.name === 'conversation.composer')!
    await entry.options.inject('s1').cancelTask()
    expect(b.cancel).toHaveBeenCalledOnce()
    b.form.publish({ ...b.form.getSnapshot(), status: 'unavailable' })
    expect(b.entries.some(entry => entry.options.name === 'conversation.composer')).toBe(false)
    await b.feature.dispose()
  })
})
