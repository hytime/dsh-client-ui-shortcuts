import { describe, expect, it, vi } from 'vitest'
import { createSettingsMutationAdapter } from '../src/client/apply.js'

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
    const mutate = createSettingsMutationAdapter(remote)

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
    const mutate = createSettingsMutationAdapter(remote)

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
    const mutate = createSettingsMutationAdapter(remote)

    await expect(mutate({ field: 'activeProfile', value: 'vim', expectedRevision: 1 })).resolves.toEqual({
      ok: false, kind: 'conflict', message: 'conflict',
    })
  })
})
