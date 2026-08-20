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

const labels: Record<string, string> = {
  'settings.title': 'Shortcuts', 'settings.description': 'Choose controls.', 'settings.profile': 'Profile',
  'settings.saving': 'Saving...', 'settings.error': 'Save failed: {message}', 'settings.conflict': 'Unavailable.',
  'settings.empty': 'No profiles.', 'legend.scope.question': 'Questions', 'legend.scope.approval': 'Approvals',
  'aria.profileOption': 'Shortcut profile {name}',
  'keyboard.focusPrevious': 'Previous', 'keyboard.focusNext': 'Next', 'keyboard.activate': 'Activate', 'keyboard.cancelTask': 'Cancel',
  'profile.standard.label': 'Standard', 'profile.standard.description': 'Arrows',
  'profile.vim.label': 'Vim', 'profile.vim.description': 'J/K',
}
const t = (key: string) => labels[key] ?? key

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

describe('shortcut settings card', () => {
  it('renders accessible radios, selected state, and legends grouped by scope', () => {
    const registry = createProfileRegistry([standardProfile, vimProfile])
    const settings = settingsFace()
    render(<ShortcutProfileCard settings={settings} profiles={registry.list()} t={t} />)
    expect((screen.getByRole('radio', { name: /Standard/ }) as HTMLInputElement).checked).toBe(true)
    expect((screen.getByRole('radio', { name: /Vim/ }) as HTMLInputElement).checked).toBe(false)
    expect(screen.getByRole('heading', { name: 'Questions' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Approvals' })).toBeTruthy()
    expect(screen.getAllByText('Previous').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Activate').length).toBeGreaterThan(0)
    expect(screen.getAllByText('ArrowUp').length).toBeGreaterThan(0)
  })

  it('sets vim and disables radios while save is pending', async () => {
    const registry = createProfileRegistry([standardProfile, vimProfile])
    let resolve!: () => void
    const settings = settingsFace()
    settings.setActiveProfile = vi.fn(() => new Promise<void>(r => { resolve = r }))
    render(<ShortcutProfileCard settings={settings} profiles={registry.list()} t={t} />)
    fireEvent.click(screen.getByRole('radio', { name: /Vim/ }))
    expect(settings.setActiveProfile).toHaveBeenCalledWith('vim')
    expect((screen.getByRole('group') as HTMLFieldSetElement).disabled).toBe(true)
    expect(screen.getByText('Saving...')).toBeTruthy()
    resolve()
    await waitFor(() => expect((screen.getByRole('group') as HTMLFieldSetElement).disabled).toBe(false))
  })

  it('rolls back once on failure, alerts, and allows retry', async () => {
    const registry = createProfileRegistry([standardProfile, vimProfile])
    const settings = settingsFace()
    settings.failNext('no permission')
    render(<ShortcutProfileCard settings={settings} profiles={registry.list()} t={t} />)
    fireEvent.click(screen.getByRole('radio', { name: /Vim/ }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('no permission'))
    expect((screen.getByRole('radio', { name: /Standard/ }) as HTMLInputElement).checked).toBe(true)
    fireEvent.click(screen.getByRole('radio', { name: /Vim/ }))
    await waitFor(() => expect((screen.getByRole('radio', { name: /Vim/ }) as HTMLInputElement).checked).toBe(true))
  })

  it('uses the latest external snapshot after pending failure and success', async () => {
    const registry = createProfileRegistry([standardProfile, vimProfile])
    const settings = settingsFace()
    let settle!: (error?: Error) => void
    settings.setActiveProfile = vi.fn(() => new Promise<void>((resolve, reject) => { settle = error => error ? reject(error) : resolve() }))
    render(<ShortcutProfileCard settings={settings} profiles={registry.list()} t={t} />)
    fireEvent.click(screen.getByRole('radio', { name: /Vim/ }))
    settings.setExternal('standard')
    settle(new Error('failed'))
    await waitFor(() => expect((screen.getByRole('radio', { name: /Standard/ }) as HTMLInputElement).checked).toBe(true))

    let resolve!: () => void
    settings.setActiveProfile = vi.fn(() => new Promise<void>(r => { resolve = r }))
    fireEvent.click(screen.getByRole('radio', { name: /Vim/ }))
    settings.setExternal('standard')
    resolve()
    await waitFor(() => expect((screen.getByRole('radio', { name: /Standard/ }) as HTMLInputElement).checked).toBe(true))
  })

  it('renders conflict and empty states', () => {
    const settings = settingsFace('missing')
    const registry = createProfileRegistry([standardProfile, vimProfile])
    render(<ShortcutProfileCard settings={settings} profiles={registry.list()} t={t} />)
    expect(screen.getByText('Unavailable.')).toBeTruthy()
    cleanup()
    render(<ShortcutProfileCard settings={settings} profiles={[]} t={t} />)
    expect(screen.getByText('No profiles.')).toBeTruthy()
  })

  it('updates translated labels without changing profile ids or bindings', () => {
    const registry = createProfileRegistry([standardProfile, vimProfile])
    const settings = settingsFace()
    const zh = (key: string) => key === 'profile.standard.label' ? '标准' : key === 'legend.scope.question' ? '问题' : t(key)
    const { rerender } = render(<ShortcutProfileCard settings={settings} profiles={registry.list()} t={zh} />)
    expect((screen.getByRole('radio', { name: /标准/ }) as HTMLInputElement).value).toBe('standard')
    expect(standardProfile.bindings).toHaveLength(8)
    rerender(<ShortcutProfileCard settings={settings} profiles={registry.list()} t={t} />)
    expect((screen.getByRole('radio', { name: /Standard/ }) as HTMLInputElement).value).toBe('standard')
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
