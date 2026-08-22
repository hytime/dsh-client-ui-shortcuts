// @vitest-environment jsdom
import React from 'react'
import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ShortcutKeycap, ShortcutKeycapPlus, shortcutKeyIconRenderers } from '../src/client/components/ShortcutKeycap.js'
import { ShortcutKeyIcon } from '../src/client/contract/keyboard-visual.js'

afterEach(() => document.body.replaceChildren())

describe('ShortcutKeycap', () => {
  it('renders every visual key as a local SVG keycap with an accessible name', () => {
    render(<ShortcutKeycap visual={{ icon: ShortcutKeyIcon.Command, label: '⌘', ariaLabel: 'Command' }} />)
    const keycap = screen.getByRole('img', { name: 'Command' })
    expect(keycap.tagName.toLowerCase()).toBe('svg')
    expect(screen.queryByText('Mod')).toBeNull()
  })

  it('declares an explicit renderer for every visual icon', () => {
    expect(Object.keys(shortcutKeyIconRenderers).sort()).toEqual(Object.values(ShortcutKeyIcon).sort())
  })

  it('renders every visual key through an explicit SVG path', () => {
    for (const icon of Object.values(ShortcutKeyIcon)) {
      render(<ShortcutKeycap visual={{ icon, label: icon, ariaLabel: icon }} />)
      const image = screen.getByRole('img', { name: icon })
      expect(image.tagName.toLowerCase()).toBe('svg')
      expect(image.closest('kbd')).toBeTruthy()
      document.body.replaceChildren()
    }
  })

  it('renders plus as a local decorative SVG without a network provider', () => {
    const { container } = render(<ShortcutKeycapPlus />)
    const plus = container.querySelector('svg')
    expect(plus).toBeTruthy()
    expect(plus?.getAttribute('aria-hidden')).toBe('true')
    expect(plus?.querySelector('path')).toBeTruthy()
    expect(container.querySelector('use')).toBeNull()
  })
  it('renders character keys as SVG text inside a stable keycap', () => {
    render(<ShortcutKeycap visual={{ icon: ShortcutKeyIcon.Character, label: 'N', ariaLabel: 'N' }} />)
    expect(screen.getByRole('img', { name: 'N' })).toBeTruthy()
    expect(screen.getByRole('img', { name: 'N' }).closest('kbd')).toBeTruthy()
  })
})
