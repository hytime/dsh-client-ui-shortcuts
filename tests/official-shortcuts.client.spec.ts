import { describe, expect, it, vi } from 'vitest'
import {
  ShortcutPersistence, bindingIssue, effectiveShortcuts, initialShortcutConfig,
  normalizeBinding, overlappingBindings, presentBinding,
} from '@deepseek-ai/dsh-client-shortcuts/protocol'
import { createQuickPanelModel } from '../src/client/settings/quick-panel.js'
import { bindingFromKey, isRecordable } from '../src/client/keyboard/record.js'
import { createOpenPanelCommand, OPEN_PANEL_COMMAND } from '../src/client/keyboard/open-panel.js'
import { CONFIG_FILE_FORMAT } from '../src/client/contract/config-file.js'
import type { Shortcuts } from '@deepseek-ai/dsh-client-shortcuts/client'

function observable<T>(initial: T) {
  let value = initial
  const listeners = new Set<() => void>()
  return {
    getSnapshot: () => value,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } },
    publish: (next: T) => { value = next; for (const listener of [...listeners]) listener() },
    listeners,
  }
}

function bench() {
  const form = {
    ...observable<any>({ status: 'ready', writable: true, value: {} }),
    set: vi.fn(async () => true),
    mutate: vi.fn(async () => true),
  }
  // A realistic official catalog: this plugin's command plus DSH's own commands.
  const catalog = observable<any[]>([
    { id: OPEN_PANEL_COMMAND, label: 'Open quick panel', keys: ['⌘', '⌥', '⇧', 'S'], binding: null, modified: false, issue: null, conflicts: [] },
    { id: 'session.new', label: 'New session', keys: ['⌘', 'N'], binding: null, modified: false, issue: null, conflicts: [] },
    { id: 'session.search', label: 'Search sessions', keys: [], binding: null, modified: false, issue: null, conflicts: [] },
  ])
  // The official snapshot must report `ready`; binding edits are gated on that status.
  const config = observable<any>({ revision: 'rev-1', status: 'ready', error: null,
    document: { schemaVersion: 1, profiles: {} } })
  const edit = vi.fn(async () => ({ status: 'saved' }))
  const recording = vi.fn(async () => {})
  const shortcuts = {
    catalog, config, edit, recording, runtime: 'web', platform: 'macos',
    // Faithful stand-in: null stays unbound, a supported code round-trips, and the official
    // service throws on an unsupported physical code instead of inventing a binding.
    describeBinding: vi.fn((candidate: { code: string; modifiers?: readonly string[] } | null) => {
      if (candidate === null) return { binding: null, keys: [], issue: null, conflicts: [] }
      if (!/^(Key[A-Z]|Digit[0-9])$/u.test(candidate.code)) throw new Error(`Unsupported shortcut code: ${candidate.code}`)
      // `primary` is logical and resolves per platform; the fixture runs as web:macos.
      const expanded = (candidate.modifiers ?? []).map(modifier => modifier === 'primary' ? 'meta' : modifier)
      const modifiers = ['control', 'alt', 'shift', 'meta'].filter(modifier => expanded.includes(modifier))
      const binding = { code: candidate.code, modifiers }
      const keys = candidate.code.startsWith('Key') ? [candidate.code.slice(3)] : [candidate.code.slice(5)]
      return { binding, keys, issue: null, conflicts: [] }
    }),
  } as unknown as Shortcuts
  const model = createQuickPanelModel(form as never, shortcuts)
  return {
    model, form, catalog, config, edit, recording, shortcuts,
    setEdit: (result: unknown) => { edit.mockResolvedValueOnce(result as never) },
    /** Merge one field update into an existing official catalog row. */
    publish: (id: string, patch: Record<string, unknown>) => {
      catalog.publish(catalog.getSnapshot().map(row => row.id === id ? { ...row, ...patch } : row))
    },
  }
}

/**
 * A harness backed by the *published* official persistence, catalog projection, and describe
 * rules, so every edit updates the accepted document and catalog. A mock that always answers
 * `saved` cannot show whether an import reproduced the source state, which is exactly what the
 * complete-snapshot behaviour has to prove.
 */
async function officialBench() {
  const runtime = 'web' as const
  const platform = 'macos' as const
  const profile = `${runtime}:${platform}`
  const labels: Record<string, string> = {
    [OPEN_PANEL_COMMAND]: 'Open quick panel', 'session.new': 'New session',
    'a.one': 'A one', 'a.two': 'A two', 'c.three': 'C three',
  }
  const definitions = [
    { id: OPEN_PANEL_COMMAND, label: labels[OPEN_PANEL_COMMAND]!, defaults: {} },
    { id: 'session.new', label: labels['session.new']!, defaults: { [profile]: { code: 'KeyN', modifiers: ['shift', 'meta'] } } },
    { id: 'a.one', label: labels['a.one']!, defaults: { [profile]: { code: 'KeyB', modifiers: ['shift', 'meta'] } } },
    { id: 'a.two', label: labels['a.two']!, defaults: { [profile]: { code: 'KeyM', modifiers: ['shift', 'meta'] } } },
    { id: 'c.three', label: labels['c.three']!, defaults: {} },
  ]
  let raw: string | null = null
  let snapshot: any = initialShortcutConfig()
  let catalogRows: any[] = []
  const catalogListeners = new Set<() => void>()
  const configListeners = new Set<() => void>()
  const project = (): void => {
    const rows = effectiveShortcuts(definitions as never, snapshot.document, runtime, platform)
    catalogRows = rows.map(row => {
      const present = presentBinding(row.binding, platform)
      return { id: row.id, label: labels[row.id] ?? row.id, keys: present.keys, aria: undefined,
        binding: row.binding, modified: row.modified, conflicts: [...row.conflicts], issue: row.issue }
    })
  }
  const persistence = new ShortcutPersistence(
    { read: () => raw, write: (next: string) => { raw = next } } as never, runtime, platform, false, next => {
      snapshot = next
      project()
      for (const listener of [...catalogListeners]) listener()
      for (const listener of [...configListeners]) listener()
    })
  persistence.setDefinitions(definitions as never)
  snapshot = await persistence.readCurrent()
  project()
  const catalog = { getSnapshot: () => catalogRows,
    subscribe: (listener: () => void) => { catalogListeners.add(listener); return () => { catalogListeners.delete(listener) } } }
  const config = { getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => { configListeners.add(listener); return () => { configListeners.delete(listener) } } }
  const describeBinding = (binding: { code: string; modifiers: readonly string[] } | null) => {
    const normalized = binding === null ? null : normalizeBinding(binding as never, platform)
    return {
      binding: normalized,
      keys: presentBinding(normalized, platform).keys,
      issue: normalized === null ? null : bindingIssue(normalized, runtime, platform),
      conflicts: normalized === null ? []
        : catalogRows.filter(row => row.binding !== null && overlappingBindings(row.binding, normalized)).map(row => row.id),
    }
  }
  const edit = vi.fn((editValue: never, revision: never) => persistence.edit(editValue, revision))
  const form = {
    getSnapshot: () => ({ status: 'ready', writable: true, value: { questionEnabled: false, approvalEnabled: false } }),
    subscribe: () => () => {},
    set: vi.fn(async () => true),
    mutate: vi.fn(async () => true),
  }
  const model = createQuickPanelModel(form as never, {
    catalog, config, edit, runtime, platform,
    describeBinding: vi.fn(describeBinding), recording: vi.fn(async () => {}),
  } as never)
  return {
    model, form, edit, catalog, config,
    /** Apply one official edit against the live revision; the accepted document then advances. */
    async persist(edits: readonly { type: 'set'; id: string; binding: unknown }[]): Promise<void> {
      for (const entry of edits) {
        const result = await persistence.edit(entry as never, snapshot.revision)
        if (result.status !== 'saved') throw new Error(`seed edit refused: ${result.status}`)
      }
    },
    overrides: () => (snapshot.document.profiles as Record<string, Record<string, unknown>>)[profile] ?? {},
    row: (id: string) => catalogRows.find(row => row.id === id),
  }
}

describe('official summon command', () => {
  it('uses one editable ID and leaves unsupported platform defaults unbound', () => {
    const command = createOpenPanelCommand(() => 'Open', vi.fn())
    expect(command.id).toBe(OPEN_PANEL_COMMAND)
    expect(command.defaults).toEqual({
      'web:macos': { code: 'KeyS', modifiers: ['meta', 'alt', 'shift'] },
      'web:windows': { code: 'KeyS', modifiers: ['control', 'alt', 'shift'] },
    })
    expect(command.regions).toEqual(['page', 'editable'])
  })

  it('allows settings and its own modal but blocks other dialogs even under native dispatch', () => {
    const toggle = vi.fn()
    const command = createOpenPanelCommand(() => 'Open', toggle)
    for (const modal of [null, 'settings', 'hytime-shortcuts']) {
      const result = command.resolve({ modal, region: 'page', target: null })
      expect(result.status).toBe('handled')
      if (result.status === 'handled') result.run()
    }
    for (const modal of ['shortcuts', 'other', 'approval']) {
      expect(command.resolve({ modal, region: 'page', target: null }).status).toBe('blocked')
    }
    expect(toggle).toHaveBeenCalledTimes(3)
  })
})

describe('official recording candidate', () => {
  it('builds a physical candidate and ignores modifiers, IME, and bare Escape', () => {
    const base = { code: 'KeyG', key: 'g', ctrlKey: false, altKey: false, shiftKey: false, metaKey: false, isComposing: false, repeat: false }
    expect(bindingFromKey(base)).toEqual({ code: 'KeyG', modifiers: [] })
    expect(bindingFromKey({ ...base, metaKey: true, shiftKey: true })).toEqual({ code: 'KeyG', modifiers: ['shift', 'meta'] })
    expect(bindingFromKey({ ...base, isComposing: true })).toBe('ignore')
    expect(bindingFromKey({ ...base, code: 'MetaLeft', key: 'Meta', metaKey: true })).toBe('ignore')
    expect(bindingFromKey({ ...base, code: 'Escape', key: 'Escape' })).toBe('cancel')
    expect(bindingFromKey({ ...base, code: 'Escape', key: 'Escape', metaKey: true })).toEqual({ code: 'Escape', modifiers: ['meta'] })
    expect(isRecordable({ isComposing: true, repeat: false })).toBe(false)
    expect(isRecordable({ isComposing: false, repeat: true })).toBe(false)
    expect(isRecordable({ isComposing: false, repeat: false })).toBe(true)
    // AltGr reports Ctrl+Alt but the official adapter never dispatches it, so persisting that
    // combination would create a binding the user cannot trigger with the keys they pressed.
    expect(bindingFromKey({ ...base, altGraph: true, ctrlKey: true, altKey: true })).toBe('ignore')
    expect(isRecordable({ isComposing: false, repeat: false, altGraph: true })).toBe(false)
    // A dead key starts an accented sequence rather than a combination.
    expect(bindingFromKey({ ...base, code: 'Backquote', key: 'Dead' })).toBe('ignore')
    expect(bindingFromKey({ ...base, code: 'Unidentified', key: 'Unidentified' })).toBe('ignore')
  })
})

describe('official settings and shortcut projection', () => {
  it('projects the complete official command catalog with its own command first', () => {
    const b = bench()
    const state = b.model.getSnapshot()
    expect(state.commands.map(command => command.id)).toEqual([OPEN_PANEL_COMMAND, 'session.new', 'session.search'])
    expect(state.commands[0]).toMatchObject({ label: 'Open quick panel', modified: false })
    expect(state.officialWritable).toBe(true)
    b.model.dispose()
  })

  it('drives any official command, not just its own, through the official edit', async () => {
    const b = bench()
    await b.model.saveBinding('session.new', { code: 'KeyJ', modifiers: ['meta'] })
    expect(b.edit).toHaveBeenLastCalledWith({ type: 'set', id: 'session.new', binding: { code: 'KeyJ', modifiers: ['meta'] } }, 'rev-1')
    await b.model.resetCommand('session.new')
    expect(b.edit).toHaveBeenLastCalledWith({ type: 'reset', id: 'session.new' }, 'rev-1')
    await b.model.clearCommand('session.search')
    expect(b.edit).toHaveBeenLastCalledWith({ type: 'set', id: 'session.search', binding: null }, 'rev-1')
    b.model.dispose()
  })

  it('records the command that was armed, and switching the target does not re-arm native input', async () => {
    const b = bench()
    await b.model.startRecording('session.new')
    expect(b.recording).toHaveBeenCalledTimes(1)
    expect(b.model.getSnapshot().recordingCommand).toBe('session.new')
    await b.model.startRecording('session.search')
    expect(b.recording).toHaveBeenCalledTimes(1)
    expect(b.model.getSnapshot().recordingCommand).toBe('session.search')
    await b.model.finishRecording({ code: 'KeyK', modifiers: ['meta'] })
    expect(b.edit).toHaveBeenCalledExactlyOnceWith({ type: 'set', id: 'session.search', binding: { code: 'KeyK', modifiers: ['meta'] } }, 'rev-1')
    expect(b.recording).toHaveBeenLastCalledWith(false)
    b.model.dispose()
  })

  it('reports a rejected official binding for the armed command and keeps recording', async () => {
    const b = bench()
    b.shortcuts.describeBinding = vi.fn(() => ({ binding: null, keys: [], issue: 'reserved', conflicts: [] })) as never
    await b.model.startRecording('session.new')
    await b.model.finishRecording({ code: 'KeyQ', modifiers: ['meta'] })
    expect(b.model.getSnapshot()).toMatchObject({ recordingCommand: 'session.new', message: { code: 'unsupported' } })
    expect(b.edit).not.toHaveBeenCalled()
    b.model.dispose()
  })

  it('refuses to arm recording while the official configuration is not ready', async () => {
    const b = bench()
    b.config.publish({ revision: 'rev-0', status: 'unreadable', error: 'read' })
    expect(b.model.getSnapshot().officialWritable).toBe(false)
    await b.model.startRecording('session.new')
    expect(b.recording).not.toHaveBeenCalled()
    expect(b.model.getSnapshot().recordingCommand).toBeNull()
    b.model.dispose()
  })

  it('defaults both enhancements off and never writes on its own', () => {
    const b = bench()
    expect(b.model.getSnapshot()).toMatchObject({ questionEnabled: false, approvalEnabled: false })
    expect(b.form.set).not.toHaveBeenCalled()
    expect(b.edit).not.toHaveBeenCalled()
    b.model.dispose()
  })

  it('records only through the official recording call and reports a native failure', async () => {
    const b = bench()
    await b.model.startRecording(OPEN_PANEL_COMMAND)
    expect(b.recording).toHaveBeenCalledWith(true)
    expect(b.model.getSnapshot().recordingCommand).toBe(OPEN_PANEL_COMMAND)
    b.model.stopRecording()
    expect(b.recording).toHaveBeenLastCalledWith(false)

    b.recording.mockRejectedValueOnce(new Error('no bridge'))
    await b.model.startRecording(OPEN_PANEL_COMMAND)
    expect(b.model.getSnapshot()).toMatchObject({ recordingCommand: null, message: { code: 'native-failed' } })
    b.model.dispose()
  })

  it('does not re-arm recording when a delayed native acknowledgement arrives after closing', async () => {
    const b = bench()
    let acknowledge!: () => void
    b.recording.mockImplementationOnce(() => new Promise<void>(resolve => { acknowledge = resolve }))
    b.model.open()
    const pending = b.model.startRecording('session.new')
    // The user closes the panel while Desktop has not yet acknowledged the request.
    b.model.close()
    acknowledge()
    await pending

    expect(b.model.getSnapshot()).toMatchObject({ open: false, recordingCommand: null })
    b.model.dispose()
  })

  it('releases official recording when the last panel surface unmounts', async () => {
    const b = bench()
    b.model.open()
    await b.model.startRecording('session.new')
    expect(b.model.getSnapshot().recordingCommand).toBe('session.new')

    b.model.releaseSurface()

    expect(b.model.getSnapshot().recordingCommand).toBeNull()
    expect(b.recording).toHaveBeenLastCalledWith(false)
    b.model.dispose()
  })

  it('excludes its own command when re-recording and importing the existing binding', async () => {
    const b = bench()
    b.shortcuts.describeBinding = vi.fn((candidate: unknown) => ({ binding: candidate,
      keys: ['S'], issue: null, conflicts: [OPEN_PANEL_COMMAND] })) as never
    const binding = { code: 'KeyS', modifiers: ['alt', 'shift', 'meta'] as const }
    await b.model.startRecording(OPEN_PANEL_COMMAND)
    await b.model.finishRecording(binding)
    expect(b.model.getSnapshot()).toMatchObject({ recordingCommand: null, message: null })
    expect(b.edit).toHaveBeenCalledTimes(1)
    await b.model.importConfig(JSON.stringify({ format: CONFIG_FILE_FORMAT, version: 2,
      configuration: { questionEnabled: false, approvalEnabled: false,
        shortcuts: { [OPEN_PANEL_COMMAND]: { modified: true, binding } } } }))
    expect(b.model.getSnapshot().message).toEqual({ code: 'imported' })
    expect(b.edit).toHaveBeenCalledTimes(2)
    b.model.dispose()
  })

  it('keeps recording and reports when a recorded combination is rejected or conflicting', async () => {
    const b = bench()
    b.shortcuts.describeBinding = vi.fn(() => ({ binding: { code: 'PageUp', modifiers: [] }, keys: [], issue: 'unsupported-key', conflicts: [] })) as never
    await b.model.startRecording(OPEN_PANEL_COMMAND)
    await b.model.finishRecording({ code: 'PageUp', modifiers: [] })
    expect(b.model.getSnapshot()).toMatchObject({ recordingCommand: OPEN_PANEL_COMMAND, message: { code: 'unsupported' } })
    expect(b.edit).not.toHaveBeenCalled()

    b.shortcuts.describeBinding = vi.fn(() => ({ binding: { code: 'KeyN', modifiers: ['meta'] }, keys: ['⌘', 'N'], issue: null, conflicts: ['session.new'] })) as never
    b.catalog.publish([{ id: 'session.new', label: 'New session', keys: [], issue: null, conflicts: [] }])
    await b.model.finishRecording({ code: 'KeyN', modifiers: ['meta'] })
    expect(b.model.getSnapshot()).toMatchObject({ recordingCommand: OPEN_PANEL_COMMAND, message: { code: 'conflict', detail: ['New session'] } })
    expect(b.edit).not.toHaveBeenCalled()
    b.model.dispose()
  })

  it('stops recording and saves an accepted candidate exactly once', async () => {
    const b = bench()
    await b.model.startRecording(OPEN_PANEL_COMMAND)
    await b.model.finishRecording({ code: 'KeyG', modifiers: ['meta'] })
    expect(b.recording).toHaveBeenLastCalledWith(false)
    expect(b.model.getSnapshot()).toMatchObject({ recordingCommand: null, message: null })
    expect(b.edit).toHaveBeenCalledExactlyOnceWith({ type: 'set', id: OPEN_PANEL_COMMAND, binding: { code: 'KeyG', modifiers: ['meta'] } }, 'rev-1')
    b.model.dispose()
  })

  it('saves, clears, and resets through the official revision-checked edit', async () => {
    const b = bench()
    await b.model.saveBinding(OPEN_PANEL_COMMAND, { code: 'KeyG', modifiers: ['meta'] })
    expect(b.edit).toHaveBeenLastCalledWith({ type: 'set', id: OPEN_PANEL_COMMAND, binding: { code: 'KeyG', modifiers: ['meta'] } }, 'rev-1')
    await b.model.clearCommand(OPEN_PANEL_COMMAND)
    expect(b.edit).toHaveBeenLastCalledWith({ type: 'set', id: OPEN_PANEL_COMMAND, binding: null }, 'rev-1')
    await b.model.resetCommand(OPEN_PANEL_COMMAND)
    expect(b.edit).toHaveBeenLastCalledWith({ type: 'reset', id: OPEN_PANEL_COMMAND }, 'rev-1')
    expect(b.model.getSnapshot().message).toBeNull()
    b.model.dispose()
  })

  it('reports official conflict, unsupported, stale, and write failures without changing accepted keys', async () => {
    const b = bench()
    b.publish(OPEN_PANEL_COMMAND, { keys: ['⌘', 'G'] })

    b.setEdit({ status: 'conflict', conflicts: ['session.new'], snapshot: {} })
    await b.model.saveBinding(OPEN_PANEL_COMMAND, { code: 'KeyG', modifiers: ['meta'] })
    // Conflicts are reported by localized command label, resolved from the official catalog.
    expect(b.model.getSnapshot().message).toEqual({ code: 'conflict', detail: ['New session'] })

    b.setEdit({ status: 'conflict', issue: 'reserved', conflicts: [], snapshot: {} })
    await b.model.saveBinding(OPEN_PANEL_COMMAND, { code: 'KeyG', modifiers: ['meta'] })
    expect(b.model.getSnapshot().message).toEqual({ code: 'unsupported' })

    b.setEdit({ status: 'stale', snapshot: {} })
    await b.model.saveBinding(OPEN_PANEL_COMMAND, { code: 'KeyG', modifiers: ['meta'] })
    expect(b.model.getSnapshot().message).toEqual({ code: 'stale' })

    b.setEdit({ status: 'write-failed', snapshot: {} })
    await b.model.saveBinding(OPEN_PANEL_COMMAND, { code: 'KeyG', modifiers: ['meta'] })
    expect(b.model.getSnapshot().message).toEqual({ code: 'write-failed' })

    b.setEdit({ status: 'unreadable', snapshot: {} })
    await b.model.saveBinding(OPEN_PANEL_COMMAND, { code: 'KeyG', modifiers: ['meta'] })
    expect(b.model.getSnapshot().message).toEqual({ code: 'read-failed' })

    // Accepted keys keep coming from the official catalog, never from a local draft.
    expect(b.model.getSnapshot().commands.find(c => c.id === OPEN_PANEL_COMMAND)?.keys).toEqual(['⌘', 'G'])
    b.model.dismiss()
    expect(b.model.getSnapshot().message).toBeNull()
    b.model.dispose()
  })

  it('reports an unsupported candidate and reflects official rebind, clear, and conflict state', () => {
    const b = bench()
    expect(b.model.describe({ code: 'KeyG', modifiers: ['meta'] })).toEqual({
      binding: { code: 'KeyG', modifiers: ['meta'] }, keys: ['G'], issue: null, conflicts: [],
    })
    // An unsupported code is reported, never persisted, and null stays unbound.
    expect(b.model.describe({ code: 'PageUp', modifiers: [] })).toEqual({ binding: null, keys: [], issue: 'unsupported-key', conflicts: [] })
    expect(b.model.describe(null)).toEqual({ binding: null, keys: [], issue: null, conflicts: [] })

    b.publish(OPEN_PANEL_COMMAND, { keys: ['Ctrl', 'S'] })
    expect(b.model.getSnapshot().commands.find(c => c.id === OPEN_PANEL_COMMAND)?.keys).toEqual(['Ctrl', 'S'])
    b.publish(OPEN_PANEL_COMMAND, { keys: [] })
    expect(b.model.getSnapshot().commands.find(c => c.id === OPEN_PANEL_COMMAND)?.keys).toEqual([])
    b.publish(OPEN_PANEL_COMMAND, { keys: ['S'], conflicts: ['other'] })
    expect(b.model.getSnapshot().commands.find(c => c.id === OPEN_PANEL_COMMAND)?.conflicts).toEqual(['other'])
    expect(b.edit).not.toHaveBeenCalled()
    b.model.dispose()
  })

  it('handles transport failures and refuses writes while settings are unavailable', async () => {
    const b = bench()
    b.edit.mockRejectedValueOnce(new Error('offline'))
    await b.model.saveBinding(OPEN_PANEL_COMMAND, { code: 'KeyG', modifiers: ['meta'] })
    expect(b.model.getSnapshot().message).toEqual({ code: 'write-failed' })

    // Official keybindings are independent of the plugin's own settings namespace.
    b.form.publish({ status: 'unavailable', writable: false, value: { approvalEnabled: true } })
    expect(b.model.getSnapshot()).toMatchObject({ approvalEnabled: false, writable: false })
    await b.model.setEnabled('approvalEnabled', true)
    expect(b.form.set).not.toHaveBeenCalled()
    const edits = b.edit.mock.calls.length
    await b.model.saveBinding(OPEN_PANEL_COMMAND, { code: 'KeyG', modifiers: ['meta'] })
    expect(b.edit.mock.calls.length).toBe(edits + 1)
    b.model.dispose()
  })

  it('exports every official command, not only the customized ones', () => {
    const b = bench()
    b.form.publish({ status: 'ready', writable: true, value: { questionEnabled: true, approvalEnabled: false } })
    // One customized command and two untouched defaults must all appear in the file.
    b.publish('session.new', { modified: true, keys: ['⇧', '⌘', 'J'], binding: { code: 'KeyJ', modifiers: ['shift', 'meta'] } })
    const document = JSON.parse(b.model.exportConfig())
    expect(document.version).toBe(2)
    expect(document.configuration.profile).toBe('web:macos')
    expect(Object.keys(document.configuration.shortcuts).sort()).toEqual(
      ['hytime.shortcuts.open', 'session.new', 'session.search'])
    expect(document.configuration.shortcuts['session.new']).toMatchObject({
      modified: true, binding: { code: 'KeyJ', modifiers: ['shift', 'meta'] }, label: 'New session',
    })
    // An untouched command is exported as an unmodified entry, which an import leaves alone.
    expect(document.configuration.shortcuts['session.search']).toMatchObject({ modified: false })
    b.model.dispose()
  })

  it('normalizes a stored logical `primary` modifier through the official service on export', () => {
    const b = bench()
    b.publish('session.new', { modified: true, binding: { code: 'KeyN', modifiers: ['primary'] } })
    expect(JSON.parse(b.model.exportConfig()).configuration.shortcuts['session.new'].binding)
      .toEqual({ code: 'KeyN', modifiers: ['meta'] })
    b.model.dispose()
  })

  it('never lets one undescribable stored binding fail the whole export', () => {
    const b = bench()
    b.publish('session.search', { modified: true, binding: { code: 'PageUp', modifiers: ['meta'] } })
    const described = b.shortcuts.describeBinding as unknown as { mockImplementation: (fn: (candidate: unknown) => unknown) => void }
    described.mockImplementation((candidate: unknown) => {
      const code = (candidate as { code?: string } | null)?.code
      if (code === 'PageUp') throw new Error('Unsupported shortcut code: PageUp')
      return { binding: candidate, keys: [], issue: null, conflicts: [] }
    })
    const shortcuts = JSON.parse(b.model.exportConfig()).configuration.shortcuts
    // The bad command is recorded as unbound rather than aborting the export.
    expect(shortcuts['session.search'].binding).toBeNull()
    expect(shortcuts['session.new']).toBeDefined()
    b.model.dispose()
  })

  it('imports switches and every official command through their own owners', async () => {
    const b = bench()
    await b.model.importConfig(JSON.stringify({
      format: CONFIG_FILE_FORMAT, version: 2,
      configuration: { questionEnabled: true, approvalEnabled: true,
        shortcuts: { 'session.new': { modified: true, binding: { code: 'KeyG', modifiers: ['meta'] } } } },
    }))
    expect(b.edit).toHaveBeenCalledExactlyOnceWith(
      { type: 'set', id: 'session.new', binding: { code: 'KeyG', modifiers: ['meta'] } }, 'rev-1')
    // Both switches travel in one accepted mutation, so neither can be left half-applied.
    expect(b.form.mutate).toHaveBeenCalledExactlyOnceWith([
      { op: 'set', path: ['questionEnabled'], value: true },
      { op: 'set', path: ['approvalEnabled'], value: true },
    ])
    expect(b.form.set).not.toHaveBeenCalled()
    expect(b.model.getSnapshot().message).toEqual({ code: 'imported' })
    b.model.dispose()
  })

  it('leaves the plugin switches untouched when the official binding is refused', async () => {
    const b = bench()
    b.shortcuts.describeBinding = vi.fn(() => ({ binding: null, keys: [], issue: 'reserved', conflicts: [] })) as never
    await b.model.importConfig(JSON.stringify({
      format: CONFIG_FILE_FORMAT, version: 2,
      configuration: { questionEnabled: true, approvalEnabled: true,
        shortcuts: { 'session.new': { modified: true, binding: { code: 'KeyQ', modifiers: ['meta'] } } } },
    }))
    expect(b.model.getSnapshot().message).toEqual({ code: 'unsupported' })
    expect(b.form.set).not.toHaveBeenCalled()
    expect(b.form.mutate).not.toHaveBeenCalled()
    expect(b.edit).not.toHaveBeenCalled()
    b.model.dispose()
  })

  it('leaves the plugin switches untouched when the official edit is rejected', async () => {
    const b = bench()
    // The official service reports the *other* command that occupies the combination,
    // resolved to its official label; a command never conflicts with itself.
    b.publish('session.search', { label: 'Search sessions' })
    b.setEdit({ status: 'conflict', conflicts: ['session.search'], snapshot: {} })
    await b.model.importConfig(JSON.stringify({
      format: CONFIG_FILE_FORMAT, version: 2,
      configuration: { questionEnabled: true, approvalEnabled: true,
        shortcuts: { 'session.new': { modified: true, binding: { code: 'KeyU', modifiers: ['meta'] } } } },
    }))
    expect(b.model.getSnapshot().message).toEqual({ code: 'conflict', detail: ['Search sessions'] })
    expect(b.form.set).not.toHaveBeenCalled()
    expect(b.form.mutate).not.toHaveBeenCalled()
    b.model.dispose()
  })

  it('imports switches when the document carries no shortcut at all', async () => {
    const b = bench()
    await b.model.importConfig(JSON.stringify({
      format: CONFIG_FILE_FORMAT, version: 2, configuration: { questionEnabled: true, approvalEnabled: false, shortcuts: {} },
    }))
    expect(b.edit).not.toHaveBeenCalled()
    // The fixture starts with no accepted section, so both switches differ from the file.
    expect(b.form.mutate).toHaveBeenCalledExactlyOnceWith([
      { op: 'set', path: ['questionEnabled'], value: true },
      { op: 'set', path: ['approvalEnabled'], value: false },
    ])
    expect(b.form.set).not.toHaveBeenCalled()
    expect(b.model.getSnapshot().message).toEqual({ code: 'imported' })
    b.model.dispose()
  })

  it.each([
    ['invalid document', '{}', 'import-invalid'],
    ['future version', JSON.stringify({ format: CONFIG_FILE_FORMAT, version: 99, configuration: { questionEnabled: true, approvalEnabled: true, shortcuts: {} } }), 'import-future'],
    ['oversized text', 'x'.repeat((1 << 20) + 1), 'import-too-large'],
    ['unreadable file', null, 'import-read-failed'],
  ])('reports %s without writing anything', async (_label, raw, code) => {
    const b = bench()
    await b.model.importConfig(raw)
    expect(b.model.getSnapshot().message).toEqual({ code })
    expect(b.form.set).not.toHaveBeenCalled()
    expect(b.form.mutate).not.toHaveBeenCalled()
    expect(b.edit).not.toHaveBeenCalled()
    b.model.dispose()
  })

  it('reports a refused switch write and ignores imports after disposal', async () => {
    const b = bench()
    b.form.mutate.mockResolvedValueOnce(false)
    await b.model.importConfig(JSON.stringify({
      format: CONFIG_FILE_FORMAT, version: 2, configuration: { questionEnabled: true, approvalEnabled: false, shortcuts: {} },
    }))
    // The shortcuts stood but the switches did not, so the panel must not claim a clean import.
    expect(b.model.getSnapshot().message).toEqual({ code: 'import-partial', detail: ['questionEnabled', 'approvalEnabled'] })
    const calls = b.edit.mock.calls.length
    b.model.dispose()
    await b.model.importConfig(JSON.stringify({
      format: CONFIG_FILE_FORMAT, version: 2, configuration: { questionEnabled: true, approvalEnabled: true, shortcuts: {} },
    }))
    expect(b.edit.mock.calls.length).toBe(calls)
  })

  it('releases official interception and subscriptions on disposal, ignoring later work', async () => {
    const b = bench()
    await b.model.startRecording()
    b.model.dispose()
    expect(b.recording).toHaveBeenLastCalledWith(false)
    b.model.open()
    await b.model.saveBinding(OPEN_PANEL_COMMAND, { code: 'KeyG', modifiers: ['meta'] })
    expect(b.edit).not.toHaveBeenCalled()
    expect(b.form.listeners.size + b.catalog.listeners.size + b.config.listeners.size).toBe(0)
  })
})

/** Import must reproduce the source state through the official service, not merely report success. */
describe('complete snapshot import against the published official persistence', () => {
  const configFile = (shortcuts: Record<string, unknown>): string => JSON.stringify({
    format: CONFIG_FILE_FORMAT, version: 2,
    configuration: { questionEnabled: false, approvalEnabled: false, shortcuts },
  })

  it('restores a default instead of pinning the exported value as an override', async () => {
    const b = await officialBench()
    // The user customized session.new after the backup was taken.
    await b.persist([{ type: 'set', id: 'session.new', binding: { code: 'KeyJ', modifiers: ['shift', 'meta'] } }])
    expect(b.row('session.new').modified).toBe(true)

    await b.model.importConfig(configFile({
      'session.new': { modified: false, binding: { code: 'KeyN', modifiers: ['shift', 'meta'] } },
    }))

    expect(b.model.getSnapshot().message).toEqual({ code: 'imported' })
    // The default must be inherited again, so the backup's `modified:false` is reproduced.
    expect(b.overrides()).not.toHaveProperty('session.new')
    expect(b.row('session.new').modified).toBe(false)
    b.model.dispose()
  })

  it('restores two commands whose bindings were swapped', async () => {
    const b = await officialBench()
    await b.persist([
      { type: 'set', id: 'a.one', binding: { code: 'KeyJ', modifiers: ['shift', 'meta'] } },
      { type: 'set', id: 'a.two', binding: { code: 'KeyK', modifiers: ['shift', 'meta'] } },
    ])

    await b.model.importConfig(configFile({
      'a.one': { modified: true, binding: { code: 'KeyK', modifiers: ['shift', 'meta'] } },
      'a.two': { modified: true, binding: { code: 'KeyJ', modifiers: ['shift', 'meta'] } },
    }))

    expect(b.model.getSnapshot().message).toEqual({ code: 'imported' })
    expect(b.row('a.one').binding).toMatchObject({ code: 'KeyK', modifiers: ['shift', 'meta'] })
    expect(b.row('a.two').binding).toMatchObject({ code: 'KeyJ', modifiers: ['shift', 'meta'] })
    b.model.dispose()
  })

  it('frees a key held by a command the same file clears before writing the new owner', async () => {
    const b = await officialBench()
    await b.persist([{ type: 'set', id: 'c.three', binding: { code: 'KeyK', modifiers: ['shift', 'meta'] } }])

    await b.model.importConfig(configFile({
      'a.two': { modified: true, binding: { code: 'KeyK', modifiers: ['shift', 'meta'] } },
      'c.three': { modified: true, binding: null },
    }))

    expect(b.model.getSnapshot().message).toEqual({ code: 'imported' })
    expect(b.row('a.two').binding).toMatchObject({ code: 'KeyK', modifiers: ['shift', 'meta'] })
    expect(b.overrides()['c.three']).toBeNull()
    b.model.dispose()
  })
})
