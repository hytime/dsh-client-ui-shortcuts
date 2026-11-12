// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createOpenModelMenuCommand,
  createOpenThinkingDepthCommand,
  openModelMenu,
  openThinkingDepth,
  OPEN_MODEL_MENU_COMMAND,
  OPEN_THINKING_DEPTH_COMMAND,
} from '../src/client/keyboard/model-menu.js'

interface Seat {
  trigger: HTMLButtonElement
  model: HTMLButtonElement
  effort: HTMLButtonElement
}

function seat(expanded: boolean): Seat {
  document.body.innerHTML = `
    <div data-slot="conversation.input.model">
      <button id="trigger" aria-haspopup="menu" aria-expanded="${expanded}" aria-controls="pop">Model</button>
    </div>
    <div id="pop" role="menu">
      <button role="menuitem" id="model-cell">Model</button>
      <button role="menuitem" id="effort-cell">Effort</button>
    </div>`
  return {
    trigger: document.getElementById('trigger') as HTMLButtonElement,
    model: document.getElementById('model-cell') as HTMLButtonElement,
    effort: document.getElementById('effort-cell') as HTMLButtonElement,
  }
}

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('non-official model-menu commands', () => {
  it('openModelMenu carries its id, Mod+M defaults, and handled resolve', () => {
    const command = createOpenModelMenuCommand(() => 'Open model menu')
    expect(command.id).toBe(OPEN_MODEL_MENU_COMMAND)
    const defaults = command.defaults as Record<string, unknown>
    expect(defaults['desktop:windows']).toEqual({ code: 'KeyM', modifiers: ['primary'] })
    expect(defaults['desktop:macos']).toEqual({ code: 'KeyM', modifiers: ['primary'] })
    expect(defaults['web:windows']).toEqual({ code: 'KeyM', modifiers: ['primary'] })
    expect(defaults['web:linux']).toBeUndefined() // Linux Web keeps no default
    expect(command.resolve({ modal: null } as never)).toEqual({ status: 'handled', run: expect.any(Function) })
  })

  it('openThinkingDepth is unbound by default', () => {
    const command = createOpenThinkingDepthCommand(() => 'Open thinking depth')
    expect(command.id).toBe(OPEN_THINKING_DEPTH_COMMAND)
    expect(command.defaults).toEqual({})
    expect(command.resolve({ modal: null } as never)).toEqual({ status: 'handled', run: expect.any(Function) })
  })

  it('clicks the seat trigger only when the popup is closed', () => {
    const closed = seat(false)
    const closedClick = vi.fn()
    closed.trigger.addEventListener('click', closedClick)
    openModelMenu()
    expect(closedClick).toHaveBeenCalledTimes(1)

    const open = seat(true)
    const openClick = vi.fn()
    open.trigger.addEventListener('click', openClick)
    openModelMenu()
    expect(openClick).not.toHaveBeenCalled()
  })

  it('is a no-op when no seat trigger exists', () => {
    document.body.innerHTML = '<div></div>'
    expect(() => openModelMenu()).not.toThrow()
    expect(() => openThinkingDepth()).not.toThrow()
  })

  it('drills into the second (effort) cell, never the model cell', () => {
    vi.useFakeTimers()
    const { trigger, model, effort } = seat(false)
    const triggerClick = vi.fn(); trigger.addEventListener('click', triggerClick)
    const modelClick = vi.fn(); model.addEventListener('click', modelClick)
    const effortClick = vi.fn(); effort.addEventListener('click', effortClick)
    openThinkingDepth()
    vi.advanceTimersByTime(100)
    expect(triggerClick).toHaveBeenCalledTimes(1)
    expect(effortClick).toHaveBeenCalledTimes(1)
    expect(modelClick).not.toHaveBeenCalled()
  })

  it('does not fire when the effort cell is absent', () => {
    vi.useFakeTimers()
    document.body.innerHTML = `
      <div data-slot="conversation.input.model">
        <button id="trigger" aria-haspopup="menu" aria-expanded="false" aria-controls="pop">Model</button>
      </div>
      <div id="pop" role="menu"><button role="menuitem" id="model-cell">Model</button></div>`
    const model = document.getElementById('model-cell') as HTMLButtonElement
    const modelClick = vi.fn(); model.addEventListener('click', modelClick)
    openThinkingDepth()
    vi.advanceTimersByTime(1000)
    expect(modelClick).not.toHaveBeenCalled()
  })
})
