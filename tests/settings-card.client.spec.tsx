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
import type {
  ManagedShortcutProfile,
  ShortcutSettingsFace,
  ShortcutSettingsFailure,
} from '../src/client/contract/settings.js'
import type { ShortcutProfile } from '../src/client/contract/profile.js'
import type { MutateShortcutSettings } from '../src/client/contract/settings.js'
import type { SettingsScope, SettingsScopeSnapshot } from '@deepseek-ai/dsh-client-runtime/client'
import { customProfileFilename, customProfileFingerprint } from '../src/custom-profile-contract.js'
import { encodeCustomProfileJson } from '../src/client/settings/custom-profile-json.js'

const customBindings = [{
  command: 'openSettings' as const,
  scope: 'global' as const,
  key: { key: 's', modifiers: ['Meta'] as const },
}]

function controllerScope(initial: { activeProfile: string; customBindings?: typeof customBindings; customProfiles?: import('../src/custom-profile-contract.js').PersistedCustomShortcutProfile[] }, fail = false): {
  scope: SettingsScope<import('../src/settings.js').ShortcutSettings>
  mutate: MutateShortcutSettings
} {
  let snapshot: SettingsScopeSnapshot<import('../src/settings.js').ShortcutSettings> = {
    status: 'ready', value: {
      customBindings: initial.customBindings ?? standardProfile.bindings,
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
    if (fail) return { ok: false, kind: 'rejected', message: 'permission denied' }
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
  'settings.expand': 'Expand', 'settings.collapse': 'Collapse',
  'settings.saving': 'Saving...', 'settings.error': 'Save failed: {message}', 'settings.conflict': 'Unavailable.',
  'editor.onboarding.title': 'Getting started', 'editor.onboarding.standardVim': 'Standard and Vim are built-in read-only profiles.', 'editor.onboarding.customProfiles': 'You can create multiple Custom profiles and switch between them.', 'editor.onboarding.jsonProfiles': 'Import or export one Custom profile as JSON.', 'editor.onboarding.new': 'New', 'editor.onboarding.import': 'Import', 'editor.onboarding.close': 'Close',
  'settings.currentProfile': 'Current profile', 'settings.profileActions': 'Profile actions',
  'settings.empty': 'No profiles.', 'settings.new': 'New profile', 'settings.upload': 'Import profile',
  'settings.download': 'Export profile', 'settings.delete': 'Delete profile', 'settings.fileInput': 'Choose custom profile JSON file',
  'settings.importSucceeded': 'Profile imported.', 'settings.importPartial': 'Profile imported but could not be selected.',
  'settings.exportSucceeded': 'Profile exported.', 'settings.deleteConfirm': 'Delete this profile?',
  'settings.deleteCancel': 'Cancel delete', 'settings.deleteConfirmAction': 'Confirm delete',
  'settings.deleteSucceeded': 'Profile deleted.', 'settings.deletePartial': 'Switched to Standard, but the profile was kept.',
  'settings.unsavedExport': 'Save changes before exporting.', 'settings.externalExport': 'Load the latest profile before exporting.',
  'settings.fileError': 'Could not read profile file: {message}', 'settings.importError': 'Could not import profile: {message}',
  'settings.exportError': 'Could not export profile: {message}', 'settings.deleteError': 'Could not delete profile: {message}',
  'legend.scope.question': 'Questions', 'legend.scope.approval': 'Approvals',
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
  'editor.profileName': 'Profile name', 'editor.nameCount': '{count} / 64', 'editor.externalChange': 'This profile was updated elsewhere.', 'editor.loadLatest': 'Load latest',
  'modifier.Meta': 'Meta', 'modifier.Ctrl': 'Ctrl', 'modifier.Alt': 'Alt', 'modifier.Shift': 'Shift',
}
const t = (key: string) => labels[key] ?? key
const openCard = () => fireEvent.click(screen.getByRole('button', { name: 'Expand: Shortcuts' }))

function settingsFace(initial = 'standard', initialProfiles: readonly ShortcutProfile[] = [standardProfile, vimProfile], writable = true, available = true) {
  let active = initial
  let failure: Error | undefined
  let latestFailure: ShortcutSettingsFailure | undefined
  let profiles = managedProfiles(initialProfiles)
  const listeners = new Set<() => void>()
  const emit = () => listeners.forEach(listener => listener())
  const face: ShortcutSettingsFace & {
    emit: () => void
    failNext: (message: string) => void
    setExternal: (id: string) => void
    setFailure: (failure: ShortcutSettingsFailure | undefined) => void
    setProfiles: (next: readonly ShortcutProfile[]) => void
  } = {
    available: () => available,
    writable: () => writable,
    profiles: () => profiles,
    activeProfileId: () => active,
    isCustomProfile: id => profiles.some(profile => profile.id === id && profile.kind === 'custom'),
    createCustomProfile: async () => 'custom-created',
    importCustomProfile: async () => 'custom-imported',
    saveCustomProfile: async (id, _baseline, name, bindings) => {
      profiles = profiles.map(profile => profile.id === id ? {
        ...profile,
        displayName: name ?? 'Custom',
        ...(name !== undefined ? { persistedName: name } : {}),
        bindings,
        fingerprint: customProfileFingerprint({ id, ...(name !== undefined ? { name } : {}), bindings: bindings as never }),
      } : profile)
      emit()
    },
    deleteCustomProfile: async () => {},
    exportActiveCustomProfile: () => { throw new Error('not configured') },
    subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener) },
    setActiveProfile: async id => {
      if (failure) {
        const error = failure
        failure = undefined
        throw error
      }
      active = id
      emit()
    },
    error: () => latestFailure,
    emit,
    failNext: message => { failure = new Error(message) },
    setExternal: id => { active = id; emit() },
    setFailure: next => { latestFailure = next; emit() },
    setProfiles: next => { profiles = managedProfiles(next); emit() },
  }
  return face
}

function legacyProfile(settings: ShortcutSettingsFace): ManagedShortcutProfile {
  return settings.profiles().find(profile => profile.id === 'custom')!
}

function saveLegacyProfile(settings: ShortcutSettingsFace, bindings: readonly ShortcutProfile['bindings'][number][]): Promise<void> {
  const profile = legacyProfile(settings)
  return settings.saveCustomProfile(
    profile.id,
    profile.fingerprint,
    profile.persistedName,
    bindings,
  )
}

afterEach(cleanup)

describe('shortcut settings controller custom profile', () => {
  it('loads a valid persisted custom profile before writes', async () => {
    const registry = createProfileRegistry([standardProfile, vimProfile])
    const scope = controllerScope({ activeProfile: 'standard', customBindings })
    const { createShortcutSettingsController } = await import('../src/client/settings/controller.js')
    const controller = createShortcutSettingsController(scope.scope, registry, scope.mutate, controllerOptions)

    expect(legacyProfile(controller).bindings).toEqual(customBindings)
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
    const controller = createShortcutSettingsController(scope.scope, registry, scope.mutate, controllerOptions)

    expect(legacyProfile(controller).bindings).toEqual(standardProfile.bindings)
    expect(registry.get('custom')?.bindings).toEqual(standardProfile.bindings)
    await expect(controller.setActiveProfile('custom')).resolves.toBeUndefined()
    expect(controller.activeProfileId()).toBe('custom')
    controller.dispose()
  })

  it('defaults custom bindings from standard and replaces the custom profile after persistence', async () => {
    const registry = createProfileRegistry([standardProfile, vimProfile])
    const scope = controllerScope({ activeProfile: 'standard' })
    const { createShortcutSettingsController } = await import('../src/client/settings/controller.js')
    const controller = createShortcutSettingsController(scope.scope, registry, scope.mutate, controllerOptions)

    expect(legacyProfile(controller).bindings).toEqual(standardProfile.bindings)
    await saveLegacyProfile(controller, customBindings)
    expect(legacyProfile(controller).bindings).toEqual(customBindings)
    expect(registry.get('custom')?.bindings).toEqual(customBindings)
    expect(scope.mutate).toHaveBeenCalledWith(expect.objectContaining({ field: 'customProfiles', value: expect.any(Array) }))
    expect((vi.mocked(scope.mutate).mock.calls[0]?.[0].value as unknown[])[0]).not.toBe(customBindings)
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
      { command: 'openSettings', scope: 'global', key: { key: 'Esc', modifiers: ['Meta', 'Alt'] } },
      { command: 'openCommandPalette', scope: 'global', key: { key: 'p', modifiers: ['Meta', 'Shift'] } },
    ])).not.toThrow()
    expect(() => registry.replaceCustom([
      { command: 'openSettings', scope: 'global', key: { key: 's', modifiers: ['Meta', 'Ctrl'] } },
    ])).not.toThrow()
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
    vi.mocked(scope.mutate).mockImplementation(async request => {
      await new Promise<void>(resolve => { resolvers.push(resolve) })
      return {
        ok: true,
        view: {
          value: { ...scope.scope.getSnapshot().value!, [request.field]: structuredClone(request.value) },
          base: undefined,
          user: undefined,
          revision: request.expectedRevision + 1,
        },
      }
    })
    const { createShortcutSettingsController } = await import('../src/client/settings/controller.js')
    const controller = createShortcutSettingsController(scope.scope, registry, scope.mutate, controllerOptions)
    const baseline = legacyProfile(controller)
    const first = controller.saveCustomProfile(
      baseline.id,
      baseline.fingerprint,
      baseline.persistedName,
      customBindings,
    )
    const second = controller.saveCustomProfile(
      baseline.id,
      baseline.fingerprint,
      baseline.persistedName,
      [{ command: 'openCommandPalette', scope: 'global', key: { key: 'p', modifiers: ['Meta'] } }],
    )
    await Promise.resolve()
    expect(resolvers).toHaveLength(1)
    controller.dispose()
    resolvers.shift()!()
    await Promise.resolve()
    expect(resolvers).toHaveLength(0)
    await expect(first).resolves.toBeUndefined()
    await expect(second).resolves.toBeUndefined()
    expect(scope.mutate).toHaveBeenCalledTimes(1)
    expect((vi.mocked(scope.mutate).mock.calls[0]?.[0].value as Array<{ bindings: Array<{ command: string }> }>)[0]?.bindings[0]?.command).toBe('openSettings')
  })

  it('keeps the active profile and old custom bindings when persistence fails', async () => {
    const registry = createProfileRegistry([standardProfile, vimProfile])
    const scope = controllerScope({ activeProfile: 'vim', customBindings }, true)
    const { createShortcutSettingsController } = await import('../src/client/settings/controller.js')
    const controller = createShortcutSettingsController(scope.scope, registry, scope.mutate, controllerOptions)

    expect(controller.activeProfileId()).toBe('vim')
    await expect(saveLegacyProfile(controller, standardProfile.bindings)).rejects.toThrow('permission denied')
    expect(controller.activeProfileId()).toBe('vim')
    expect(legacyProfile(controller).bindings).toEqual(customBindings)
    expect(registry.get('custom')?.bindings).toEqual(customBindings)
    controller.dispose()
  })

  it('keeps the registry owned when the caller mutates submitted bindings', async () => {
    const registry = createProfileRegistry([standardProfile, vimProfile])
    const scope = controllerScope({ activeProfile: 'standard' })
    const { createShortcutSettingsController } = await import('../src/client/settings/controller.js')
    const controller = createShortcutSettingsController(scope.scope, registry, scope.mutate, controllerOptions)
    const submitted = [{
      command: 'openSettings' as const,
      scope: 'global' as const,
      key: { key: 's', modifiers: ['Meta'] as const },
    }]

    await saveLegacyProfile(controller, submitted)
    ;(submitted[0]!.key as { modifiers: string[] }).modifiers.push('Alt')

    expect(legacyProfile(controller).bindings).toEqual([{
      command: 'openSettings',
      scope: 'global',
      key: { key: 's', modifiers: ['Meta'] },
    }])
    controller.dispose()
  })

  it('publishes only the latest state after serialized generations', async () => {
    const registry = createProfileRegistry([standardProfile, vimProfile])
    const scope = controllerScope({ activeProfile: 'standard' })
    const persist = vi.mocked(scope.mutate).getMockImplementation()!
    const resolvers: Array<() => void> = []
    vi.mocked(scope.mutate).mockImplementation(async request => {
      await new Promise<void>(resolve => { resolvers.push(resolve) })
      return persist(request)
    })
    const { createShortcutSettingsController } = await import('../src/client/settings/controller.js')
    const controller = createShortcutSettingsController(scope.scope, registry, scope.mutate, controllerOptions)
    const listener = vi.fn()
    controller.subscribe(listener)

    const firstWrite = controller.setActiveProfile('vim')
    const secondWrite = controller.setActiveProfile('standard')
    await Promise.resolve()
    expect(resolvers).toHaveLength(1)
    resolvers.shift()!()
    await new Promise<void>(resolve => { setTimeout(resolve, 0) })
    expect(resolvers).toHaveLength(1)
    expect(listener).not.toHaveBeenCalled()
    resolvers.shift()!()
    await Promise.all([firstWrite, secondWrite])

    expect(controller.activeProfileId()).toBe('standard')
    expect(listener).toHaveBeenCalledTimes(1)
    controller.dispose()
  })
})

describe('shortcut settings card', () => {
  it('does not show onboarding when settings are unavailable', () => {
    window.localStorage.clear()
    render(<ShortcutProfileCard settings={settingsFace('standard', [standardProfile, vimProfile], true, false)} availableGlobalActions={[]} platform="linux" t={t} />)
    expect(screen.getByRole('button', { name: 'Collapse: Shortcuts' })).toBeTruthy()
    expect(screen.queryByRole('region', { name: 'Getting started' })).toBeNull()
  })

  it('keeps onboarding visible but disables writes for ready readonly settings', () => {
    window.localStorage.clear()
    render(<ShortcutProfileCard settings={settingsFace('standard', [standardProfile, vimProfile], false)} availableGlobalActions={[]} platform="linux" t={t} />)
    expect(screen.getByRole('region', { name: 'Getting started' })).toBeTruthy()
    expect((screen.getByRole('button', { name: 'New' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Import' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('closes onboarding and writes its completion marker', () => {
    window.localStorage.clear()
    render(<ShortcutProfileCard settings={settingsFace()} availableGlobalActions={[]} platform="linux" t={t} />)
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(window.localStorage.getItem('dsh-client-ui-shortcuts:onboarding:v1')).toBe('completed')
    expect(screen.queryByRole('region', { name: 'Getting started' })).toBeNull()
  })

  it('marks New onboarding action complete only after create succeeds', async () => {
    window.localStorage.clear()
    const settings = settingsFace()
    settings.createCustomProfile = vi.fn(async () => 'created')
    render(<ShortcutProfileCard settings={settings} availableGlobalActions={[]} platform="linux" t={t} />)
    fireEvent.click(screen.getByRole('button', { name: 'New' }))
    await waitFor(() => expect(settings.createCustomProfile).toHaveBeenCalledOnce())
    expect(window.localStorage.getItem('dsh-client-ui-shortcuts:onboarding:v1')).toBe('completed')
  })

  it('keeps onboarding after Import cancel, read, decode, and controller failures', async () => {
    const scenarios = [
      { file: undefined, setup: (_settings: ReturnType<typeof settingsFace>) => {} },
      { file: Object.assign(new File(['x'], 'bad.json'), { text: vi.fn().mockRejectedValue(new Error('read failed')) }), setup: (_settings: ReturnType<typeof settingsFace>) => {} },
      { file: new File(['{}'], 'bad.json'), setup: (_settings: ReturnType<typeof settingsFace>) => {} },
      { file: new File([encodeCustomProfileJson({ name: 'Imported', bindings: customBindings })], 'bad.json'), setup: (settings: ReturnType<typeof settingsFace>) => { settings.importCustomProfile = vi.fn().mockRejectedValue(new Error('controller failed')) } },
    ] as const
    for (const scenario of scenarios) {
      cleanup()
      window.localStorage.clear()
      const settings = settingsFace()
      scenario.setup(settings)
      render(<ShortcutProfileCard settings={settings} availableGlobalActions={[]} platform="linux" t={t} />)
      const input = screen.getByLabelText('Choose custom profile JSON file') as HTMLInputElement
      if (scenario.file === undefined) fireEvent.change(input, { target: { files: [] } })
      else fireEvent.change(input, { target: { files: [scenario.file] } })
      if (scenario.file !== undefined) await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())
      expect(window.localStorage.getItem('dsh-client-ui-shortcuts:onboarding:v1')).toBeNull()
    }
  })

  it('marks Import complete after success and profile-saved partial success', async () => {
    for (const partial of [false, true]) {
      window.localStorage.clear()
      const settings = settingsFace()
      settings.importCustomProfile = vi.fn(async () => {
        if (partial) {
          settings.setFailure({ code: 'NOT_APPLIED', operation: 'import', phase: 'selection', message: 'selection failed', partial: 'profile-saved' })
          throw new Error('selection failed')
        }
        return 'imported'
      })
      render(<ShortcutProfileCard settings={settings} availableGlobalActions={[]} platform="linux" t={t} />)
      fireEvent.change(screen.getByLabelText('Choose custom profile JSON file'), { target: { files: [new File([encodeCustomProfileJson({ name: 'Imported', bindings: customBindings })], 'profile.json')] } })
      await waitFor(() => expect(settings.importCustomProfile).toHaveBeenCalledOnce())
      await waitFor(() => expect(window.localStorage.getItem('dsh-client-ui-shortcuts:onboarding:v1')).toBe('completed'))
      cleanup()
    }
  })

  it('survives a localStorage getter failure while rendering onboarding', () => {
    const descriptor = Object.getOwnPropertyDescriptor(window, 'localStorage')
    Object.defineProperty(window, 'localStorage', { configurable: true, get: () => { throw new Error('blocked') } })
    try {
      expect(() => render(<ShortcutProfileCard settings={settingsFace()} availableGlobalActions={[]} platform="linux" t={t} />)).not.toThrow()
      expect(screen.getByRole('region', { name: 'Getting started' })).toBeTruthy()
    } finally {
      if (descriptor) Object.defineProperty(window, 'localStorage', descriptor)
    }
  })

  it('opens the card and renders first-use onboarding on the first visit', () => {
    window.localStorage.clear()
    render(<ShortcutProfileCard settings={settingsFace()} availableGlobalActions={[]} platform="linux" t={t} />)
    expect(screen.getByRole('button', { name: 'Collapse: Shortcuts' })).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Getting started' })).toBeTruthy()
  })

  it('keeps the card collapsed after onboarding is completed', () => {
    window.localStorage.setItem('dsh-client-ui-shortcuts:onboarding:v1', 'completed')
    render(<ShortcutProfileCard settings={settingsFace()} availableGlobalActions={[]} platform="linux" t={t} />)
    expect(screen.getByRole('button', { name: 'Expand: Shortcuts' })).toBeTruthy()
    expect(screen.queryByRole('region', { name: 'Getting started' })).toBeNull()
  })

  it('renders platform keycaps with explicit physical modifiers', () => {
    render(<ShortcutLegend platform="mac" bindings={[
      { command: 'openSettings', scope: 'global', key: { key: 'p', modifiers: ['Ctrl'] } },
      { command: 'openCommandPalette', scope: 'global', key: { key: 'p', modifiers: ['Meta'] } },
    ]} availableGlobalActions={['openSettings', 'openCommandPalette']} t={t} />)
    expect(screen.getByText('Settings')).toBeTruthy()
    expect(screen.getByText('Command palette', { exact: true })).toBeTruthy()
    expect(screen.getAllByRole('img', { name: 'Command' }).length).toBeGreaterThan(0)
  })

  it('renders every explicit alternative sequence', () => {
    render(<ShortcutLegend platform="mac" bindings={[{ command: 'openSettings', scope: 'global', sequences: [[{ key: 'g', modifiers: ['Meta'] }, { key: 's', modifiers: ['Meta'] }], [{ key: 'p', modifiers: ['Meta'] }, { key: 'o', modifiers: ['Meta'] }]] }, { command: 'openCommandPalette', scope: 'global', sequence: [{ key: 'x', modifiers: ['Meta'] }, { key: 'y', modifiers: ['Ctrl'] }] }]} availableGlobalActions={['openSettings', 'openCommandPalette']} t={t} />)
    expect(screen.getAllByText('Settings')).toHaveLength(2)
    expect(screen.getAllByRole('img', { name: 'Command' })).toHaveLength(5)
    expect(screen.getAllByRole('img', { name: 'S' })).toHaveLength(1)
    expect(screen.getAllByRole('img', { name: 'O' })).toHaveLength(1)
    expect(screen.getByText('Command palette', { exact: true })).toBeTruthy()
  })

  it('allows inherited cross-scope defaults but rejects a new global duplicate', () => {
    const baseline = [
      { command: 'activate' as const, scope: 'question' as const, key: { key: 'Enter', alt: false, ctrl: false, meta: false, shift: false } },
      { command: 'activate' as const, scope: 'approval' as const, key: { key: 'Enter', alt: false, ctrl: false, meta: false, shift: false } },
    ]
    expect(findNewShortcutConflicts(baseline, baseline.map((binding, index) => ({ binding, index })))).toEqual([])
    expect(findNewShortcutConflicts(baseline, [...baseline.map((binding, index) => ({ binding, index })), { binding: { command: 'focusNext' as const, scope: 'global' as const, key: { key: 'Enter', alt: false, ctrl: false, meta: false, shift: false } }, index: 2 }])).toHaveLength(1)
    expect(findNewShortcutConflicts(baseline, [...baseline.map((binding, index) => ({ binding, index })), { binding: { command: 'focusNext' as const, scope: 'global' as const, key: { key: 'Enter', alt: false, ctrl: false, meta: false, shift: false } }, index: 2 }, { binding: { command: 'focusNext' as const, scope: 'global' as const, key: { key: 'Enter', alt: false, ctrl: false, meta: false, shift: false } }, index: 3 }])).toHaveLength(2)
    expect(findNewShortcutConflicts(baseline, [
      ...baseline.map((binding, index) => ({ binding, index })),
      { binding: { command: 'focusNext' as const, scope: 'global' as const, key: { key: 'Enter', alt: false, ctrl: false, meta: false, shift: false } }, index: 2 },
      { binding: { command: 'focusPrevious' as const, scope: 'global' as const, key: { key: 'Enter', alt: false, ctrl: false, meta: false, shift: false } }, index: 3 },
    ])).toHaveLength(2)
    expect(findNewShortcutConflicts(baseline, [
      ...baseline.map((binding, index) => ({ binding, index })),
      { binding: { command: 'focusNext' as const, scope: 'question' as const, sequence: [{ key: 'Enter', modifiers: ['Shift'] as const }, { key: 'x', modifiers: ['Shift'] as const }] }, index: 2 },
      { binding: { command: 'focusPrevious' as const, scope: 'approval' as const, sequence: [{ key: 'Enter', modifiers: ['Shift'] as const }, { key: 'y', modifiers: ['Shift'] as const }] }, index: 3 },
    ])).toHaveLength(0)
    expect(findNewShortcutConflicts(baseline, [
      { binding: { ...baseline[0]!, command: 'focusNext' }, index: 0 },
      { binding: baseline[1]!, index: 1 },
    ])).toHaveLength(1)
  })

  it('compares explicit physical modifiers independently of platform', () => {
    const make = (scope: 'question' | 'approval', key: unknown) => ({ command: 'activate' as const, scope, key })
    const baseline = [make('question', { key: 'k', modifiers: ['Meta'] as const }), make('approval', { key: 'k', alt: false, ctrl: false, meta: true, shift: false })]
    const changedChord = { command: 'activate' as const, scope: 'question' as const, sequence: [{ key: 'k', modifiers: ['Meta'] as const }, { key: 'x', modifiers: ['Alt'] as const }] }
    expect(findNewShortcutConflicts(baseline, baseline.map((binding, index) => ({ binding, index })))).toEqual([])
    expect(findNewShortcutConflicts(baseline, [{ binding: { ...baseline[0]!, key: { key: 'k', modifiers: ['Meta'] as const } }, index: 0 }, { binding: { ...baseline[1]!, key: { key: 'k', modifiers: ['Alt'] as const } }, index: 1 }])).toHaveLength(0)
    expect(findNewShortcutConflicts(baseline, [{ binding: changedChord, index: 0 }, { binding: baseline[1]!, index: 1 }])).toHaveLength(1)
  })
  it('normalizes symbolic and physical modifiers into the same platform-independent identity', () => {
    const symbolicCtrl = { command: 'activate' as const, scope: 'question' as const, key: { key: 'a', modifiers: ['Ctrl'] as const } }
    const physicalMeta = { command: 'activate' as const, scope: 'approval' as const, key: { key: 'a', alt: false, ctrl: false, meta: true, shift: false } }
    const sequenceCtrl = { command: 'activate' as const, scope: 'question' as const, sequence: [{ key: 'c', modifiers: ['Shift'] as const }, { key: 'd', modifiers: ['Ctrl'] as const }] }
    const sequencesMeta = { command: 'activate' as const, scope: 'approval' as const, sequences: [[{ key: 'c', alt: false, ctrl: false, meta: false, shift: true }, { key: 'd', alt: false, ctrl: false, meta: true, shift: false }]] }

    expect(findNewShortcutConflicts([], [
      { binding: symbolicCtrl, index: 0 },
      { binding: { ...symbolicCtrl, scope: 'approval' }, index: 1 },
    ])).toHaveLength(1)
    expect(findNewShortcutConflicts([], [
      { binding: symbolicCtrl, index: 0 },
      { binding: { ...symbolicCtrl, scope: 'approval' }, index: 1 },
    ])).toHaveLength(1)
    expect(findNewShortcutConflicts([], [
      { binding: physicalMeta, index: 0 },
      { binding: { ...physicalMeta, scope: 'question' }, index: 1 },
    ])).toHaveLength(1)
    expect(findNewShortcutConflicts([], [
      { binding: physicalMeta, index: 0 },
      { binding: { ...physicalMeta, scope: 'question' }, index: 1 },
    ])).toHaveLength(1)
    expect(findNewShortcutConflicts([], [
      { binding: sequenceCtrl, index: 0 },
      { binding: { ...sequenceCtrl, scope: 'approval' }, index: 1 },
    ])).toHaveLength(1)
    expect(findNewShortcutConflicts([], [
      { binding: sequenceCtrl, index: 0 },
      { binding: { ...sequenceCtrl, scope: 'approval' }, index: 1 },
    ])).toHaveLength(1)
    expect(findNewShortcutConflicts([], [
      { binding: sequencesMeta, index: 0 },
      { binding: { ...sequencesMeta, scope: 'question' }, index: 1 },
    ])).toHaveLength(1)
    expect(findNewShortcutConflicts([], [
      { binding: sequencesMeta, index: 0 },
      { binding: { ...sequencesMeta, scope: 'question' }, index: 1 },
    ])).toHaveLength(1)
  })

  it('reads profile options reactively from the settings face', async () => {
    const settings = settingsFace()
    render(<ShortcutProfileCard settings={settings} availableGlobalActions={[]} platform="linux" t={t} />)
    openCard()
    expect(screen.queryByRole('option', { name: 'Custom' })).toBeNull()

    settings.setProfiles([...settings.profiles(), {
      id: 'custom', label: 'profile.custom.label', description: 'profile.custom.description', bindings: customBindings,
    }])

    await waitFor(() => expect(screen.getByRole('option', { name: 'Custom' })).toBeTruthy())
  })

  it('shows accessible create and import tools for built-ins but no custom-only tools', () => {
    const settings = settingsFace()
    render(<ShortcutProfileCard settings={settings} availableGlobalActions={[]} platform="linux" t={t} />)
    openCard()

    const create = screen.getByRole('button', { name: 'New profile' })
    const toolbar = screen.getByRole('toolbar', { name: 'Profile actions' })
    const upload = screen.getByRole('button', { name: 'Import profile' })
    expect(toolbar.contains(create)).toBe(true)
    expect(create.getAttribute('title')).toBe('New profile')
    expect(upload.getAttribute('title')).toBe('Import profile')
    expect(screen.queryByRole('button', { name: 'Export profile' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Delete profile' })).toBeNull()
    const file = screen.getByLabelText('Choose custom profile JSON file') as HTMLInputElement
    expect(file.accept).toBe('application/json,.json')
  })

  it('creates and imports through the real controller without selecting twice', async () => {
    const registry = createProfileRegistry([standardProfile, vimProfile])
    const scope = controllerScope({ activeProfile: 'standard' })
    let nextId = 0
    const { createShortcutSettingsController } = await import('../src/client/settings/controller.js')
    const controller = createShortcutSettingsController(scope.scope, registry, scope.mutate, {
      createId: () => `test-${++nextId}`,
      legacyName: () => 'Custom',
    })
    const setActiveProfile = vi.spyOn(controller, 'setActiveProfile')
    render(<ShortcutProfileCard settings={controller} availableGlobalActions={[]} platform="linux" t={t} />)
    openCard()

    fireEvent.click(screen.getByRole('button', { name: 'New profile' }))
    await waitFor(() => expect((screen.getByRole('combobox', { name: 'Profile' }) as HTMLSelectElement).value).toBe('custom-test-1'))
    expect(setActiveProfile).not.toHaveBeenCalled()

    const valid = new File([encodeCustomProfileJson({ name: 'Imported', bindings: customBindings })], 'profile.json', { type: 'application/json' })
    fireEvent.change(screen.getByLabelText('Choose custom profile JSON file'), { target: { files: [valid] } })
    await waitFor(() => expect((screen.getByRole('combobox', { name: 'Profile' }) as HTMLSelectElement).value).toBe('custom-test-2'))
    expect(setActiveProfile).not.toHaveBeenCalled()
    controller.dispose()
  })

  it('imports JSON through the strict codec and reports success without writing on invalid input', async () => {
    const settings = settingsFace()
    settings.importCustomProfile = vi.fn(async () => {
      settings.setProfiles([...settings.profiles(), {
        id: 'custom-imported', label: 'profile.custom.label', description: 'profile.custom.description', bindings: customBindings,
      }])
      return 'custom-imported'
    })
    settings.setActiveProfile = vi.fn(async id => { settings.setExternal(id) })
    render(<ShortcutProfileCard settings={settings} availableGlobalActions={[]} platform="linux" t={t} />)
    openCard()
    const input = screen.getByLabelText('Choose custom profile JSON file') as HTMLInputElement
    const valid = new File([encodeCustomProfileJson({ name: 'Imported', bindings: customBindings })], 'profile.json', { type: 'application/json' })

    fireEvent.change(input, { target: { files: [valid] } })

    await waitFor(() => expect(settings.importCustomProfile).toHaveBeenCalledWith({ name: 'Imported', bindings: customBindings }))
    expect(screen.getByText('Profile imported.').getAttribute('role')).toBe('status')

    settings.importCustomProfile = vi.fn()
    fireEvent.change(input, { target: { files: [new File(['{}'], 'bad.json')] } })
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Could not import profile'))
    expect(settings.importCustomProfile).not.toHaveBeenCalled()
  })

  it.each([
    ['success', new File([encodeCustomProfileJson({ name: 'Imported', bindings: customBindings })], 'same.json'), undefined],
    ['read failure', Object.assign(new File(['x'], 'same.json'), { text: vi.fn().mockRejectedValue(new Error('disk failed')) }), 'Could not read profile file'],
    ['decode failure', new File(['{}'], 'same.json'), 'Could not import profile'],
    ['controller failure', new File([encodeCustomProfileJson({ name: 'Imported', bindings: customBindings })], 'same.json'), 'Could not import profile'],
  ])('allows the same file to be selected again after %s', async (scenario, file, expectedError) => {
    const settings = settingsFace()
    settings.importCustomProfile = scenario === 'controller failure'
      ? vi.fn().mockRejectedValue(new Error('denied'))
      : vi.fn(settings.importCustomProfile)
    render(<ShortcutProfileCard settings={settings} availableGlobalActions={[]} platform="linux" t={t} />)
    openCard()
    const input = screen.getByLabelText('Choose custom profile JSON file') as HTMLInputElement

    fireEvent.change(input, { target: { files: [file] } })
    if (expectedError === undefined) await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Profile imported.'))
    else await waitFor(() => expect(screen.getByRole('alert').textContent).toContain(expectedError))
    expect(input.value).toBe('')

    fireEvent.change(input, { target: { files: [file] } })
    if (scenario === 'success') await waitFor(() => expect(settings.importCustomProfile).toHaveBeenCalledTimes(2))
    else if (scenario === 'controller failure') await waitFor(() => expect(settings.importCustomProfile).toHaveBeenCalledTimes(2))
    else await waitFor(() => expect(screen.getByRole('alert').textContent).toContain(expectedError!))
  })

  it('reports a saved import partial while preserving the newly emitted profile', async () => {
    const settings = settingsFace()
    settings.importCustomProfile = vi.fn(async () => {
      settings.setProfiles([...settings.profiles(), {
        id: 'imported-id', label: 'profile.custom.label', description: 'profile.custom.description', bindings: customBindings,
      }])
      settings.setFailure({ code: 'NOT_APPLIED', operation: 'import', phase: 'selection', message: 'selection failed', profileId: 'imported-id', partial: 'profile-saved' })
      throw new Error('selection failed')
    })
    render(<ShortcutProfileCard settings={settings} availableGlobalActions={[]} platform="linux" t={t} />)
    openCard()

    fireEvent.change(screen.getByLabelText('Choose custom profile JSON file'), { target: { files: [new File([encodeCustomProfileJson({ name: 'Imported', bindings: customBindings })], 'profile.json')] } })

    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Profile imported but could not be selected.'))
    expect(screen.getByRole('option', { name: 'Custom' })).toBeTruthy()
  })

  it('exports only the authoritative clean custom profile with the shared safe filename', async () => {
    const registry = createProfileRegistry([standardProfile, vimProfile])
    registry.replaceCustomProfiles([{ id: 'custom', name: 'CON', bindings: customBindings }])
    const settings = settingsFace('custom', registry.list())
    settings.exportActiveCustomProfile = vi.fn(() => ({ name: 'CON', bindings: customBindings }))
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:custom')
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.download).toBe(customProfileFilename('CON'))
    })
    render(<ShortcutProfileCard settings={settings} availableGlobalActions={[]} platform="linux" t={t} />)
    openCard()

    fireEvent.click(screen.getByRole('button', { name: 'Export profile' }))

    await waitFor(() => expect(settings.exportActiveCustomProfile).toHaveBeenCalledOnce())
    expect(createObjectURL).toHaveBeenCalledOnce()
    expect(click).toHaveBeenCalledOnce()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:custom')
    expect(screen.getByRole('status').textContent).toContain('Profile exported.')
  })

  it('explains disabled export for dirty drafts', () => {
    const registry = createProfileRegistry([standardProfile, vimProfile])
    registry.replaceCustomProfiles([{ id: 'custom', name: 'Custom', bindings: customBindings }])
    const settings = settingsFace('custom', registry.list())
    render(<ShortcutProfileCard settings={settings} availableGlobalActions={[]} platform="linux" t={t} />)
    openCard()
    const name = screen.getByRole('textbox', { name: 'Profile name' })

    fireEvent.change(name, { target: { value: 'Dirty' } })
    const dirtyExport = screen.getByRole('button', { name: 'Export profile' })
    expect((dirtyExport as HTMLButtonElement).disabled).toBe(true)
    expect(document.getElementById(dirtyExport.getAttribute('aria-describedby')!)?.textContent).toBe('Save changes before exporting.')
  })

  it('uses inline delete confirmation, retains failure for retry, and reports partial selection changes', async () => {
    const registry = createProfileRegistry([standardProfile, vimProfile])
    registry.replaceCustomProfiles([{ id: 'custom', name: 'Work', bindings: customBindings }])
    const settings = settingsFace('custom', registry.list())
    settings.deleteCustomProfile = vi.fn()
      .mockRejectedValueOnce(new Error('denied'))
      .mockImplementationOnce(async () => {
        settings.setFailure({ code: 'NOT_APPLIED', operation: 'delete', phase: 'collection', message: 'delete failed', profileId: 'custom', partial: 'selection-changed' })
        throw new Error('delete failed')
      })
    render(<ShortcutProfileCard settings={settings} availableGlobalActions={[]} platform="linux" t={t} />)
    openCard()
    fireEvent.change(screen.getByRole('textbox', { name: 'Profile name' }), { target: { value: 'Draft' } })

    fireEvent.click(screen.getByRole('button', { name: 'Delete profile' }))
    expect(screen.getByText('Delete this profile?')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel delete' }))
    expect(settings.deleteCustomProfile).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Delete profile' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('denied'))
    expect((screen.getByRole('textbox', { name: 'Profile name' }) as HTMLInputElement).value).toBe('Draft')
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }))
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Switched to Standard, but the profile was kept.'))
    expect(settings.deleteCustomProfile).toHaveBeenCalledTimes(2)
  })

  it('drops pending async results after unmount or settings replacement, including file reads', async () => {
    let resolveCreate!: () => void
    const oldSettings = settingsFace()
    oldSettings.createCustomProfile = vi.fn(() => new Promise<string>(resolve => { resolveCreate = () => resolve('old-created') }))
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const mounted = render(<ShortcutProfileCard settings={oldSettings} availableGlobalActions={[]} platform="linux" t={t} />)
    openCard()
    fireEvent.click(screen.getByRole('button', { name: 'New profile' }))
    mounted.unmount()
    resolveCreate()
    await Promise.resolve()
    await Promise.resolve()
    expect(consoleError).not.toHaveBeenCalled()

    let rejectSelection!: (reason: Error) => void
    const first = settingsFace()
    first.setActiveProfile = vi.fn(() => new Promise<void>((_resolve, reject) => { rejectSelection = reject }))
    const second = settingsFace()
    const replaced = render(<ShortcutProfileCard settings={first} availableGlobalActions={[]} platform="linux" t={t} />)
    openCard()
    fireEvent.change(screen.getByRole('combobox', { name: 'Profile' }), { target: { value: 'vim' } })
    replaced.rerender(<ShortcutProfileCard settings={second} availableGlobalActions={[]} platform="linux" t={t} />)
    rejectSelection(new Error('stale selection'))
    await Promise.resolve()
    await Promise.resolve()
    expect(screen.queryByText(/stale selection/)).toBeNull()
    expect((screen.getByRole('combobox', { name: 'Profile' }) as HTMLSelectElement).value).toBe('standard')
    replaced.unmount()

    let resolveText!: (text: string) => void
    const pendingFile = new File(['ignored'], 'profile.json')
    Object.defineProperty(pendingFile, 'text', { value: () => new Promise<string>(resolve => { resolveText = resolve }) })
    const fileSettings = settingsFace()
    const readError = vi.spyOn(fileSettings, 'error')
    const pendingRead = render(<ShortcutProfileCard settings={fileSettings} availableGlobalActions={[]} platform="linux" t={t} />)
    openCard()
    fireEvent.change(screen.getByLabelText('Choose custom profile JSON file'), { target: { files: [pendingFile] } })
    const readsBeforeUnmount = readError.mock.calls.length
    pendingRead.unmount()
    resolveText('{}')
    await Promise.resolve()
    await Promise.resolve()
    expect(readError).toHaveBeenCalledTimes(readsBeforeUnmount)
    expect(consoleError).not.toHaveBeenCalled()
    consoleError.mockRestore()
  })

  it.each(['select', 'create', 'import', 'save', 'delete'] as const)('disables the disclosure header while %s is pending', async operation => {
    const registry = createProfileRegistry([standardProfile, vimProfile])
    registry.replaceCustomProfiles([{ id: 'custom', name: 'Work', bindings: customBindings }])
    const settings = settingsFace(operation === 'save' || operation === 'delete' ? 'custom' : 'standard', registry.list())
    let resolve!: () => void
    const pending = () => new Promise<void>(done => { resolve = done })
    if (operation === 'select') settings.setActiveProfile = vi.fn(pending)
    if (operation === 'create') settings.createCustomProfile = vi.fn(async () => { await pending(); return 'custom-created' })
    if (operation === 'import') settings.importCustomProfile = vi.fn(async () => { await pending(); return 'custom-imported' })
    if (operation === 'save') settings.saveCustomProfile = vi.fn(async () => { await pending() })
    if (operation === 'delete') settings.deleteCustomProfile = vi.fn(pending)
    render(<ShortcutProfileCard settings={settings} availableGlobalActions={[]} platform="linux" t={t} />)
    openCard()

    if (operation === 'select') fireEvent.change(screen.getByRole('combobox', { name: 'Profile' }), { target: { value: 'vim' } })
    if (operation === 'create') fireEvent.click(screen.getByRole('button', { name: 'New profile' }))
    if (operation === 'import') fireEvent.change(screen.getByLabelText('Choose custom profile JSON file'), { target: { files: [new File([encodeCustomProfileJson({ name: 'Imported', bindings: customBindings })], 'profile.json')] } })
    if (operation === 'save') {
      fireEvent.change(screen.getByRole('textbox', { name: 'Profile name' }), { target: { value: 'Draft' } })
      fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    }
    if (operation === 'delete') {
      fireEvent.click(screen.getByRole('button', { name: 'Delete profile' }))
      fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }))
    }

    await waitFor(() => expect((screen.getByRole('button', { name: 'Collapse: Shortcuts' }) as HTMLButtonElement).disabled).toBe(true))
    fireEvent.click(screen.getByRole('button', { name: 'Collapse: Shortcuts' }))
    expect(screen.getByRole('combobox', { name: 'Profile' })).toBeTruthy()
    resolve()
    await waitFor(() => expect((screen.getByRole('button', { name: 'Collapse: Shortcuts' }) as HTMLButtonElement).disabled).toBe(false))
  })

  it('removes an active custom profile through the real controller without retaining its editor draft', async () => {
    const registry = createProfileRegistry([standardProfile, vimProfile])
    const scope = controllerScope({
      activeProfile: 'custom-delete',
      customProfiles: [{ id: 'custom-delete', name: 'Work', bindings: customBindings }],
    })
    const { createShortcutSettingsController } = await import('../src/client/settings/controller.js')
    const controller = createShortcutSettingsController(scope.scope, registry, scope.mutate, controllerOptions)
    render(<ShortcutProfileCard settings={controller} availableGlobalActions={[]} platform="linux" t={t} />)
    openCard()
    fireEvent.change(screen.getByRole('textbox', { name: 'Profile name' }), { target: { value: 'Detached draft' } })

    fireEvent.click(screen.getByRole('button', { name: 'Delete profile' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }))

    await waitFor(() => expect((screen.getByRole('combobox', { name: 'Profile' }) as HTMLSelectElement).value).toBe('standard'))
    expect(screen.queryByRole('option', { name: 'Work' })).toBeNull()
    expect(screen.queryByRole('textbox', { name: 'Profile name' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Export profile' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Delete profile' })).toBeNull()
    expect(screen.queryByDisplayValue('Detached draft')).toBeNull()
    controller.dispose()
  })

  it('disables persistence while readonly but permits ready custom export', () => {
    const registry = createProfileRegistry([standardProfile, vimProfile])
    registry.replaceCustomProfiles([{ id: 'custom', name: 'Readonly', bindings: customBindings }])
    const settings = settingsFace('custom', registry.list(), false)
    settings.exportActiveCustomProfile = vi.fn(() => ({ name: 'Readonly', bindings: customBindings }))
    render(<ShortcutProfileCard settings={settings} availableGlobalActions={[]} platform="linux" t={t} />)
    openCard()

    expect((screen.getByRole('button', { name: 'New profile' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Import profile' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Delete profile' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Export profile' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('starts collapsed and toggles profile details with an accessible disclosure header', () => {
    const registry = createProfileRegistry([standardProfile, vimProfile])
    const settings = settingsFace()
    render(<ShortcutProfileCard settings={settings} profiles={registry.list()} availableGlobalActions={[]} platform="linux" t={t} />)
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
    render(<ShortcutProfileCard settings={settings} profiles={registry.list()} availableGlobalActions={[]} platform="linux" t={t} />)
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
    render(<ShortcutProfileCard settings={settings} profiles={registry.list()} availableGlobalActions={[]} platform="linux" t={t} />)
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
    render(<ShortcutProfileCard settings={settings} profiles={registry.list()} availableGlobalActions={[]} platform="linux" t={t} />)
    openCard()
    fireEvent.change(screen.getByRole('combobox', { name: 'Profile' }), { target: { value: 'vim' } })
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('no permission'))
    expect((screen.getByRole('combobox', { name: 'Profile' }) as HTMLSelectElement).value).toBe('standard')
    fireEvent.change(screen.getByRole('combobox', { name: 'Profile' }), { target: { value: 'vim' } })
    await waitFor(() => expect((screen.getByRole('combobox', { name: 'Profile' }) as HTMLSelectElement).value).toBe('vim'))
  })

  it('renders the message from the latest structured controller failure', () => {
    const registry = createProfileRegistry([standardProfile, vimProfile])
    const settings = settingsFace()
    settings.setFailure({
      code: 'NOT_APPLIED',
      operation: 'save',
      phase: 'collection',
      message: 'permission denied',
    })

    render(<ShortcutProfileCard settings={settings} profiles={registry.list()} availableGlobalActions={[]} platform="linux" t={t} />)
    openCard()

    expect(screen.getByRole('alert').textContent).toContain('permission denied')
    expect(screen.getByRole('alert').textContent).not.toContain('[object Object]')
  })

  it('uses the latest external snapshot after pending failure and success', async () => {
    const registry = createProfileRegistry([standardProfile, vimProfile])
    const settings = settingsFace()
    let settle!: (error?: Error) => void
    settings.setActiveProfile = vi.fn(() => new Promise<void>((resolve, reject) => { settle = error => error ? reject(error) : resolve() }))
    render(<ShortcutProfileCard settings={settings} profiles={registry.list()} availableGlobalActions={[]} platform="linux" t={t} />)
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
      { command: 'openCommandPalette', scope: 'global', key: { key: 'n', modifiers: ['Meta'] } },
    ])
    const settings = settingsFace('standard', registry.list())
    render(<ShortcutProfileCard settings={settings} profiles={[...registry.list()]} platform="linux" t={t} />)
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
    registry.replaceCustom([{ command: 'startSession', scope: 'global', key: { key: 'n', modifiers: ['Meta', 'Alt', 'Shift'] } }])
    const settings = settingsFace('standard', registry.list())
    settings.saveCustomProfile = vi.fn(settings.saveCustomProfile)
    const availableGlobalActions = [
      'startSession', 'previousSession', 'nextSession', 'previousWorkspace', 'nextWorkspace', 'forkSession', 'toggleTheme',
    ] as const

    render(<ShortcutProfileCard settings={settings} profiles={registry.list()} availableGlobalActions={availableGlobalActions} platform="linux" t={t} />)
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
    await waitFor(() => expect(settings.saveCustomProfile).toHaveBeenCalled())
    expect(settings.saveCustomProfile).toHaveBeenCalledWith(
      'custom',
      expect.any(String),
      'Custom',
      expect.arrayContaining([
        expect.objectContaining({
          command: 'startSession',
          scope: 'global',
          key: { key: 'x', modifiers: ['Ctrl'] },
        }),
      ]),
    )
  })

  it('locks the profile selector while the custom editor is saving', async () => {
    const registry = createProfileRegistry([standardProfile, vimProfile])
    registry.replaceCustom([{ command: 'openCommandPalette', scope: 'global', key: { key: 'k', modifiers: ['Ctrl'] } }])
    const settings = settingsFace('custom', registry.list())
    const persist = settings.saveCustomProfile.bind(settings)
    let resolve!: () => void
    settings.saveCustomProfile = vi.fn(async (...args) => {
      await new Promise<void>(done => { resolve = done })
      await persist(...args)
    })
    render(<ShortcutProfileCard settings={settings} profiles={registry.list()} availableGlobalActions={['openCommandPalette']} platform="linux" t={t} />)
    openCard()
    fireEvent.change(screen.getByRole('textbox', { name: 'Profile name' }), { target: { value: 'Review' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect((screen.getByRole('group') as HTMLFieldSetElement).disabled).toBe(true))
    resolve()
    await waitFor(() => expect((screen.getByRole('group') as HTMLFieldSetElement).disabled).toBe(false))
  })

  it('saves a recorded Custom binding through the real settings controller', async () => {
    const registry = createProfileRegistry([standardProfile, vimProfile])
    const scope = controllerScope({ activeProfile: 'standard' })
    const { createShortcutSettingsController } = await import('../src/client/settings/controller.js')
    const controller = createShortcutSettingsController(scope.scope, registry, scope.mutate, controllerOptions)

    render(<ShortcutProfileCard settings={controller} profiles={registry.list()} availableGlobalActions={[]} platform="linux" t={t} />)
    openCard()
    fireEvent.change(screen.getByRole('combobox', { name: 'Profile' }), { target: { value: 'custom' } })
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Questions' })).toBeTruthy())

    const record = screen.getByRole('heading', { name: 'Questions' }).parentElement?.querySelector('button')
    expect(record).toBeTruthy()
    fireEvent.click(record!)
    fireEvent.keyDown(record!, { key: 'x', ctrlKey: true })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(scope.mutate).toHaveBeenCalledWith(expect.objectContaining({ field: 'customProfiles', value: expect.any(Array) })))
    const savedProfiles = vi.mocked(scope.mutate).mock.calls.find(call => call[0].field === 'customProfiles')?.[0].value as Array<{ name?: string }>
    expect(savedProfiles[0]?.name).toBe('Custom')
    expect(screen.queryByText('Could not save custom shortcuts: Cannot read properties of undefined (reading \'disposed\')')).toBeNull()
    controller.dispose()
  })

  it('keeps standard and Vim profiles read-only', () => {
    const registry = createProfileRegistry([standardProfile, vimProfile])
    const settings = settingsFace()
    render(<ShortcutProfileCard settings={settings} profiles={[...registry.list(), { id: 'custom', label: 'profile.custom.label', description: 'profile.custom.description', bindings: standardProfile.bindings }]} platform="linux" t={t} />)
    openCard()
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Record shortcut' })).toBeNull()
  })



  it('updates translated labels without changing profile ids or bindings', () => {
    const registry = createProfileRegistry([standardProfile, vimProfile])
    const settings = settingsFace()
    const zh = (key: string) => key === 'profile.standard.label' ? '标准' : key === 'legend.scope.question' ? '问题' : t(key)
    const { rerender } = render(<ShortcutProfileCard settings={settings} profiles={registry.list()} platform="linux" t={zh} />)
    openCard()
    expect((screen.getByRole('combobox', { name: 'Profile' }) as HTMLSelectElement).value).toBe('standard')
    expect(standardProfile.bindings).toHaveLength(17)
    rerender(<ShortcutProfileCard settings={settings} profiles={registry.list()} platform="linux" t={t} />)
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
