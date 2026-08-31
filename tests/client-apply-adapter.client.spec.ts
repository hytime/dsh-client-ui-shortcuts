import { describe, expect, it, vi } from 'vitest'
import { createDshCompatibility } from '../src/client/compatibility.js'

function remoteWith(result: unknown) {
  return {
    settings: {
      mutate: vi.fn(async () => result),
    },
  }
}

describe('settings mutation adapter', () => {
  it('safely returns the numeric conflict actual revision', async () => {
    const remote = remoteWith({
      ok: false,
      error: { code: 'settings-conflict', message: 'conflict', details: { actual: 8 } },
    })
    const mutate = createDshCompatibility(name => name === 'remote' ? remote : undefined).mutateSettings

    await expect(mutate({ field: 'activeProfile', value: 'vim', expectedRevision: 1 })).resolves.toEqual({
      ok: false, kind: 'conflict', message: 'conflict', actualRevision: 8,
    })
  })

  it('uses the current remote settings mutation signature', async () => {
    const remote = remoteWith({
      ok: true as const,
      value: {
        value: { activeProfile: 'vim' },
        base: undefined,
        user: { activeProfile: 'vim' },
        revision: 2,
      },
    })
    const mutate = createDshCompatibility(name => name === 'remote' ? remote : undefined).mutateSettings

    await expect(mutate({ field: 'activeProfile', value: 'vim', expectedRevision: 1 })).resolves.toEqual({
      ok: true,
      view: {
        value: { activeProfile: 'vim' },
        base: undefined,
        user: { activeProfile: 'vim' },
        revision: 2,
      },
    })
    expect(remote.settings.mutate).toHaveBeenCalledWith(
      'dsh-ui-shortcuts',
      [{ op: 'set', path: ['activeProfile'], value: 'vim' }],
      1,
    )
  })

  it.each([
    ['missing details', undefined],
    ['non-object details', 'bad'],
    ['non-numeric actual', { actual: '8' }],
  ])('ignores %s without unsafe assumptions', async (_label, details) => {
    const remote = remoteWith({
      ok: false,
      error: { code: 'settings-conflict', message: 'conflict', ...(details === undefined ? {} : { details }) },
    })
    const mutate = createDshCompatibility(name => name === 'remote' ? remote : undefined).mutateSettings

    await expect(mutate({ field: 'activeProfile', value: 'vim', expectedRevision: 1 })).resolves.toEqual({
      ok: false, kind: 'conflict', message: 'conflict',
    })
  })

  it('uses the legacy connection settings mutation when remote settings is absent', async () => {
    const view = { value: { activeProfile: 'vim' }, revision: 2 }
    const mutate = vi.fn(async (request: unknown) => ({ result: { ok: true, value: view, request } }))
    const compatibility = createDshCompatibility(name => name === 'connection'
      ? { api: { settings: { mutate } } }
      : undefined)

    await expect(compatibility.mutateSettings({ field: 'activeProfile', value: 'vim', expectedRevision: 1 })).resolves.toEqual({
      ok: true, view,
    })
    expect(mutate).toHaveBeenCalledWith({
      ns: 'dsh-ui-shortcuts',
      ops: [{ op: 'set', path: ['activeProfile'], value: 'vim' }],
      expectedRevision: 1,
    })
  })

  it('normalizes legacy conflict and rejection responses', async () => {
    const responses = [
      { result: { ok: false, error: { code: 'settings-conflict', message: 'conflict', details: { actual: 8 } } } },
      { result: { ok: false, error: { code: 'settings-rejected', message: 'rejected' } } },
    ]
    const mutate = vi.fn(async () => responses.shift())
    const compatibility = createDshCompatibility(name => name === 'connection'
      ? { api: { settings: { mutate } } }
      : undefined)

    await expect(compatibility.mutateSettings({ field: 'activeProfile', value: 'vim', expectedRevision: 1 })).resolves.toEqual({
      ok: false, kind: 'conflict', message: 'conflict', actualRevision: 8,
    })
    await expect(compatibility.mutateSettings({ field: 'activeProfile', value: 'vim', expectedRevision: 8 })).resolves.toEqual({
      ok: false, kind: 'rejected', message: 'rejected',
    })
  })

  it('prefers uiWorkspace startSession over the legacy workspace service', () => {
    const current = vi.fn()
    const legacy = vi.fn()
    const compatibility = createDshCompatibility(name => ({
      uiWorkspace: { startSession: current },
      workspaces: { startSession: legacy },
    }[name]))

    compatibility.startSession?.('workspace-1' as never)

    expect(current).toHaveBeenCalledWith('workspace-1')
    expect(legacy).not.toHaveBeenCalled()
  })

  it('falls back to legacy workspace startSession', () => {
    const legacy = vi.fn()
    const compatibility = createDshCompatibility(name => name === 'workspaces'
      ? { startSession: legacy }
      : undefined)

    compatibility.startSession?.()

    expect(legacy).toHaveBeenCalledWith(undefined)
  })

  it('reads current pending interaction state', () => {
    const compatibility = createDshCompatibility(name => ({
      sessions: { list: { getSnapshot: () => ({ current: 's1', byId: { s1: {} } }) } },
      uiSession: { pendingInteractions: { getSnapshot: () => new Map([['s1', { kind: 'approval' }]]) } },
    }[name]))

    expect(compatibility.isInteractionPending()).toBe(true)
  })

  it('returns false for absent current pending interaction state', () => {
    const compatibility = createDshCompatibility(name => ({
      sessions: { list: { getSnapshot: () => ({ current: 's1', byId: { s1: {} } }) } },
      uiSession: { pendingInteractions: { getSnapshot: () => new Map() } },
    }[name]))

    expect(compatibility.isInteractionPending()).toBe(false)
  })

  it('reads legacy pending interaction state', () => {
    const compatibility = createDshCompatibility(name => name === 'sessions'
      ? { list: { getSnapshot: () => ({ current: 's1', byId: { s1: { pendingInteraction: { kind: 'question' } } } }) } }
      : undefined)

    expect(compatibility.isInteractionPending()).toBe(true)
  })

  it('returns false for an absent legacy pending interaction', () => {
    const compatibility = createDshCompatibility(name => name === 'sessions'
      ? { list: { getSnapshot: () => ({ current: 's1', byId: { s1: {} } }) } }
      : undefined)

    expect(compatibility.isInteractionPending()).toBe(false)
  })
  it('returns false without a current session or pending service', () => {
    const compatibility = createDshCompatibility(name => name === 'sessions'
      ? { list: { getSnapshot: () => ({ current: undefined, byId: {} }) } }
      : undefined)

    expect(compatibility.isInteractionPending()).toBe(false)
  })
})
