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
  stopPropagation(): void
}

describe('global keyboard router', () => {
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
})
