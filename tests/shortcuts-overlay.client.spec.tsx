// @vitest-environment jsdom
import React from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ShortcutOverlay } from '../src/client/components/ShortcutOverlay.js'
import type { ShortcutOverlayProps } from '../src/client/contract/overlay.js'
import type { ManagedShortcutProfile } from '../src/client/contract/settings.js'
import { standardProfile, vimProfile } from '../src/client/profiles/builtins.js'

afterEach(cleanup)

const t = (key: string) => key

function settingsStub(activeId = 'standard', profilesInput = [standardProfile, vimProfile]) {
  const profiles: ManagedShortcutProfile[] = profilesInput.map(profile => ({
    ...profile, kind: 'builtin', displayName: profile.label, fingerprint: `builtin:${profile.id}`,
  }))
  return {
    profiles: () => profiles,
    activeProfileId: () => activeId,
    subscribe: () => () => {},
    writable: () => true,
  } as unknown as ShortcutOverlayProps['settings']
}

function controllerStub(open = true) {
  const state = { open }
  const listeners = new Set<() => void>()
  return {
    isOpen: () => state.open,
    toggle: () => { state.open = !state.open; listeners.forEach(l => l()) },
    close: () => { state.open = false; listeners.forEach(l => l()) },
    subscribe: (l: () => void) => { listeners.add(l); return () => { listeners.delete(l) } },
  }
}

function makeProps(overrides: Partial<ShortcutOverlayProps> = {}): ShortcutOverlayProps {
  return {
    settings: settingsStub(),
    controller: controllerStub(true),
    availableGlobalActions: ['showShortcuts', 'startSession', 'toggleTheme'],
    platform: 'mac',
    t,
    ...overrides,
  }
}

describe('ShortcutOverlay', () => {
  it('renders nothing while the controller is closed', () => {
    render(<ShortcutOverlay {...makeProps({ controller: controllerStub(false) })} />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('renders scopes and reuses the shared legend visuals', () => {
    const ctrlProfile = {
      ...standardProfile,
      id: 'ctrl', label: 'Ctrl profile', description: '',
      bindings: [...standardProfile.bindings, { command: 'focusNext', scope: 'approval', key: { key: 'j', modifiers: ['Ctrl'] } }],
    }
    render(<ShortcutOverlay {...makeProps({ settings: settingsStub('ctrl', [standardProfile, ctrlProfile]) })} />)
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByRole('searchbox')).toBeTruthy()
    expect(screen.getByText('legend.scope.question')).toBeTruthy()
    expect(screen.getByText('legend.scope.approval')).toBeTruthy()
    expect(screen.getByText('legend.scope.global')).toBeTruthy()
    expect(screen.getByText('keyboard.showShortcuts')).toBeTruthy()
    expect(screen.getAllByText('keyboard.focusNext').length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByLabelText('Control').length).toBeGreaterThanOrEqual(1)
  })

  it('filters rows by search query and restores on clear', () => {
    render(<ShortcutOverlay {...makeProps()} />)
    expect(screen.getAllByText('keyboard.focusNext').length).toBeGreaterThanOrEqual(1)
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Session' } })
    expect(screen.getByText('keyboard.startSession')).toBeTruthy()
    expect(screen.queryAllByText('keyboard.focusNext')).toHaveLength(0)
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '' } })
    expect(screen.getAllByText('keyboard.focusNext').length).toBeGreaterThanOrEqual(1)
  })

  it('greys unavailable global actions with a reason', () => {
    render(<ShortcutOverlay {...makeProps({ availableGlobalActions: ['showShortcuts', 'toggleTheme'] })} />)
    const row = screen.getByText('keyboard.startSession').closest('[aria-disabled="true"]')
    expect(row).toBeTruthy()
    expect(screen.getAllByText('overlay.unavailable').length).toBeGreaterThanOrEqual(1)
  })

  it('never renders dead legacy commands (openSettings/openCommandPalette) as enabled', () => {
    render(<ShortcutOverlay {...makeProps()} />)
    // standardProfile carries legacy global bindings that are never available actions.
    for (const command of ['keyboard.openSettings', 'keyboard.openCommandPalette']) {
      const row = screen.getByText(command).closest('[aria-disabled="true"]')
      expect(row).toBeTruthy()
    }
    // Disabled rows render the reason instead of keycaps.
    expect(screen.queryByText('keyboard.openSettings')!.closest('[aria-disabled="true"]')!.querySelector('[aria-label="Command"]')).toBeNull()
  })

  it('closes on an Escape keydown', () => {
    const controller = controllerStub(true)
    vi.spyOn(controller, 'close')
    render(<ShortcutOverlay {...makeProps({ controller })} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(controller.close).toHaveBeenCalled()
  })

  it('closes when the backdrop itself is clicked but not when the panel is', () => {
    const controller = controllerStub(true)
    vi.spyOn(controller, 'close')
    render(<ShortcutOverlay {...makeProps({ controller })} />)
    fireEvent.click(screen.getByRole('searchbox'))
    expect(controller.close).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('dialog'))
    expect(controller.close).toHaveBeenCalledTimes(1)
  })

  it('toggles via controller subscription', () => {
    const controller = controllerStub(true)
    const { unmount } = render(<ShortcutOverlay {...makeProps({ controller })} />)
    expect(screen.getByRole('dialog')).toBeTruthy()
    act(() => { controller.close() })
    expect(screen.queryByRole('dialog')).toBeNull()
    unmount()
  })

  it('restores focus to the element that owned it before the overlay opened', () => {
    const owner = document.createElement('input')
    document.body.append(owner)
    owner.focus()
    expect(document.activeElement).toBe(owner)
    const controller = controllerStub(true)
    render(<ShortcutOverlay {...makeProps({ controller, restoreFocus: () => owner })} />)
    expect(screen.getByRole('dialog')).toBeTruthy()
    act(() => { controller.close() })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(owner)
    owner.remove()
  })
})
