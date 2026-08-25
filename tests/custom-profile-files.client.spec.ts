// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CUSTOM_PROFILE_JSON_MAX_BYTES } from '../src/client/settings/custom-profile-json.js'
import {
  downloadCustomProfileJson,
  readCustomProfileFile,
} from '../src/client/settings/custom-profile-files.js'

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  document.body.replaceChildren()
})

describe('custom profile file adapter', () => {
  it('rejects an oversized file before reading text', async () => {
    const text = vi.fn(async () => '{}')

    await expect(readCustomProfileFile({ size: CUSTOM_PROFILE_JSON_MAX_BYTES + 1, text })).rejects.toThrow('must not exceed 1 MiB')
    expect(text).not.toHaveBeenCalled()
  })

  it('returns the original byte size and propagates text read failures', async () => {
    await expect(readCustomProfileFile({ size: 7, text: async () => '{"a":1}' })).resolves.toEqual({ text: '{"a":1}', bytes: 7 })
    await expect(readCustomProfileFile({ size: 3, text: async () => { throw new Error('disk read failed') } })).rejects.toThrow('disk read failed')
  })

  it('keeps the object url alive through click and revokes it in the next task', () => {
    vi.useFakeTimers()
    const createObjectURL = vi.fn(() => 'blob:profile')
    const revokeObjectURL = vi.fn()
    const url = { createObjectURL, revokeObjectURL }
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.download).toBe('Work.dsh-shortcuts.json')
      expect(this.href).toBe('blob:profile')
      expect(document.body.contains(this)).toBe(true)
      expect(revokeObjectURL).not.toHaveBeenCalled()
    })

    downloadCustomProfileJson(document, url, 'Work.dsh-shortcuts.json', '{\n}\n')

    const blob = createObjectURL.mock.calls[0]![0] as Blob
    expect(blob.type).toBe('application/json')
    expect(blob.size).toBe(4)
    expect(click).toHaveBeenCalledOnce()
    expect(revokeObjectURL).not.toHaveBeenCalled()
    expect(document.querySelector('a[download]')).toBeNull()

    vi.runOnlyPendingTimers()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:profile')
    vi.useRealTimers()
  })
})
