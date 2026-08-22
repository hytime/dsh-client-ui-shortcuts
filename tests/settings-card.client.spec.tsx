// @vitest-environment jsdom
import React from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ShortcutProfileCard } from '../src/client/components/ShortcutProfileCard.js'
import { ShortcutLegend } from '../src/client/components/ShortcutLegend.js'
import { findNewShortcutConflicts } from '../src/client/keyboard/conflicts.js'
import { ShortcutIcon } from '../src/client/components/ShortcutIcon.js'
import { createProfileRegistry } from '../src/client/profiles/registry.js'
import { standardProfile, vimProfile } from '../src/client/profiles/builtins.js'
import type { ShortcutSettingsFace } from '../src/client/settings/controller.js'
import type { ShortcutProfile } from '../src/client/contract/profile.js'
import type { SettingsScope, SettingsScopeSnapshot } from '@deepseek-ai/dsh-client-runtime/client'

const customBindings = [{
  command: 'openSettings' as const,
  scope: 'global' as const,
  key: { key: 's', modifiers: ['Mod'] as const },
}]

function controllerScope(initial: { activeProfile: string; customBindings?: typeof customBindings }, fail = false): SettingsScope<import('../src/settings.js').ShortcutSettings> {
  let snapshot: SettingsScopeSnapshot<import('../src/settings.js').ShortcutSettings> = {
    status: 'ready', value: { customBindings: initial.customBindings ?? standardProfile.bindings, activeProfile: initial.activeProfile },
    base: undefined, user: undefined, revision: 0, writable: true, mode: 'host',
  }
  return {
    getSnapshot: () => snapshot,
    subscribe: () => () => {},
    set: vi.fn(async (field: string, value: unknown) => {
      if (fail) throw new Error('permission denied')
      snapshot = { ...snapshot, value: { ...snapshot.value!, [field]: value } }
    }),
    unset: vi.fn(async () => {}),
  }
}

const labels: Record<string, string> = {
  'settings.title': 'Shortcuts', 'settings.description': 'Choose controls.', 'settings.profile': 'Profile',
  'settings.expand': 'Expand', 'settings.collapse': 'Collapse',
  'settings.saving': 'Saving...', 'settings.error': 'Save failed: {message}', 'settings.conflict': 'Unavailable.',
  'settings.currentProfile': 'Current profile',
  'settings.empty': 'No profiles.', 'legend.scope.question': 'Questions', 'legend.scope.approval': 'Approvals',
  'aria.profileOption': 'Shortcut profile {name}',
  'keyboard.focusPrevious': 'Previous', 'keyboard.focusNext': 'Next', 'keyboard.activate': 'Activate', 'keyboard.cancelTask': 'Cancel',
  'profile.standard.label': 'Standard', 'profile.standard.description': 'Arrows',
  'profile.vim.label': 'Vim', 'profile.vim.description': 'J/K',
  'profile.custom.label': 'Custom', 'profile.custom.description': 'Your bindings',
  'legend.scope.global': 'Global',
  'keyboard.openCommandPalette': 'Command palette', 'keyboard.openSettings': 'Settings',
  'keyboard.startSession': 'New session', 'keyboard.previousSession': 'Previous session', 'keyboard.nextSession': 'Next session',
  'keyboard.previousWorkspace': 'Previous workspace', 'keyboard.nextWorkspace': 'Next workspace', 'keyboard.forkSession': 'Fork session', 'keyboard.toggleTheme': 'Toggle theme',
  'editor.save': 'Save', 'editor.cancel': 'Cancel', 'editor.record': 'Record shortcut', 'editor.conflict': 'Shortcut conflicts with another command.', 'editor.invalid': 'Resolve shortcut conflicts before saving.', 'editor.saveFailed': 'Could not save custom shortcuts: {message}',
  'modifier.Mod': 'Mod', 'modifier.Ctrl': 'Ctrl', 'modifier.Alt': 'Alt', 'modifier.Meta': 'Meta', 'modifier.Shift': 'Shift',
}
const t = (key: string) => labels[key] ?? key
const openCard = () => fireEvent.click(screen.getByRole('button', { name: 'Expand: Shortcuts' }))

function settingsFace(initial = 'standard') {
  let active = initial
  let failure: Error | undefined
  const listeners = new Set<() => void>()
  const face: ShortcutSettingsFace & { emit: () => void; failNext: (message: string) => void; setExternal: (id: string) => void } = {
    activeProfileId: () => active,
    subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener) },
    setActiveProfile: async id => { if (failure) { const error = failure; failure = undefined; throw error } active = id; listeners.forEach(listener => listener()) },
    error: () => undefined,
    customBindings: () => standardProfile.bindings,
    setCustomBindings: async () => {},
    emit: () => listeners.forEach(listener => listener()),
    failNext: message => { failure = new Error(message) },
    setExternal: id => { active = id; listeners.forEach(listener => listener()) },
  }
  return face
}

afterEach(cleanup)

describe('shortcut settings controller custom profile', () => {
  it('loads a valid persisted custom profile before writes', async () => {
    const registry = createProfileRegistry([standardProfile, vimProfile])
    const scope = controllerScope({ activeProfile: 'standard', customBindings })
    const { createShortcutSettingsController } = await import('../src/client/settings/controller.js')
    const controller = createShortcutSettingsController(scope, registry)

    expect(controller.customBindings()).toEqual(customBindings)
    expect(registry.get('custom')?.bindings).toEqual(customBindings)
    controller.dispose()
  })

  it('falls back to a selectable custom profile when persisted custom sequences are malformed', async () => {
    const registry = createProfileRegistry([standardProfile, vimProfile])
    const scope = controllerScope({
      activeProfile: 'standard',
      customBindings: [{ command: 'openSettings', scope: 'global', sequence: [] }] as never,
    })
    const { createShortcutSettingsController } = await import('../src/client/settings/controller.js')
    const controller = createShortcutSettingsController(scope, registry)

    expect(controller.customBindings()).toEqual(standardProfile.bindings)
    expect(registry.get('custom')?.bindings).toEqual(standardProfile.bindings)
    await expect(controller.setActiveProfile('custom')).resolves.toBeUndefined()
    expect(controller.activeProfileId()).toBe('custom')
    controller.dispose()
  })

  it('defaults custom bindings from standard and replaces the custom profile after persistence', async () => {
    const registry = createProfileRegistry([standardProfile, vimProfile])
    const scope = controllerScope({ activeProfile: 'standard' })
    const { createShortcutSettingsController } = await import('../src/client/settings/controller.js')
    const controller = createShortcutSettingsController(scope, registry)

    expect(controller.customBindings()).toEqual(standardProfile.bindings)
    await controller.setCustomBindings(customBindings)
    expect(controller.customBindings()).toEqual(customBindings)
    expect(registry.get('custom')?.bindings).toEqual(customBindings)
    expect(scope.set).toHaveBeenCalledWith('customBindings', expect.any(Array))
    expect(scope.set.mock.calls[0]?.[1]).not.toBe(customBindings)
    controller.dispose()
  })

  it('preserves every physical stroke shape when replacing custom sequences', () => {
    const registry = createProfileRegistry([standardProfile, vimProfile])

    registry.replaceCustom([{
      command: 'openSettings',
      scope: 'global',
      sequence: [
        { key: 'g', alt: true, ctrl: false, meta: false, shift: false },
        { key: 's', alt: false, ctrl: true, meta: false, shift: true },
      ],
    }])

    expect(registry.get('custom')?.bindings[0]).toEqual({
      command: 'openSettings',
      scope: 'global',
      sequence: [
        { key: 'g', alt: true, ctrl: false, meta: false, shift: false },
        { key: 's', alt: false, ctrl: true, meta: false, shift: true },
      ],
    })
  })

  it('matches Host alias and modifier acceptance rules', async () => {
    const registry = createProfileRegistry([standardProfile, vimProfile])
    expect(() => registry.replaceCustom([
      { command: 'openSettings', scope: 'global', key: { key: 'Esc', modifiers: ['Mod', 'Alt'] } },
      { command: 'openCommandPalette', scope: 'global', key: { key: 'p', modifiers: ['Mod', 'Shift'] } },
    ])).not.toThrow()
    expect(() => registry.replaceCustom([
      { command: 'openSettings', scope: 'global', key: { key: 's', modifiers: ['Mod', 'Ctrl'] } },
    ])).toThrow()
    expect(() => registry.replaceCustom([
      { command: 'openSettings', scope: 'global', key: { key: 'Return', modifiers: [] } },
      { command: 'openCommandPalette', scope: 'global', key: { key: 'Enter', modifiers: [] } },
    ])).toThrow()
    expect(() => registry.replaceCustom([
      { command: 'openSettings', scope: 'global', sequences: [[{ key: 'Spacebar', modifiers: [] }], [{ key: 'Space', modifiers: [] }]] },
    ])).toThrow()
  })

  it('cancels queued custom persistence after disposal', async () => {
    const registry = createProfileRegistry([standardProfile, vimProfile])
    const scope = controllerScope({ activeProfile: 'standard' })
    const resolvers: Array<() => void> = []
    vi.mocked(scope.set).mockImplementation(async () => {
      await new Promise<void>(resolve => { resolvers.push(resolve) })
    })
    const { createShortcutSettingsController } = await import('../src/client/settings/controller.js')
    const controller = createShortcutSettingsController(scope, registry)
    const first = controller.setCustomBindings(customBindings)
    const second = controller.setCustomBindings([{ command: 'openCommandPalette', scope: 'global', key: { key: 'p', modifiers: ['Mod'] } }])
    await Promise.resolve()
    expect(resolvers).toHaveLength(1)
    controller.dispose()
    resolvers.shift()!()
    await Promise.resolve()
    expect(resolvers).toHaveLength(0)
    await expect(first).resolves.toBeUndefined()
    await expect(second).resolves.toBeUndefined()
    expect(scope.set).toHaveBeenCalledTimes(1)
    expect((scope.set.mock.calls[0]?.[1] as { command: string }[])[0]?.command).toBe('openSettings')
  })

  it('keeps the active profile and old custom bindings when persistence fails', async () => {
    const registry = createProfileRegistry([standardProfile, vimProfile])
    const scope = controllerScope({ activeProfile: 'vim', customBindings }, true)
    const { createShortcutSettingsController } = await import('../src/client/settings/controller.js')
    const controller = createShortcutSettingsController(scope, registry)

    expect(controller.activeProfileId()).toBe('vim')
    await expect(controller.setCustomBindings(standardProfile.bindings)).rejects.toThrow('permission denied')
    expect(controller.activeProfileId()).toBe('vim')
    expect(controller.customBindings()).toEqual(customBindings)
    expect(registry.get('custom')?.bindings).toEqual(customBindings)
    controller.dispose()
  })

  it('keeps the registry owned when the caller mutates submitted bindings', async () => {
    const registry = createProfileRegistry([standardProfile, vimProfile])
    const scope = controllerScope({ activeProfile: 'standard' })
    const { createShortcutSettingsController } = await import('../src/client/settings/controller.js')
    const controller = createShortcutSettingsController(scope, registry)
    const submitted = [{
      command: 'openSettings' as const,
      scope: 'global' as const,
      key: { key: 's', modifiers: ['Mod'] as const },
    }]

    await controller.setCustomBindings(submitted)
    ;(submitted[0]!.key as { modifiers: string[] }).modifiers.push('Alt')

    expect(controller.customBindings()).toEqual([{
      command: 'openSettings',
      scope: 'global',
      key: { key: 's', modifiers: ['Mod'] },
    }])
    controller.dispose()
  })

  it('publishes only the latest custom binding after serialized saves', async () => {
    const registry = createProfileRegistry([standardProfile, vimProfile])
    const scope = controllerScope({ activeProfile: 'standard' })
    const resolvers: Array<() => void> = []
    vi.mocked(scope.set).mockImplementation(async () => {
      await new Promise<void>(resolve => { resolvers.push(resolve) })
    })
    const { createShortcutSettingsController } = await import('../src/client/settings/controller.js')
    const controller = createShortcutSettingsController(scope, registry)
    const first = [{ command: 'openSettings' as const, scope: 'global' as const, key: { key: 's', modifiers: ['Mod'] as const } }]
    const second = [{ command: 'openCommandPalette' as const, scope: 'global' as const, key: { key: 'p', modifiers: ['Mod'] as const } }]

    const firstSave = controller.setCustomBindings(first)
    const secondSave = controller.setCustomBindings(second)
    await Promise.resolve()
    expect(resolvers).toHaveLength(1)
    resolvers.shift()!()
    await new Promise<void>(resolve => { setTimeout(resolve, 0) })
    expect(resolvers).toHaveLength(1)
    resolvers.shift()!()
    await Promise.all([firstSave, secondSave])

    expect(controller.customBindings()).toEqual(second)
    controller.dispose()
  })
})

describe('shortcut settings card', () => {
  it('renders platform keycaps and hides incompatible explicit modifiers', () => {
    render(<ShortcutLegend platform="mac" bindings={[
      { command: 'openSettings', scope: 'global', key: { key: 'p', modifiers: ['Ctrl'] } },
      { command: 'openCommandPalette', scope: 'global', key: { key: 'p', modifiers: ['Mod'] } },
    ]} availableGlobalActions={['openSettings', 'openCommandPalette']} t={t} />)
    expect(screen.queryByText('Settings')).toBeNull()
    expect(screen.getByText('Command palette')).toBeTruthy()
    expect(screen.getByRole('img', { name: 'Command' })).toBeTruthy()
  })

  it('allows inherited cross-scope defaults but rejects a new global duplicate', () => {
    const baseline = [
      { command: 'activate' as const, scope: 'question' as const, key: { key: 'Enter', modifiers: [] as const } },
      { command: 'activate' as const, scope: 'approval' as const, key: { key: 'Enter', modifiers: [] as const } },
    ]
    expect(findNewShortcutConflicts(baseline, baseline.map((binding, index) => ({ binding, index })), 'linux')).toEqual([])
    expect(findNewShortcutConflicts(baseline, [...baseline.map((binding, index) => ({ binding, index })), { binding: { command: 'focusNext' as const, scope: 'global' as const, key: { key: 'Enter', modifiers: [] as const } }, index: 2 }], 'linux')).toHaveLength(1)
    expect(findNewShortcutConflicts(baseline, [
      { binding: { ...baseline[0]!, command: 'focusNext' }, index: 0 },
      { binding: baseline[1]!, index: 1 },
    ], 'linux')).toHaveLength(1)
  })

  it('starts collapsed and toggles profile details with an accessible disclosure header', () => {
    const registry = createProfileRegistry([standardProfile, vimProfile])
    const settings = settingsFace()
    render(<ShortcutProfileCard settings={settings} profiles={registry.list()} availableGlobalActions={[]} t={t} />)
    const trigger = screen.getByRole('button', { name: 'Expand: Shortcuts' })
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('combobox', { name: 'Profile' })).toBeNull()
    fireEvent.click(trigger)
    expect(screen.getByRole('button', { name: 'Collapse: Shortcuts' }).getAttribute('aria-expanded')).toBe('true')
    expect((screen.getByRole('combobox', { name: 'Profile' }) as HTMLSelectElement).value).toBe('standard')
    fireEvent.click(screen.getByRole('button', { name: 'Collapse: Shortcuts' }))
    expect(screen.getByRole('button', { name: 'Expand: Shortcuts' }).getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('combobox', { name: 'Profile' })).toBeNull()
  })

  it('renders accessible radios, selected state, and legends grouped by scope', () => {
    const registry = createProfileRegistry([standardProfile, vimProfile])
    const settings = settingsFace()
    render(<ShortcutProfileCard settings={settings} profiles={registry.list()} availableGlobalActions={[]} t={t} />)
    openCard()
    expect((screen.getByRole('combobox', { name: 'Profile' }) as HTMLSelectElement).value).toBe('standard')
    expect(screen.getByText('Current profile')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Questions' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Approvals' })).toBeTruthy()
    expect(screen.getAllByText('Previous').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Activate').length).toBeGreaterThan(0)
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(2)
    const lists = screen.getAllByRole('list')
    expect(lists).toHaveLength(2)
    for (const list of lists) {
      const items = Array.from(list.querySelectorAll('[role="listitem"]'))
      expect(items.length).toBeGreaterThan(0)
      for (const item of items) {
        expect(item.textContent).toBeTruthy()
        expect(item.querySelectorAll('kbd').length).toBeGreaterThan(0)
        expect(item.querySelector('svg')).toBeTruthy()
      }
    }
  })

  it('sets vim and disables radios while save is pending', async () => {
    const registry = createProfileRegistry([standardProfile, vimProfile])
    let resolve!: () => void
    const settings = settingsFace()
    settings.setActiveProfile = vi.fn(() => new Promise<void>(r => { resolve = r }))
    render(<ShortcutProfileCard settings={settings} profiles={registry.list()} availableGlobalActions={[]} t={t} />)
    openCard()
    fireEvent.change(screen.getByRole('combobox', { name: 'Profile' }), { target: { value: 'vim' } })
    expect(settings.setActiveProfile).toHaveBeenCalledWith('vim')
    expect((screen.getByRole('group') as HTMLFieldSetElement).disabled).toBe(true)
    expect(screen.getAllByText('Saving...')).toHaveLength(2)
    resolve()
    await waitFor(() => expect((screen.getByRole('group') as HTMLFieldSetElement).disabled).toBe(false))
  })

  it('rolls back once on failure, alerts, and allows retry', async () => {
    const registry = createProfileRegistry([standardProfile, vimProfile])
    const settings = settingsFace()
    settings.failNext('no permission')
    render(<ShortcutProfileCard settings={settings} profiles={registry.list()} availableGlobalActions={[]} t={t} />)
    openCard()
    fireEvent.change(screen.getByRole('combobox', { name: 'Profile' }), { target: { value: 'vim' } })
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('no permission'))
    expect((screen.getByRole('combobox', { name: 'Profile' }) as HTMLSelectElement).value).toBe('standard')
    fireEvent.change(screen.getByRole('combobox', { name: 'Profile' }), { target: { value: 'vim' } })
    await waitFor(() => expect((screen.getByRole('combobox', { name: 'Profile' }) as HTMLSelectElement).value).toBe('vim'))
  })

  it('uses the latest external snapshot after pending failure and success', async () => {
    const registry = createProfileRegistry([standardProfile, vimProfile])
    const settings = settingsFace()
    let settle!: (error?: Error) => void
    settings.setActiveProfile = vi.fn(() => new Promise<void>((resolve, reject) => { settle = error => error ? reject(error) : resolve() }))
    render(<ShortcutProfileCard settings={settings} profiles={registry.list()} availableGlobalActions={[]} t={t} />)
    openCard()
    fireEvent.change(screen.getByRole('combobox', { name: 'Profile' }), { target: { value: 'vim' } })
    settings.setExternal('standard')
    settle(new Error('failed'))
    await waitFor(() => expect((screen.getByRole('combobox', { name: 'Profile' }) as HTMLSelectElement).value).toBe('standard'))

    let resolve!: () => void
    settings.setActiveProfile = vi.fn(() => new Promise<void>(r => { resolve = r }))
    fireEvent.change(screen.getByRole('combobox', { name: 'Profile' }), { target: { value: 'vim' } })
    settings.setExternal('standard')
    resolve()
    await waitFor(() => expect((screen.getByRole('combobox', { name: 'Profile' }) as HTMLSelectElement).value).toBe('standard'))
  })

  it('shows Custom and editor rows when selected, including global capability rows', async () => {
    const registry = createProfileRegistry([standardProfile, vimProfile])
    registry.replaceCustom([
      { command: 'activate', scope: 'question', key: { key: 'Enter', alt: false, ctrl: false, meta: false, shift: false } },
      { command: 'openCommandPalette', scope: 'global', key: { key: 'n', modifiers: ['Mod'] } },
    ])
    const settings = settingsFace()
    settings.customBindings = () => registry.custom()
    settings.setCustomBindings = vi.fn(async bindings => { registry.replaceCustom(bindings); settings.emit() })
    render(<ShortcutProfileCard settings={settings} profiles={[...registry.list()]} t={t} />)
    openCard()
    expect(screen.getByRole('option', { name: 'Custom' })).toBeTruthy()
    fireEvent.change(screen.getByRole('combobox', { name: 'Profile' }), { target: { value: 'custom' } })
    await waitFor(() => expect(screen.getByText('Command palette')).toBeTruthy())
    expect(screen.getByRole('heading', { name: 'Global' })).toBeTruthy()
    expect(screen.queryByText('Settings')).toBeNull()
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy()
  })

  it('shows capability-backed global shortcuts and exposes them in Custom editing', async () => {
    const registry = createProfileRegistry([standardProfile, vimProfile])
    const settings = settingsFace()
    settings.customBindings = () => registry.custom()
    settings.setCustomBindings = vi.fn(async bindings => { registry.replaceCustom(bindings); settings.emit() })
    const availableGlobalActions = [
      'startSession', 'previousSession', 'nextSession', 'previousWorkspace', 'nextWorkspace', 'forkSession', 'toggleTheme',
    ] as const

    render(<ShortcutProfileCard settings={settings} profiles={registry.list()} availableGlobalActions={availableGlobalActions} t={t} />)
    openCard()
    expect(screen.getByRole('heading', { name: 'Global' })).toBeTruthy()
    expect(screen.getByText('New session')).toBeTruthy()

    fireEvent.change(screen.getByRole('combobox', { name: 'Profile' }), { target: { value: 'custom' } })
    await waitFor(() => expect(screen.getByText('New session')).toBeTruthy())
    const command = screen.getByText('New session')
    const row = command.parentElement?.parentElement
    expect(row).toBeTruthy()
    const record = row?.querySelector('button')
    expect(record).toBeTruthy()
    fireEvent.click(record!)
    fireEvent.keyDown(record!, { key: 'x', ctrlKey: true })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(settings.setCustomBindings).toHaveBeenCalled())
    expect(settings.setCustomBindings).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ command: 'startSession', scope: 'global', key: { key: 'x', modifiers: ['Ctrl'] } }),
    ]))
  })

  it('keeps standard and Vim profiles read-only', () => {
    const registry = createProfileRegistry([standardProfile, vimProfile])
    const settings = settingsFace()
    render(<ShortcutProfileCard settings={settings} profiles={[...registry.list(), { id: 'custom', label: 'profile.custom.label', description: 'profile.custom.description', bindings: standardProfile.bindings }]} t={t} />)
    openCard()
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Record shortcut' })).toBeNull()
  })


  it('updates translated labels without changing profile ids or bindings', () => {
    const registry = createProfileRegistry([standardProfile, vimProfile])
    const settings = settingsFace()
    const zh = (key: string) => key === 'profile.standard.label' ? '标准' : key === 'legend.scope.question' ? '问题' : t(key)
    const { rerender } = render(<ShortcutProfileCard settings={settings} profiles={registry.list()} t={zh} />)
    openCard()
    expect((screen.getByRole('combobox', { name: 'Profile' }) as HTMLSelectElement).value).toBe('standard')
    expect(standardProfile.bindings).toHaveLength(17)
    rerender(<ShortcutProfileCard settings={settings} profiles={registry.list()} t={t} />)
    expect((screen.getByRole('combobox', { name: 'Profile' }) as HTMLSelectElement).value).toBe('standard')
  })
})

describe('shortcut icon', () => {
  it('uses a local icon object with fixed props and no network source', () => {
    render(<ShortcutIcon name="keyboard" size={20} />)
    const icon = document.querySelector('[aria-hidden="true"]')
    expect(icon).toBeTruthy()
    expect(icon?.getAttribute('width')).toBe('20')
    expect(icon?.getAttribute('height')).toBe('20')
    expect(icon?.getAttribute('data-icon')).toBeNull()
    expect(document.querySelector('img')).toBeNull()
  })
})
