// @vitest-environment jsdom
import React from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ShortcutBindingEditor } from '../src/client/components/ShortcutBindingEditor.js'

const bindings = [
  { command: 'openCommandPalette' as const, scope: 'global' as const, key: { key: 'p', modifiers: ['Mod'] as const } },
  { command: 'openSettings' as const, scope: 'global' as const, key: { key: ',', modifiers: ['Mod'] as const } },
]
const t = (key: string) => key

afterEach(cleanup)

describe('ShortcutBindingEditor', () => {
  it('renders Mod as Control on non-mac platforms and preserves hidden bindings on save', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    const hidden = { command: 'openSettings' as const, scope: 'global' as const, key: { key: 's', modifiers: ['Meta'] as const } }
    render(<ShortcutBindingEditor platform="linux" bindings={[bindings[0]!, hidden]} availableGlobalActions={['openCommandPalette', 'openSettings']} t={t} onSave={onSave} />)
    expect(screen.getByRole('img', { name: 'Control' })).toBeTruthy()
    expect(screen.queryByText('openSettings')).toBeNull()
    fireEvent.click(screen.getByText('editor.save').closest('button')!)
    expect(onSave).toHaveBeenCalledWith([bindings[0], hidden])
  })

  it('captures modifiers and cancels recording with Escape', () => {
    render(<ShortcutBindingEditor bindings={bindings} t={t} onSave={vi.fn()} />)
    const record = screen.getAllByRole('button')[0]!
    fireEvent.click(record)
    fireEvent.keyDown(record, { key: 'b', ctrlKey: true, shiftKey: true })
    expect(screen.getAllByRole('img', { name: 'Control' }).length).toBeGreaterThan(0)
    expect(screen.getByRole('img', { name: 'B' })).toBeTruthy()
    fireEvent.click(record)
    fireEvent.keyDown(record, { key: 'Escape' })
    expect(record.textContent).not.toContain('recording')
  })

  it('shows conflict and disables save', () => {
    const onSave = vi.fn()
    render(<ShortcutBindingEditor bindings={[
      bindings[0]!,
      { command: 'openSettings', scope: 'global', key: { key: 'p', modifiers: ['Mod'] } },
    ]} t={t} onSave={onSave} />)
    expect(screen.getByRole('alert')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'editor.save' }) as HTMLButtonElement).disabled).toBe(true)
    expect(onSave).not.toHaveBeenCalled()
  })

  it('saves a captured binding and retains draft after failed save', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('nope'))
    render(<ShortcutBindingEditor bindings={[{ ...bindings[0]!, key: { key: 'p', modifiers: ['Mod'] as const } }, { command: 'openSettings' as const, scope: 'global' as const, key: { key: ',', modifiers: ['Mod'] as const } }]} t={t} onSave={onSave} />)
    const record = screen.getAllByRole('button')[0]!
    fireEvent.click(record)
    fireEvent.keyDown(record, { key: 'b', ctrlKey: true, shiftKey: true })
    expect(screen.getByRole('img', { name: 'B' })).toBeTruthy()
    expect((screen.getByText('editor.save').closest('button') as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(screen.getByText('editor.save').closest('button')!)
    expect(onSave).toHaveBeenCalled()
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(screen.getByText(/editor.saveFailed/)).toBeTruthy()
    expect(screen.getByRole('img', { name: 'B' })).toBeTruthy()
  })
})
