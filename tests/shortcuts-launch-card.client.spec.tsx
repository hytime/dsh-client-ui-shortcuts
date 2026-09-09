// @vitest-environment jsdom
import React from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ShortcutLaunchCard } from '../src/client/components/ShortcutLaunchCard.js'
import type { ShortcutLaunchCardProps } from '../src/client/contract/overlay.js'
import type { ManagedShortcutProfile } from '../src/client/contract/settings.js'
import { standardProfile, vimProfile } from '../src/client/profiles/builtins.js'

afterEach(cleanup)

const t = (key: string) => key

function settingsStub(activeId = 'standard') {
  const profiles: ManagedShortcutProfile[] = [standardProfile, vimProfile].map(profile => ({
    ...profile, kind: 'builtin', displayName: profile.label, fingerprint: `builtin:${profile.id}`,
  }))
  return {
    profiles: () => profiles,
    activeProfileId: () => activeId,
    subscribe: () => () => {},
  } as unknown as ShortcutLaunchCardProps['settings']
}

function makeProps(overrides: Partial<ShortcutLaunchCardProps> = {}): ShortcutLaunchCardProps {
  return {
    settings: settingsStub(),
    platform: 'mac',
    t,
    onOpen: vi.fn(),
    ...overrides,
  }
}

describe('ShortcutLaunchCard', () => {
  it('shows the current showShortcuts binding and opens the panel on click', () => {
    const onOpen = vi.fn()
    render(<ShortcutLaunchCard {...makeProps({ onOpen })} />)
    expect(screen.getByText('launch.title')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'launch.open' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'launch.open' }))
    expect(onOpen).toHaveBeenCalledOnce()
  })

  it('renders the active profile showShortcuts keycap', () => {
    render(<ShortcutLaunchCard {...makeProps()} />)
    // Meta+Alt+Shift+S on mac: Command/Option/Shift icons plus the 'S' character keycap.
    expect(screen.getAllByLabelText('Command').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByLabelText('S').length).toBeGreaterThanOrEqual(1)
  })

  it('adapts Meta keycap label for non-mac platforms', () => {
    render(<ShortcutLaunchCard {...makeProps({ platform: 'linux' })} />)
    expect(screen.getAllByLabelText('Windows key').length).toBeGreaterThanOrEqual(1)
  })
})
