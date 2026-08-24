import { describe, expect, it, vi } from 'vitest'
import type { SettingsScope, SettingsScopeSnapshot } from '@deepseek-ai/dsh-client-runtime/client'
import { customProfileFingerprint } from '../src/custom-profile-contract.js'
import { createBuiltinProfileRegistry } from '../src/client/profiles/registry.js'
import { standardProfile } from '../src/client/profiles/builtins.js'
import { createShortcutSettingsController } from '../src/client/settings/controller.js'
import { defaultShortcutBindings, type ShortcutSettings } from '../src/settings.js'
import type {
  PortableCustomProfile,
  ShortcutSettingsFailure,
} from '../src/client/contract/settings.js'
import type { ShortcutBinding } from '../src/client/contract/profile.js'

const customBinding = {
  command: 'openSettings' as const,
  scope: 'global' as const,
  key: { key: 's', modifiers: ['Meta'] as const },
}
const otherBinding = {
  command: 'openCommandPalette' as const,
  scope: 'global' as const,
  key: { key: 'p', modifiers: ['Meta'] as const },
}

function controlledSettingsScope(initial: ShortcutSettings) {
  let snapshot: SettingsScopeSnapshot<ShortcutSettings> = {
    status: 'ready', value: structuredClone(initial), base: undefined, user: initial,
    revision: 0, writable: true, mode: 'host',
  }
  const listeners = new Set<() => void>()
  let drop = false
  let before: (() => void | Promise<void>) | undefined
  const publish = () => listeners.forEach(listener => listener())
  const face: SettingsScope<ShortcutSettings> = {
    getSnapshot: () => snapshot,
    subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener) },
    set: vi.fn(async (field: string, value: unknown) => {
      const hook = before
      before = undefined
      await hook?.()
      if (drop || !snapshot.writable) {
        drop = false
        publish()
        return
      }
      snapshot = {
        ...snapshot,
        revision: (snapshot.revision ?? 0) + 1,
        value: { ...snapshot.value!, [field]: structuredClone(value) },
      }
      publish()
    }),
    unset: vi.fn(async () => {}),
  }
  return {
    face,
    snapshot: () => snapshot,
    dropNext: () => { drop = true },
    beforeNext: (hook: () => void | Promise<void>) => { before = hook },
    replace: (value: ShortcutSettings) => {
      snapshot = { ...snapshot, revision: (snapshot.revision ?? 0) + 1, value: structuredClone(value) }
      publish()
    },
    setWritable: (writable: boolean) => { snapshot = { ...snapshot, writable }; publish() },
    setStatus: (status: SettingsScopeSnapshot<ShortcutSettings>['status']) => { snapshot = { ...snapshot, status }; publish() },
  }
}

function initialSettings(overrides: Partial<ShortcutSettings> = {}): ShortcutSettings {
  return {
    activeProfile: 'standard',
    customProfiles: [],
    customBindings: [...defaultShortcutBindings()],
    ...overrides,
  }
}

function controllerFor(
  scope: ReturnType<typeof controlledSettingsScope>,
  createId: () => string = () => 'uuid-1',
  legacyName: () => string = () => 'Custom',
) {
  return createShortcutSettingsController(scope.face, createBuiltinProfileRegistry(), { createId, legacyName })
}

async function caughtFailure(promise: Promise<unknown>): Promise<ShortcutSettingsFailure> {
  try {
    await promise
  } catch (error) {
    return error as ShortcutSettingsFailure
  }
  throw new Error('expected operation to fail')
}

function caughtSyncFailure(operation: () => unknown): ShortcutSettingsFailure {
  try {
    operation()
  } catch (error) {
    return error as ShortcutSettingsFailure
  }
  throw new Error('expected operation to fail')
}

describe('custom profile settings controller', () => {
  it('projects the public face and creates a selected profile from Standard', async () => {
    const scope = controlledSettingsScope(initialSettings())
    const controller = controllerFor(scope)

    expect(controller.profiles().map(profile => profile.id)).toEqual(['standard', 'vim'])
    await expect(controller.createCustomProfile()).resolves.toBe('custom-uuid-1')
    expect(controller.activeProfileId()).toBe('custom-uuid-1')
    expect(controller.profiles().at(-1)).toMatchObject({
      id: 'custom-uuid-1',
      kind: 'custom',
      displayName: 'Custom',
      persistedName: 'Custom',
      bindings: standardProfile.bindings,
    })
    expect(controller.isCustomProfile('custom-uuid-1')).toBe(true)
    expect(controller.writable()).toBe(true)
  })

  it('projects legacy bindings as a nameless custom profile before Host migration arrives', () => {
    const scope = controlledSettingsScope(initialSettings({
      activeProfile: 'custom',
      customProfiles: undefined,
      customBindings: [customBinding],
    }))
    const controller = controllerFor(scope)

    expect(controller.activeProfileId()).toBe('custom')
    expect(controller.profiles().map(profile => profile.id)).toEqual(['standard', 'vim', 'custom'])
    expect(controller.profiles().at(-1)).toMatchObject({
      kind: 'custom',
      displayName: 'Custom',
      bindings: [customBinding],
    })
    expect(controller.profiles().at(-1)?.persistedName).toBeUndefined()
  })

  it('exposes only Standard and rejects every operation while unavailable', async () => {
    const scope = controlledSettingsScope(initialSettings({
      activeProfile: 'custom-work',
      customProfiles: [{ id: 'custom-work', name: 'Work', bindings: [customBinding] }],
    }))
    scope.setStatus('unavailable')
    const controller = controllerFor(scope)
    const portable: PortableCustomProfile = { name: 'Imported', bindings: [otherBinding] }

    expect(controller.profiles().map(profile => profile.id)).toEqual(['standard'])
    expect(controller.activeProfileId()).toBe('standard')
    expect(controller.writable()).toBe(false)
    for (const operation of [
      controller.createCustomProfile(),
      controller.importCustomProfile(portable),
      controller.saveCustomProfile('custom-work', 'baseline', 'Work', [otherBinding]),
      controller.deleteCustomProfile('custom-work'),
      controller.setActiveProfile('vim'),
    ]) {
      await expect(caughtFailure(operation)).resolves.toMatchObject({ code: 'UNAVAILABLE' })
    }
    expect(caughtSyncFailure(() => controller.exportActiveCustomProfile())).toMatchObject({
      code: 'UNAVAILABLE', operation: 'export', phase: 'selection',
    })
    expect(scope.face.set).not.toHaveBeenCalled()
  })

  it('preserves authoritative profiles but permits only export when ready and read-only', async () => {
    const saved = { id: 'custom-work', name: 'Work', bindings: [customBinding] }
    const scope = controlledSettingsScope(initialSettings({ activeProfile: saved.id, customProfiles: [saved] }))
    scope.setWritable(false)
    const controller = controllerFor(scope)

    expect(controller.profiles().map(profile => profile.id)).toEqual(['standard', 'vim', 'custom-work'])
    expect(controller.activeProfileId()).toBe('custom-work')
    expect(controller.writable()).toBe(false)
    expect(controller.exportActiveCustomProfile()).toEqual({ name: 'Work', bindings: [customBinding] })
    for (const operation of [
      controller.createCustomProfile(),
      controller.importCustomProfile({ name: 'Imported', bindings: [otherBinding] }),
      controller.saveCustomProfile(saved.id, customProfileFingerprint(saved), saved.name, [otherBinding]),
      controller.deleteCustomProfile(saved.id),
      controller.setActiveProfile('vim'),
    ]) {
      await expect(caughtFailure(operation)).resolves.toMatchObject({ code: 'UNAVAILABLE' })
    }
    expect(scope.face.set).not.toHaveBeenCalled()
  })

  it('publishes profiles, active id, writability, and latest structured failure through one subscription', async () => {
    const scope = controlledSettingsScope(initialSettings())
    const controller = controllerFor(scope)
    const listener = vi.fn()
    controller.subscribe(listener)

    scope.replace(initialSettings({
      activeProfile: 'custom-work',
      customProfiles: [{ id: 'custom-work', name: 'Work', bindings: [customBinding] }],
    }))
    expect(controller.profiles().map(profile => profile.id)).toEqual(['standard', 'vim', 'custom-work'])
    expect(controller.activeProfileId()).toBe('custom-work')

    scope.setWritable(false)
    expect(controller.writable()).toBe(false)
    const failure = await caughtFailure(controller.setActiveProfile('standard'))
    expect(failure).toMatchObject({ code: 'UNAVAILABLE', operation: 'select', phase: 'selection' })
    expect(controller.error()).toEqual(failure)
    expect(listener.mock.calls.length).toBeGreaterThanOrEqual(3)
  })

  it('imports under a new id, numbers duplicate names, and selects only after collection persistence', async () => {
    const scope = controlledSettingsScope(initialSettings({
      customProfiles: [{ id: 'custom-existing', name: 'Work', bindings: [customBinding] }],
    }))
    const controller = controllerFor(scope)

    await expect(controller.importCustomProfile({ name: 'Work', bindings: [otherBinding] })).resolves.toBe('custom-uuid-1')
    expect(controller.activeProfileId()).toBe('custom-uuid-1')
    expect(controller.profiles().at(-1)).toMatchObject({
      id: 'custom-uuid-1',
      displayName: 'Work 1',
      persistedName: 'Work 1',
      bindings: [otherBinding],
    })
    expect(vi.mocked(scope.face.set).mock.calls.map(call => call[0])).toEqual(['customProfiles', 'activeProfile'])
  })

  it('reports a saved profile when automatic import selection is not applied', async () => {
    const scope = controlledSettingsScope(initialSettings())
    const controller = controllerFor(scope)
    scope.beforeNext(() => {
      scope.beforeNext(() => { scope.dropNext() })
    })

    const failure = await caughtFailure(controller.importCustomProfile({ name: 'Work', bindings: [customBinding] }))

    expect(failure).toMatchObject({
      code: 'NOT_APPLIED',
      operation: 'import',
      phase: 'selection',
      partial: 'profile-saved',
      profileId: 'custom-uuid-1',
    })
    expect(controller.profiles().map(profile => profile.id)).toContain('custom-uuid-1')
    expect(controller.activeProfileId()).toBe('standard')
  })

  it('saves name and bindings from the latest collection only when the baseline matches', async () => {
    const work = { id: 'custom-work', name: 'Work', bindings: [customBinding] }
    const other = { id: 'custom-other', name: 'Other', bindings: [otherBinding] }
    const scope = controlledSettingsScope(initialSettings({ customProfiles: [work, other] }))
    const controller = controllerFor(scope)
    const baseline = controller.profiles().find(profile => profile.id === work.id)!.fingerprint

    await controller.saveCustomProfile(work.id, baseline, 'Renamed', [otherBinding])

    expect(scope.snapshot().value?.customProfiles).toEqual([
      { id: work.id, name: 'Renamed', bindings: [otherBinding] },
      other,
    ])
    expect(controller.profiles().find(profile => profile.id === work.id)).toMatchObject({
      displayName: 'Renamed',
      persistedName: 'Renamed',
      bindings: [otherBinding],
    })
    const calls = vi.mocked(scope.face.set).mock.calls.length
    const failure = await caughtFailure(controller.saveCustomProfile(work.id, baseline, 'Stale', [customBinding]))
    expect(failure).toMatchObject({ code: 'NOT_APPLIED', operation: 'save', phase: 'collection', profileId: work.id })
    expect(scope.face.set).toHaveBeenCalledTimes(calls)
  })

  it('keeps the legacy custom profile nameless during bindings-only saves', async () => {
    const legacy = { id: 'custom', bindings: [customBinding] }
    const scope = controlledSettingsScope(initialSettings({
      activeProfile: 'custom',
      customProfiles: undefined,
      customBindings: legacy.bindings,
    }))
    const controller = controllerFor(scope)
    const managed = controller.profiles().find(profile => profile.id === 'custom')!

    expect(managed.persistedName).toBeUndefined()
    await controller.saveCustomProfile(managed.id, managed.fingerprint, managed.persistedName, [otherBinding])

    expect(scope.snapshot().value?.customProfiles).toEqual([{ id: 'custom', bindings: [otherBinding] }])
    expect(controller.profiles().find(profile => profile.id === 'custom')?.persistedName).toBeUndefined()
  })

  it('rejects a resolved append when the complete read-back lacks the new profile', async () => {
    const scope = controlledSettingsScope(initialSettings())
    const controller = controllerFor(scope)
    scope.dropNext()

    const failure = await caughtFailure(controller.createCustomProfile())

    expect(failure).toMatchObject({ code: 'NOT_APPLIED', operation: 'create', phase: 'collection', profileId: 'custom-uuid-1' })
    expect(controller.profiles().map(profile => profile.id)).toEqual(['standard', 'vim'])
  })

  it('rejects a resolved save when the target fingerprint did not change to the requested value', async () => {
    const work = { id: 'custom-work', name: 'Work', bindings: [customBinding] }
    const scope = controlledSettingsScope(initialSettings({ customProfiles: [work] }))
    const controller = controllerFor(scope)
    const baseline = controller.profiles().at(-1)!.fingerprint
    scope.dropNext()

    const failure = await caughtFailure(controller.saveCustomProfile(work.id, baseline, 'Work', [otherBinding]))

    expect(failure).toMatchObject({ code: 'NOT_APPLIED', operation: 'save', phase: 'collection', profileId: work.id })
    expect(controller.profiles().at(-1)?.bindings).toEqual([customBinding])
  })

  it('rejects a resolved delete when the target remains in the complete read-back', async () => {
    const work = { id: 'custom-work', name: 'Work', bindings: [customBinding] }
    const scope = controlledSettingsScope(initialSettings({ customProfiles: [work] }))
    const controller = controllerFor(scope)
    scope.dropNext()

    const failure = await caughtFailure(controller.deleteCustomProfile(work.id))

    expect(failure).toMatchObject({ code: 'NOT_APPLIED', operation: 'delete', phase: 'collection', profileId: work.id })
    expect(controller.isCustomProfile(work.id)).toBe(true)
  })

  it('rejects a resolved selection when the authoritative active id differs', async () => {
    const scope = controlledSettingsScope(initialSettings())
    const controller = controllerFor(scope)
    scope.dropNext()

    const failure = await caughtFailure(controller.setActiveProfile('vim'))

    expect(failure).toMatchObject({ code: 'NOT_APPLIED', operation: 'select', phase: 'selection', profileId: 'vim' })
    expect(controller.activeProfileId()).toBe('standard')
  })

  it('rejects unavailable ids and eight collisions without writing', async () => {
    const unavailableScope = controlledSettingsScope(initialSettings())
    const unavailable = controllerFor(unavailableScope, () => { throw new TypeError('randomUUID is unavailable') })
    expect(await caughtFailure(unavailable.createCustomProfile())).toMatchObject({
      code: 'ID_UNAVAILABLE', operation: 'create', phase: 'id',
    })
    expect(unavailableScope.face.set).not.toHaveBeenCalled()

    const collisionScope = controlledSettingsScope(initialSettings({
      customProfiles: [{ id: 'custom-repeat', name: 'Existing', bindings: [customBinding] }],
    }))
    const createId = vi.fn(() => 'repeat')
    const collision = controllerFor(collisionScope, createId)
    expect(await caughtFailure(collision.createCustomProfile())).toMatchObject({
      code: 'ID_COLLISION', operation: 'create', phase: 'id',
    })
    expect(createId).toHaveBeenCalledTimes(8)
    expect(collisionScope.face.set).not.toHaveBeenCalled()
  })

  it('detects id collisions from the latest snapshot after an in-flight notification was suppressed', async () => {
    const scope = controlledSettingsScope(initialSettings())
    const controller = controllerFor(scope, () => 'repeat')
    let release!: () => void
    scope.beforeNext(async () => {
      scope.replace(initialSettings({
        customProfiles: [{ id: 'custom-repeat', name: 'External', bindings: [customBinding] }],
      }))
      await new Promise<void>(resolve => { release = resolve })
    })

    const selection = controller.setActiveProfile('vim')
    const create = controller.createCustomProfile()
    await Promise.resolve()
    release()
    await selection

    expect(await caughtFailure(create)).toMatchObject({
      code: 'ID_COLLISION', operation: 'create', phase: 'id',
    })
    expect(scope.face.set).toHaveBeenCalledTimes(1)
    expect(controller.profiles().map(profile => profile.id)).toEqual(['standard', 'vim', 'custom-repeat'])
  })

  it('deletes an active profile by selecting Standard before removing from the latest collection', async () => {
    const work = { id: 'custom-work', name: 'Work', bindings: [customBinding] }
    const other = { id: 'custom-other', name: 'Other', bindings: [otherBinding] }
    const scope = controlledSettingsScope(initialSettings({ activeProfile: work.id, customProfiles: [work, other] }))
    const controller = controllerFor(scope)

    await controller.deleteCustomProfile(work.id)

    expect(vi.mocked(scope.face.set).mock.calls.map(call => call[0])).toEqual(['activeProfile', 'customProfiles'])
    expect(controller.activeProfileId()).toBe('standard')
    expect(controller.profiles().map(profile => profile.id)).toEqual(['standard', 'vim', other.id])
  })

  it('fails safely when another controller reselects the active target between delete phases', async () => {
    const work = { id: 'custom-work', name: 'Work', bindings: [customBinding] }
    const scope = controlledSettingsScope(initialSettings({ activeProfile: work.id, customProfiles: [work] }))
    const deleting = controllerFor(scope, () => 'delete')
    const competing = controllerFor(scope, () => 'other')
    scope.beforeNext(() => {
      scope.beforeNext(async () => {
        await competing.setActiveProfile(work.id)
        scope.dropNext()
      })
    })

    const failure = await caughtFailure(deleting.deleteCustomProfile(work.id))

    expect(failure).toMatchObject({
      code: 'NOT_APPLIED', operation: 'delete', phase: 'collection',
      partial: 'selection-changed', profileId: work.id,
    })
    expect(deleting.activeProfileId()).toBe(work.id)
    expect(deleting.isCustomProfile(work.id)).toBe(true)
  })

  it('marks a failed second delete phase as a partial selection change', async () => {
    const work = { id: 'custom-work', name: 'Work', bindings: [customBinding] }
    const scope = controlledSettingsScope(initialSettings({ activeProfile: work.id, customProfiles: [work] }))
    const controller = controllerFor(scope)
    scope.beforeNext(() => {
      scope.beforeNext(() => { scope.dropNext() })
    })

    const failure = await caughtFailure(controller.deleteCustomProfile(work.id))

    expect(failure).toMatchObject({
      code: 'NOT_APPLIED', operation: 'delete', phase: 'collection',
      partial: 'selection-changed', profileId: work.id,
    })
    expect(controller.activeProfileId()).toBe('standard')
    expect(controller.isCustomProfile(work.id)).toBe(true)
  })

  it('does not retry after revision recovery and rebuilds the other controller profile from read-back', async () => {
    const scope = controlledSettingsScope(initialSettings())
    const first = controllerFor(scope, () => 'first')
    const second = controllerFor(scope, () => 'second')
    scope.beforeNext(async () => {
      await second.createCustomProfile()
      scope.dropNext()
    })

    const failure = await caughtFailure(first.createCustomProfile())

    expect(failure).toMatchObject({ code: 'NOT_APPLIED', operation: 'create', phase: 'collection', profileId: 'custom-first' })
    expect(first.profiles().map(profile => profile.id)).toEqual(['standard', 'vim', 'custom-second'])
    expect(first.activeProfileId()).toBe('custom-second')
    expect(scope.face.set).toHaveBeenCalledTimes(3)
  })

  it('exports only the active custom profile from the current ready snapshot', () => {
    const work = { id: 'custom-work', name: 'Work', bindings: [customBinding] }
    const other = { id: 'custom-other', name: 'Other', bindings: [otherBinding] }
    const scope = controlledSettingsScope(initialSettings({ activeProfile: work.id, customProfiles: [work, other] }))
    const controller = controllerFor(scope)

    const first = controller.exportActiveCustomProfile()
    expect(first).toEqual({ name: 'Work', bindings: [customBinding] })
    expect(first).not.toBe(scope.snapshot().value?.customProfiles?.[0])

    scope.replace(initialSettings({ activeProfile: other.id, customProfiles: [work, other] }))
    expect(controller.exportActiveCustomProfile()).toEqual({ name: 'Other', bindings: [otherBinding] })

    scope.replace(initialSettings({ activeProfile: 'standard', customProfiles: [work] }))
    expect(caughtSyncFailure(() => controller.exportActiveCustomProfile())).toMatchObject({
      code: 'PROFILE_MISSING', operation: 'export', phase: 'selection', profileId: 'standard',
    })
  })

  it('does not start queued work or publish an in-flight result after disposal', async () => {
    const work = { id: 'custom-work', name: 'Work', bindings: [customBinding] }
    const scope = controlledSettingsScope(initialSettings({ customProfiles: [work] }))
    const controller = controllerFor(scope)
    const baseline = controller.profiles().at(-1)!.fingerprint
    const listener = vi.fn()
    controller.subscribe(listener)
    let release!: () => void
    scope.beforeNext(async () => { await new Promise<void>(resolve => { release = resolve }) })

    const first = controller.saveCustomProfile(work.id, baseline, work.name, [otherBinding])
    const second = controller.saveCustomProfile(work.id, baseline, work.name, standardProfile.bindings as readonly ShortcutBinding[])
    await Promise.resolve()
    expect(scope.face.set).toHaveBeenCalledTimes(1)
    controller.dispose()
    release()

    await expect(first).resolves.toBeUndefined()
    await expect(second).resolves.toBeUndefined()
    expect(scope.face.set).toHaveBeenCalledTimes(1)
    expect(listener).not.toHaveBeenCalled()
  })
})
