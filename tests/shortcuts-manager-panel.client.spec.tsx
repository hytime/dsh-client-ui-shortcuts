// @vitest-environment jsdom
import React from 'react'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ShortcutManagerPanel } from '../src/client/components/ShortcutManagerPanel.js'
import { CustomProfileEditor } from '../src/client/components/CustomProfileEditor.js'
import { createProfileRegistry } from '../src/client/profiles/registry.js'
import { standardProfile, vimProfile } from '../src/client/profiles/builtins.js'
import type { ManagedShortcutProfile, ShortcutSettingsFace, ShortcutSettingsFailure } from '../src/client/contract/settings.js'
import type { ShortcutProfile } from '../src/client/contract/profile.js'
import type { MutateShortcutSettings } from '../src/client/contract/settings.js'
import type { SettingsScope, SettingsScopeSnapshot } from '../src/client/versioned-types.js'
import { customProfileFilename, customProfileFingerprint } from '../src/custom-profile-contract.js'
import { encodeCustomProfileJson } from '../src/client/settings/custom-profile-json.js'

const customBindings = [{
  command: 'openSettings' as const,
  scope: 'global' as const,
  key: { key: 's', modifiers: ['Meta'] as const },
}]

function controllerScope(initial: { activeProfile: string; customProfiles?: import('../src/custom-profile-contract.js').PersistedCustomShortcutProfile[] }): {
  scope: SettingsScope<import('../src/settings.js').ShortcutSettings>
  mutate: MutateShortcutSettings
} {
  let snapshot: SettingsScopeSnapshot<import('../src/settings.js').ShortcutSettings> = {
    status: 'ready', value: {
      customBindings: standardProfile.bindings,
      activeProfile: initial.activeProfile,
      ...(initial.customProfiles !== undefined ? { customProfiles: initial.customProfiles } : {}),
    },
    base: undefined, user: undefined, revision: 1, writable: true, mode: 'host',
  }
  const scope: SettingsScope<import('../src/settings.js').ShortcutSettings> = {
    getSnapshot: () => snapshot,
    subscribe: () => () => {},
    set: vi.fn(async () => { throw new Error('controller must use CAS mutation port') }),
    unset: vi.fn(async () => {}),
  }
  const mutate: MutateShortcutSettings = vi.fn(async request => {
    const value = { ...snapshot.value!, [request.field]: structuredClone(request.value) }
    snapshot = { ...snapshot, value, revision: snapshot.revision + 1 }
    return {
      ok: true,
      view: { value: structuredClone(value), base: undefined, user: structuredClone(value), revision: snapshot.revision },
    }
  })
  return { scope, mutate }
}

const controllerOptions = {
  createId: () => 'test-id',
  legacyName: () => 'Custom',
}

function managedProfiles(profiles: readonly ShortcutProfile[]): ManagedShortcutProfile[] {
  return profiles.map(profile => {
    const custom = profile.id === 'custom'
    return {
      ...profile,
      kind: custom ? 'custom' : 'builtin',
      displayName: custom ? 'Custom' : profile.label,
      fingerprint: custom
        ? customProfileFingerprint({ id: profile.id, bindings: profile.bindings as never })
        : `builtin:${profile.id}`,
    }
  })
}

const labels: Record<string, string> = {
  'settings.title': 'Shortcuts', 'settings.description': 'Choose controls.', 'settings.profile': 'Profile',
  'settings.saving': 'Saving...', 'settings.error': 'Save failed: {message}', 'settings.conflict': 'Unavailable.',
  'settings.empty': 'No profiles.', 'settings.new': 'New profile', 'settings.upload': 'Import profile',
  'settings.download': 'Export profile', 'settings.delete': 'Delete profile', 'settings.fileInput': 'Choose custom profile JSON file',
  'settings.currentProfile': 'Current profile', 'settings.profileActions': 'Profile actions',
  'settings.importSucceeded': 'Profile imported.', 'settings.importPartial': 'Profile imported but could not be selected.',
  'settings.exportSucceeded': 'Profile exported.', 'settings.deleteConfirm': 'Delete this profile?',
  'settings.deleteCancel': 'Cancel delete', 'settings.deleteConfirmAction': 'Confirm delete',
  'settings.deleteSucceeded': 'Profile deleted.', 'settings.deletePartial': 'Switched to Standard, but the profile was kept.',
  'settings.exportError': 'Could not export profile: {message}', 'settings.importError': 'Could not import profile: {message}',
  'editor.onboarding.title': 'Getting started', 'editor.onboarding.close': 'Close',
  'legend.scope.question': 'Questions', 'legend.scope.approval': 'Approvals', 'legend.scope.global': 'Global',
  'keyboard.focusPrevious': 'Previous', 'keyboard.focusNext': 'Next',
  'profile.standard.label': 'Standard', 'profile.standard.description': 'Arrows',
  'profile.vim.label': 'Vim', 'profile.vim.description': 'Use J and K with Enter for questions and approvals.',
  'profile.custom.label': 'Custom', 'profile.custom.description': 'Your bindings',
  'editor.profileName': 'Profile name', 'editor.save': 'Save', 'editor.cancel': 'Cancel', 'editor.record': 'Record shortcut',
  'keyboard.openSettings': 'Settings', 'keyboard.showShortcuts': 'Show shortcuts',
}
const t = (key: string) => labels[key] ?? key

function settingsFace(initial = 'standard', initialProfiles: readonly ShortcutProfile[] = [standardProfile, vimProfile], writable = true, available = true) {
  let active = initial
  let isAvailable = available
  let latestFailure: ShortcutSettingsFailure | undefined
  let profiles = managedProfiles(initialProfiles)
  const listeners = new Set<() => void>()
  const emit = () => listeners.forEach(listener => listener())
  const face: ShortcutSettingsFace & {
    setExternal: (id: string) => void
    setProfiles: (next: readonly ShortcutProfile[]) => void
    setFailure: (failure: ShortcutSettingsFailure | undefined) => void
  } = {
    available: () => isAvailable,
    writable: () => writable,
    profiles: () => profiles,
    activeProfileId: () => active,
    isCustomProfile: id => profiles.some(profile => profile.id === id && profile.kind === 'custom'),
    createCustomProfile: async () => 'custom-created',
    importCustomProfile: async () => 'custom-imported',
    saveCustomProfile: async () => {},
    resetCustomProfile: async () => {},
    deleteCustomProfile: async () => {},
    exportActiveCustomProfile: () => { throw new Error('not configured') },
    subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener) },
    setActiveProfile: async id => { active = id; emit() },
    error: () => latestFailure,
    setExternal: id => { active = id; emit() },
    setProfiles: next => { profiles = managedProfiles(next); emit() },
    setFailure: next => { latestFailure = next; emit() },
  }
  return face
}

afterEach(cleanup)

describe('shortcut manager panel', () => {
  it('renders a profile select with all built-in profiles', () => {
    window.localStorage.clear()
    render(<ShortcutManagerPanel settings={settingsFace()} availableGlobalActions={[]} platform="linux" t={t} />)
    const select = screen.getByRole('combobox', { name: 'Profile' }) as HTMLSelectElement
    expect([...select.options].map(option => option.textContent)).toEqual(['Standard', 'Vim'])
  })

  it('creates a custom profile through the real controller and selects it', async () => {
    const registry = createProfileRegistry([standardProfile, vimProfile])
    const scope = controllerScope({ activeProfile: 'standard' })
    const { createShortcutSettingsController } = await import('../src/client/settings/controller.js')
    const controller = createShortcutSettingsController(scope.scope, registry, scope.mutate, controllerOptions)
    render(<ShortcutManagerPanel settings={controller} availableGlobalActions={[]} platform="linux" t={t} />)

    fireEvent.click(screen.getByRole('button', { name: 'New profile' }))
    await waitFor(() => expect((screen.getByRole('combobox', { name: 'Profile' }) as HTMLSelectElement).value).toBe('custom-test-id'))
    controller.dispose()
  })

  it('imports a decoded JSON profile and reports success', async () => {
    const registry = createProfileRegistry([standardProfile, vimProfile])
    const scope = controllerScope({ activeProfile: 'standard' })
    let nextId = 0
    const { createShortcutSettingsController } = await import('../src/client/settings/controller.js')
    const controller = createShortcutSettingsController(scope.scope, registry, scope.mutate, {
      createId: () => `test-${++nextId}`,
      legacyName: () => 'Custom',
    })
    render(<ShortcutManagerPanel settings={controller} availableGlobalActions={[]} platform="linux" t={t} />)

    const file = new File([encodeCustomProfileJson({ name: 'Imported', bindings: customBindings })], 'profile.json', { type: 'application/json' })
    fireEvent.change(screen.getByLabelText('Choose custom profile JSON file'), { target: { files: [file] } })

    await waitFor(() => expect((screen.getByRole('combobox', { name: 'Profile' }) as HTMLSelectElement).value).toBe('custom-test-1'))
    expect(screen.getByRole('status').textContent).toContain('Profile imported.')
    controller.dispose()
  })

  it('exports the active custom profile as a JSON download', async () => {
    window.localStorage.clear()
    const registry = createProfileRegistry([standardProfile, vimProfile])
    registry.replaceCustomProfiles([{ id: 'custom', name: 'Work', bindings: customBindings }])
    const settings = settingsFace('custom', registry.list())
    settings.exportActiveCustomProfile = vi.fn(() => ({ name: 'Work', bindings: customBindings }))
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:work')
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.download).toBe(customProfileFilename('Work'))
    })
    render(<ShortcutManagerPanel settings={settings} availableGlobalActions={[]} platform="linux" t={t} />)

    fireEvent.click(screen.getByRole('button', { name: 'Export profile' }))

    await waitFor(() => expect(settings.exportActiveCustomProfile).toHaveBeenCalledOnce())
    expect(createObjectURL).toHaveBeenCalledOnce()
    expect(click).toHaveBeenCalledOnce()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:work')
    expect(screen.getByRole('status').textContent).toContain('Profile exported.')
  })

  it('requires confirmation before deleting an active custom profile and switches back to Standard', async () => {
    const registry = createProfileRegistry([standardProfile, vimProfile])
    const scope = controllerScope({
      activeProfile: 'custom-delete',
      customProfiles: [{ id: 'custom-delete', name: 'Work', bindings: customBindings }],
    })
    const { createShortcutSettingsController } = await import('../src/client/settings/controller.js')
    const controller = createShortcutSettingsController(scope.scope, registry, scope.mutate, controllerOptions)
    const deleteProfile = vi.spyOn(controller, 'deleteCustomProfile')
    render(<ShortcutManagerPanel settings={controller} availableGlobalActions={[]} platform="linux" t={t} />)

    expect(screen.queryByText('Delete this profile?')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Delete profile' }))
    expect(screen.getByText('Delete this profile?')).toBeTruthy()
    expect(deleteProfile).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }))
    await waitFor(() => expect((screen.getByRole('combobox', { name: 'Profile' }) as HTMLSelectElement).value).toBe('standard'))
    controller.dispose()
  })

  it('shows the binding editor for a custom profile and the legend for a built-in', () => {
    window.localStorage.clear()
    const registry = createProfileRegistry([standardProfile, vimProfile])
    registry.replaceCustomProfiles([{ id: 'custom', name: 'Work', bindings: customBindings }])
    const settings = settingsFace('custom', registry.list())
    render(<ShortcutManagerPanel settings={settings} availableGlobalActions={[]} platform="linux" t={t} />)
    expect(screen.getByRole('textbox', { name: 'Profile name' })).toBeTruthy()
    cleanup()

    const standard = settingsFace('standard')
    render(<ShortcutManagerPanel settings={standard} availableGlobalActions={[]} platform="linux" t={t} />)
    expect(screen.queryByRole('textbox', { name: 'Profile name' })).toBeNull()
    expect(screen.getByRole('heading', { name: 'Questions' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Approvals' })).toBeTruthy()
  })

  it('owns one searchable built-in binding list by default', () => {
    window.localStorage.clear()
    const standard = settingsFace('standard')
    render(<ShortcutManagerPanel settings={standard} availableGlobalActions={['showShortcuts']} platform="linux" t={t} />)
    expect(screen.getByRole('searchbox')).toBeTruthy()
    expect(screen.getByRole('searchbox').parentElement?.querySelector('svg')).not.toBeNull()
    expect(screen.getByRole('heading', { name: 'Questions' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Approvals' })).toBeTruthy()
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Show shortcuts' } })
    expect(screen.getByText('Show shortcuts')).toBeTruthy()
    expect(screen.queryByText('Previous')).toBeNull()
  })

  it('filters the selected profile without searching other profiles', () => {
    window.localStorage.clear()
    const custom = { ...standardProfile, id: 'custom', label: 'Custom', description: '', kind: 'custom' as const, displayName: 'Custom', fingerprint: 'custom:custom' }
    const settings = settingsFace('standard', [standardProfile, custom])
    render(<ShortcutManagerPanel settings={settings} availableGlobalActions={['showShortcuts']} platform="linux" t={t} />)
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Show shortcuts' } })
    expect(screen.getByText('Show shortcuts')).toBeTruthy()
    expect(screen.queryByText('Previous')).toBeNull()
    fireEvent.change(screen.getByRole('combobox', { name: 'Profile' }), { target: { value: 'custom' } })
    expect(screen.getByText('Show shortcuts')).toBeTruthy()
  })
  it('filters custom editor rows without dropping hidden bindings', () => {
    window.localStorage.clear()
    const registry = createProfileRegistry([standardProfile, vimProfile])
    registry.replaceCustomProfiles([{ id: 'custom', name: 'Work', bindings: standardProfile.bindings as never }])
    const settings = settingsFace('custom', registry.list())
    render(<ShortcutManagerPanel settings={settings} availableGlobalActions={['showShortcuts']} platform="linux" t={t} />)
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Show shortcuts' } })
    expect(screen.getAllByText('Show shortcuts').length).toBeGreaterThan(0)
    expect(screen.queryByText('Previous')).toBeNull()
  })
  it('surfaces a structured save failure from the settings face', () => {
    window.localStorage.clear()
    const settings = settingsFace()
    settings.setFailure({ code: 'NOT_APPLIED', operation: 'save', phase: 'collection', message: 'permission denied' })
    render(<ShortcutManagerPanel settings={settings} availableGlobalActions={[]} platform="linux" t={t} />)
    expect(screen.getByRole('alert').textContent).toContain('Save failed: permission denied')
  })

  it('portals custom reset and save actions into the external footer', async () => {
    window.localStorage.clear()
    const registry = createProfileRegistry([standardProfile, vimProfile])
    registry.replaceCustomProfiles([{ id: 'custom', name: 'Work', bindings: standardProfile.bindings as never }])
    const settings = settingsFace('custom', registry.list())
    const save = vi.spyOn(settings, 'saveCustomProfile')
    render(<ShortcutManagerPanel settings={settings} availableGlobalActions={['showShortcuts']} platform="linux" t={t} />)

    const footer = await waitFor(() => {
      const element = document.querySelector('[class*="managerFooter"]')
      expect(element).not.toBeNull()
      return element as HTMLElement
    })
    expect(within(footer).getByRole('button', { name: 'Save' })).toBeTruthy()
    expect(within(footer).getByRole('button', { name: 'Cancel' })).toBeTruthy()
    expect(within(footer).getByRole('button', { name: 'editor.reset' })).toBeTruthy()
    const content = document.querySelector('[class*="managerContent"]') as HTMLElement
    expect(within(content).queryByRole('button', { name: 'Save' })).toBeNull()

    fireEvent.change(screen.getByRole('textbox', { name: 'Profile name' }), { target: { value: 'Renamed' } })
    fireEvent.click(within(footer).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(save).toHaveBeenCalledOnce())
  })

  it('does not create an empty footer for a built-in profile', () => {
    window.localStorage.clear()
    render(<ShortcutManagerPanel settings={settingsFace('standard')} availableGlobalActions={[]} platform="linux" t={t} />)
    expect(document.querySelector('[class*="managerFooter"]')).toBeNull()
  })

  it('keeps custom editor actions inline when no portal target is provided', () => {
    window.localStorage.clear()
    const profile = {
      id: 'custom', name: 'Work', bindings: standardProfile.bindings, fingerprint: 'custom:work',
    }
    render(<CustomProfileEditor
      profile={profile}
      availableGlobalActions={['showShortcuts']}
      platform="linux"
      t={t}
      onSave={async next => ({ ...profile, ...next })}
      onReset={async () => profile}
      onStateChange={vi.fn()}
    />)
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy()
  })
})
