import { describe, expect, it, vi } from 'vitest'
import { OverlayController } from '../src/client/overlay/controller.js'

describe('OverlayController', () => {
  it('starts closed', () => {
    expect(new OverlayController().isOpen()).toBe(false)
  })
  it('toggle opens then closes and notifies listeners', () => {
    const controller = new OverlayController()
    const listener = vi.fn()
    controller.subscribe(listener)
    controller.toggle()
    expect(controller.isOpen()).toBe(true)
    expect(listener).toHaveBeenCalledTimes(1)
    controller.toggle()
    expect(controller.isOpen()).toBe(false)
    expect(listener).toHaveBeenCalledTimes(2)
  })
  it('close is idempotent and dispose stops notifications', () => {
    const controller = new OverlayController()
    controller.close()
    controller.close()
    expect(controller.isOpen()).toBe(false)
    const listener = vi.fn()
    const off = controller.subscribe(listener)
    controller.toggle()
    expect(listener).toHaveBeenCalledTimes(1)
    off()
    controller.close()
    expect(listener).toHaveBeenCalledTimes(1)
  })
  it('openWithFocus opens and records the requested command', () => {
    const controller = new OverlayController()
    expect(controller.isOpen()).toBe(false)
    expect(controller.focusCommand()).toBeUndefined()
    controller.openWithFocus('showShortcuts')
    expect(controller.isOpen()).toBe(true)
    expect(controller.focusCommand()).toBe('showShortcuts')
    controller.toggle() // close
    expect(controller.focusCommand()).toBeUndefined()
  })
})
