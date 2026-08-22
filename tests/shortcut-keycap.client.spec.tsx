// @vitest-environment jsdom
import React from 'react'
import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ShortcutKeycap } from '../src/client/components/ShortcutKeycap.js'
import { ShortcutKeyIcon } from '../src/client/contract/keyboard-visual.js'

afterEach(() => document.body.replaceChildren())

describe('ShortcutKeycap', () => {
  it('renders every visual key as a local SVG keycap with an accessible name', () => {
    render(<ShortcutKeycap visual={{ icon: ShortcutKeyIcon.Command, label: '⌘', ariaLabel: 'Command' }} />)
    const keycap = screen.getByRole('img', { name: 'Command' })
    expect(keycap.tagName.toLowerCase()).toBe('svg')
    expect(screen.queryByText('Mod')).toBeNull()
  })

  it('renders character keys as SVG text inside a stable keycap', () => {
    render(<ShortcutKeycap visual={{ icon: ShortcutKeyIcon.Character, label: 'N', ariaLabel: 'N' }} />)
    expect(screen.getByRole('img', { name: 'N' })).toBeTruthy()
    expect(screen.getByRole('img', { name: 'N' }).closest('kbd')).toBeTruthy()
  })
})
