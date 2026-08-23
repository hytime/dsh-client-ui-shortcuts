import { describe, expect, it, vi } from 'vitest'
import { createGlobalKeyboardRouter, GLOBAL_SEQUENCE_TIMEOUT_MS } from '../src/client/keyboard/router.js'
import type { ShortcutProfile } from '../src/client/contract/profile.js'

type RouterEvent = {
  readonly key: string
  readonly altKey: boolean
  readonly ctrlKey: boolean
  readonly metaKey: boolean
  readonly shiftKey: boolean
  readonly isComposing: boolean
  readonly repeat: boolean
  readonly keyCode: number
  readonly target: EventTarget | null
  preventDefault(): void
  stopImmediatePropagation?(): void
}

describe('global keyboard router', () => {
  it('dispatches a default Mod global binding and consumes the event', () => {
    let listener: (event: RouterEvent) => void = () => {}
    const target = {
      addEventListener: (_type: string, callback: EventListener) => { listener = callback as unknown as (event: RouterEvent) => void },
      removeEventListener: vi.fn(),
      setTimeout: vi.fn(),
      clearTimeout: vi.fn(),
    }
    const callback = vi.fn()
    const profile = {
      id: 'standard', label: 'standard', description: 'standard',
      bindings: [{ command: 'nextSession', scope: 'global', sequences: [[{ key: 'ArrowRight', modifiers: ['Mod'] }]] }],
    } as unknown as ShortcutProfile
    const preventDefault = vi.fn()
    const stopPropagation = vi.fn()
    const dispose = createGlobalKeyboardRouter(target, { getProfile: () => profile, getActions: () => ({ nextSession: callback }) })

    listener({ key: 'ArrowRight', altKey: false, ctrlKey: true, metaKey: false, shiftKey: false, isComposing: false, repeat: false, keyCode: 39, target: null, preventDefault, stopPropagation })

    expect(callback).toHaveBeenCalledOnce()
    expect(preventDefault).toHaveBeenCalledOnce()
    expect(stopPropagation).toHaveBeenCalledOnce()
    dispose()
  })

  it('uses only the platform Mod modifier for global bindings', () => {
    let listener: (event: RouterEvent) => void = () => {}
    const target = {
      addEventListener: (_type: string, callback: EventListener) => { listener = callback as unknown as (event: RouterEvent) => void },
      removeEventListener: vi.fn(),
      setTimeout: vi.fn(),
      clearTimeout: vi.fn(),
    }
    const callback = vi.fn()
    const profile = {
      id: 'mac', label: 'mac', description: 'mac',
      bindings: [{ command: 'startSession', scope: 'global', key: { key: 'n', modifiers: ['Mod'] } }],
    } as unknown as ShortcutProfile
    const options = {
      getProfile: () => profile,
      getActions: () => ({ startSession: callback }),
      platform: 'mac',
    } as Parameters<typeof createGlobalKeyboardRouter>[1]
    const dispose = createGlobalKeyboardRouter(target, options)

    listener({ key: 'n', altKey: false, ctrlKey: true, metaKey: false, shiftKey: false, isComposing: false, repeat: false, keyCode: 78, target: null, preventDefault: vi.fn(), stopPropagation: vi.fn() })
    expect(callback).not.toHaveBeenCalled()
    listener({ key: 'n', altKey: false, ctrlKey: false, metaKey: true, shiftKey: false, isComposing: false, repeat: false, keyCode: 78, target: null, preventDefault: vi.fn(), stopPropagation: vi.fn() })
    expect(callback).toHaveBeenCalledOnce()
    dispose()
  })

  it('registers capture listeners and stops same-page propagation for handled keys', () => {
    let listener: (event: RouterEvent) => void = () => {}
    const addEventListener = vi.fn((_type: string, callback: EventListener) => { listener = callback as unknown as (event: RouterEvent) => void })
    const removeEventListener = vi.fn()
    const target = { addEventListener, removeEventListener, setTimeout: vi.fn(), clearTimeout: vi.fn() }
    const profile = {
      id: 'capture', label: 'capture', description: 'capture',
      bindings: [{ command: 'startSession', scope: 'global', key: { key: 'n', modifiers: ['Ctrl'] } }],
    } as unknown as ShortcutProfile
    const preventDefault = vi.fn()
    const stopPropagation = vi.fn()
    const stopImmediatePropagation = vi.fn()
    const dispose = createGlobalKeyboardRouter(target, { getProfile: () => profile, getActions: () => ({ startSession: vi.fn() }), platform: 'linux' })

    expect(addEventListener).toHaveBeenCalledWith('keydown', expect.any(Function), { capture: true })
    listener({ key: 'n', altKey: false, ctrlKey: true, metaKey: false, shiftKey: false, isComposing: false, repeat: false, keyCode: 78, target: null, preventDefault, stopPropagation, stopImmediatePropagation })
    expect(preventDefault).toHaveBeenCalledOnce()
    expect(stopPropagation).toHaveBeenCalledOnce()
    expect(stopImmediatePropagation).toHaveBeenCalledOnce()
    dispose()
    expect(removeEventListener).toHaveBeenCalledWith('keydown', expect.any(Function), { capture: true })
  })

  it('starts the timeout for a shifted uppercase chord prefix', () => {
    let listener: (event: RouterEvent) => void = () => {}
    const setTimeout = vi.fn(() => 1)
    const target = {
      addEventListener: (_type: string, callback: EventListener) => { listener = callback as unknown as (event: RouterEvent) => void },
      removeEventListener: vi.fn(),
      setTimeout,
      clearTimeout: vi.fn(),
    }
    const profile = {
      id: 'chord',
      label: 'chord',
      description: 'chord',
      bindings: [{
        command: 'forkSession',
        scope: 'global',
        sequences: [[{ key: 'b', modifiers: ['Mod', 'Shift'] }, { key: 's', modifiers: [] }]],
      }],
    } as unknown as ShortcutProfile

    const dispose = createGlobalKeyboardRouter(target, {
      getProfile: () => profile,
      getActions: () => ({ forkSession: vi.fn() }),
    })
    listener({ key: 'B', altKey: false, ctrlKey: true, metaKey: false, shiftKey: true, isComposing: false, repeat: false, keyCode: 66, target: null, preventDefault: vi.fn(), stopPropagation: vi.fn() })

    expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), GLOBAL_SEQUENCE_TIMEOUT_MS)
    dispose()
  })

  it('consumes a matched chord prefix before browser defaults run', () => {
    let listener: (event: RouterEvent) => void = () => {}
    const target = {
      addEventListener: (_type: string, callback: EventListener) => { listener = callback as unknown as (event: RouterEvent) => void },
      removeEventListener: vi.fn(),
      setTimeout: vi.fn(() => 1),
      clearTimeout: vi.fn(),
    }
    const profile = {
      id: 'browser-chord', label: 'browser-chord', description: 'browser-chord',
      bindings: [{
        command: 'forkSession',
        scope: 'global',
        sequences: [[{ key: 'b', modifiers: ['Mod', 'Shift'] }, { key: 's', modifiers: [] }]],
      }],
    } as unknown as ShortcutProfile
    const preventDefault = vi.fn()
    const stopPropagation = vi.fn()
    const dispose = createGlobalKeyboardRouter(target, {
      getProfile: () => profile,
      getActions: () => ({ forkSession: vi.fn() }),
    })

    listener({ key: 'B', altKey: false, ctrlKey: true, metaKey: false, shiftKey: true, isComposing: false, repeat: false, keyCode: 66, target: null, preventDefault, stopPropagation })

    expect(preventDefault).toHaveBeenCalledOnce()
    expect(stopPropagation).toHaveBeenCalledOnce()
    dispose()
  })
})
