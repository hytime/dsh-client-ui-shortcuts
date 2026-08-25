import { describe, expect, it, vi } from 'vitest'
import { createSettingsMutationAdapter } from '../src/client/apply.js'

function connectionWith(result: unknown) {
  return {
    api: {
      settings: {
        mutate: vi.fn(async () => ({ result })),
      },
    },
  }
}

describe('settings mutation adapter', () => {
  it('safely returns the numeric conflict actual revision', async () => {
    const connection = connectionWith({
      ok: false,
      error: { code: 'settings-conflict', message: 'conflict', details: { actual: 8 } },
    })
    const mutate = createSettingsMutationAdapter(connection)

    await expect(mutate({ field: 'activeProfile', value: 'vim', expectedRevision: 1 })).resolves.toEqual({
      ok: false, kind: 'conflict', message: 'conflict', actualRevision: 8,
    })
  })

  it.each([
    ['missing details', undefined],
    ['non-object details', 'bad'],
    ['non-numeric actual', { actual: '8' }],
  ])('ignores %s without unsafe assumptions', async (_label, details) => {
    const connection = connectionWith({
      ok: false,
      error: { code: 'settings-conflict', message: 'conflict', ...(details === undefined ? {} : { details }) },
    })
    const mutate = createSettingsMutationAdapter(connection)

    await expect(mutate({ field: 'activeProfile', value: 'vim', expectedRevision: 1 })).resolves.toEqual({
      ok: false, kind: 'conflict', message: 'conflict',
    })
  })
})
