// @vitest-environment jsdom
import React from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ShortcutProfileCard } from '../src/client/components/ShortcutProfileCard.js'
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

  it('falls back to standard when persisted custom sequences are malformed', async () => {
    const registry = createProfileRegistry([standardProfile, vimProfile])
    const scope = controllerScope({
      activeProfile: 'standard',
      customBindings: [{ command: 'openSettings', scope: 'global', sequence: [] }] as never,
    })
    const { createShortcutSettingsController } = await import('../src/client/settings/controller.js')
    const controller = createShortcutSettingsController(scope, registry)

    expect(controller.customBindings()).toEqual(standardProfile.bindings)
    expect(registry.get('custom')).toBeUndefined()
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
  it('starts collapsed and toggles profile details with an accessible disclosure header', () => {
    const registry = createProfileRegistry([standardProfile, vimProfile])
    const settings = settingsFace()
    render(<ShortcutProfileCard settings={settings} profiles={registry.list()} t={t} />)
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
    render(<ShortcutProfileCard settings={settings} profiles={registry.list()} t={t} />)
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
    render(<ShortcutProfileCard settings={settings} profiles={registry.list()} t={t} />)
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
    render(<ShortcutProfileCard settings={settings} profiles={registry.list()} t={t} />)
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
    render(<ShortcutProfileCard settings={settings} profiles={registry.list()} t={t} />)
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

  it('renders conflict and empty states', () => {
    const settings = settingsFace('missing')
    const registry = createProfileRegistry([standardProfile, vimProfile])
    render(<ShortcutProfileCard settings={settings} profiles={registry.list()} t={t} />)
    openCard()
    expect(screen.getByText('Unavailable.')).toBeTruthy()
    cleanup()
    render(<ShortcutProfileCard settings={settings} profiles={[]} t={t} />)
    openCard()
    expect(screen.getByText('No profiles.')).toBeTruthy()
  })

  it('updates translated labels without changing profile ids or bindings', () => {
    const registry = createProfileRegistry([standardProfile, vimProfile])
    const settings = settingsFace()
    const zh = (key: string) => key === 'profile.standard.label' ? '标准' : key === 'legend.scope.question' ? '问题' : t(key)
    const { rerender } = render(<ShortcutProfileCard settings={settings} profiles={registry.list()} t={zh} />)
    openCard()
    expect((screen.getByRole('combobox', { name: 'Profile' }) as HTMLSelectElement).value).toBe('standard')
    expect(standardProfile.bindings).toHaveLength(10)
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
