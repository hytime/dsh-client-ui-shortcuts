// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { createBossHideCommand, bossHideViaBridge } from '../src/client/keyboard/boss-hide.js'

describe('bossHideViaBridge', () => {
  it('calls the first bridge with a closeWindow function and skips the rest', () => {
    const first = { closeWindow: vi.fn().mockResolvedValue(undefined) }
    const second = { closeWindow: vi.fn().mockResolvedValue(undefined) }
    bossHideViaBridge([undefined, first, second])
    expect(first.closeWindow).toHaveBeenCalledTimes(1)
    expect(second.closeWindow).not.toHaveBeenCalled()
  })

  it('is a no-op when no bridge has closeWindow (fork registry or absent service)', () => {
    const closeSpy = vi.spyOn(window, 'close').mockImplementation(() => {})
    try {
      expect(() => bossHideViaBridge([undefined, {}, { closeWindow: 'not a function' } as never])).not.toThrow()
      expect(closeSpy).not.toHaveBeenCalled()
    } finally {
      closeSpy.mockRestore()
    }
  })

  it('never calls window.close even when a bridge rejects', async () => {
    const closeSpy = vi.spyOn(window, 'close').mockImplementation(() => {})
    const rejections: Array<Promise<unknown>> = []
    const rejecting = { closeWindow: vi.fn(() => Promise.reject(new Error('Desktop keyboard bridge unavailable'))) }
    try {
      expect(() => bossHideViaBridge([rejecting])).not.toThrow()
      expect(rejecting.closeWindow).toHaveBeenCalledTimes(1)
      expect(closeSpy).not.toHaveBeenCalled()
      // The rejection is swallowed inside; give the microtask queue a tick.
      await Promise.resolve()
      expect(closeSpy).not.toHaveBeenCalled()
    } finally {
      closeSpy.mockRestore()
      void rejections
    }
  })

  it('swallows a synchronous bridge throw and keeps going to the next bridge', () => {
    const throwing = { closeWindow: vi.fn(() => { throw new Error('sync reject') }) }
    const good = { closeWindow: vi.fn().mockResolvedValue(undefined) }
    expect(() => bossHideViaBridge([throwing, good])).not.toThrow()
    expect(throwing.closeWindow).toHaveBeenCalledTimes(1)
    expect(good.closeWindow).toHaveBeenCalledTimes(1)
  })
})

describe('boss-hide official command', () => {
  it('is unbound on every profile and always resolves handled', () => {
    const command = createBossHideCommand(() => '老板键:隐藏窗口到托盘', vi.fn())
    expect(command.defaults).toEqual({})
    expect(command.id).toBe('dsh-shortcuts.bossHide')
    const resolution = command.resolve({ modal: null, region: 'page', target: null })
    expect(resolution.status).toBe('handled')
    if (resolution.status === 'handled') resolution.run()
    const editable = command.resolve({ modal: null, region: 'editable', target: null })
    expect(editable.status).toBe('handled')
  })
})
