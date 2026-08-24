// @vitest-environment jsdom
import React from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ShortcutBindingEditor } from '../src/client/components/ShortcutBindingEditor.js'

const bindings = [
  { command: 'openCommandPalette' as const, scope: 'global' as const, key: { key: 'q', modifiers: ['Meta'] as const } },
  { command: 'openSettings' as const, scope: 'global' as const, key: { key: ',', modifiers: ['Ctrl'] as const } },
]
const t = (key: string) => key

afterEach(cleanup)

describe('ShortcutBindingEditor', () => {
  it('labels Alt as Option on macOS and Alt elsewhere', () => {
    const altBinding = { command: 'openCommandPalette' as const, scope: 'global' as const, key: { key: 'q', modifiers: ['Alt'] as const } }
    const props = { bindings: [altBinding], availableGlobalActions: ['openCommandPalette'] as const, t, onSave: vi.fn() }

    render(<ShortcutBindingEditor platform="mac" {...props} />)
    expect(screen.getByText('modifier.Option')).toBeTruthy()
    expect(screen.queryByText('modifier.Alt')).toBeNull()
    cleanup()

    render(<ShortcutBindingEditor platform="windows" {...props} />)
    expect(screen.getByText('modifier.Alt')).toBeTruthy()
    expect(screen.queryByText('modifier.Option')).toBeNull()
  })
  it('renders explicit Meta as Command on macOS and preserves hidden bindings on save', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    const hidden = { command: 'openSettings' as const, scope: 'global' as const, key: { key: 's', modifiers: ['Ctrl'] as const } }
    render(<ShortcutBindingEditor platform="mac" bindings={[bindings[0]!, hidden]} availableGlobalActions={['openCommandPalette', 'openSettings']} t={t} onSave={onSave} />)
    expect(screen.getAllByRole('img', { name: 'Command' }).length).toBeGreaterThan(0)
    expect(screen.queryByText('openSettings')).toBeNull()
    expect((screen.getByText('editor.save').closest('button') as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(screen.getByText('editor.save').closest('button')!)
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(onSave).toHaveBeenCalledWith([bindings[0], hidden])
  })

  it('allows Linux saves with a hidden browser-reserved Ctrl binding', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    const hidden = { command: 'openSettings' as const, scope: 'global' as const, key: { key: 'n', modifiers: ['Ctrl'] as const } }
    render(<ShortcutBindingEditor platform="linux" bindings={[bindings[0]!, hidden]} availableGlobalActions={['openCommandPalette', 'openSettings']} t={t} onSave={onSave} />)
    expect((screen.getByRole('button', { name: 'editor.save' }) as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'editor.save' }))
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(onSave).toHaveBeenCalledWith([bindings[0], hidden])
  })

  it('allows macOS saves with a hidden browser-reserved Ctrl binding', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    const hidden = { command: 'openSettings' as const, scope: 'global' as const, key: { key: 'n', modifiers: ['Ctrl'] as const } }
    render(<ShortcutBindingEditor platform="mac" bindings={[bindings[0]!, hidden]} availableGlobalActions={['openCommandPalette', 'openSettings']} t={t} onSave={onSave} />)
    expect((screen.getByRole('button', { name: 'editor.save' }) as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'editor.save' }))
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(onSave).toHaveBeenCalledWith([bindings[0], hidden])
  })

  it('allows Linux saves when hidden Meta binding overlaps visible Ctrl binding across scopes', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    const hidden = { command: 'openSettings' as const, scope: 'question' as const, key: { key: 'n', modifiers: ['Ctrl'] as const } }
    const visible = { command: 'openCommandPalette' as const, scope: 'global' as const, key: { key: 'n', modifiers: ['Ctrl'] as const } }
    render(<ShortcutBindingEditor platform="linux" bindings={[hidden, visible]} availableGlobalActions={['openCommandPalette', 'openSettings']} t={t} onSave={onSave} />)
    expect((screen.getByRole('button', { name: 'editor.save' }) as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'editor.save' }))
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(onSave).toHaveBeenCalledWith([hidden, visible])
  })

  it('allows Windows saves when hidden Meta binding overlaps visible Ctrl binding across scopes', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    const hidden = { command: 'openSettings' as const, scope: 'question' as const, key: { key: 'n', modifiers: ['Ctrl'] as const } }
    const visible = { command: 'openCommandPalette' as const, scope: 'global' as const, key: { key: 'n', modifiers: ['Ctrl'] as const } }
    render(<ShortcutBindingEditor platform="windows" bindings={[hidden, visible]} availableGlobalActions={['openCommandPalette', 'openSettings']} t={t} onSave={onSave} />)
    expect((screen.getByRole('button', { name: 'editor.save' }) as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'editor.save' }))
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(onSave).toHaveBeenCalledWith([hidden, visible])
  })

  it('allows macOS saves when hidden Ctrl binding overlaps visible Meta binding across scopes', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    const hidden = { command: 'openSettings' as const, scope: 'question' as const, key: { key: 'x', modifiers: ['Ctrl'] as const } }
    const visible = { command: 'openCommandPalette' as const, scope: 'global' as const, key: { key: 'x', modifiers: ['Meta'] as const } }
    render(<ShortcutBindingEditor platform="mac" bindings={[hidden, visible]} availableGlobalActions={['openCommandPalette', 'openSettings']} t={t} onSave={onSave} />)
    expect((screen.getByRole('button', { name: 'editor.save' }) as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'editor.save' }))
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(onSave).toHaveBeenCalledWith([hidden, visible])
  })

  it('still blocks visible cross-scope duplicate and prefix conflicts', () => {
    for (const [platform, second] of [
      ['linux', { key: 'n', modifiers: ['Ctrl'] as const }],
      ['mac', { key: 'n', modifiers: ['Meta'] as const }],
    ] as const) {
      const onSave = vi.fn()
      render(<ShortcutBindingEditor platform={platform} bindings={[{ ...bindings[0]!, scope: 'question', key: { key: 'n', modifiers: ['Meta'] as const } }, { command: 'openSettings' as const, scope: 'global', key: second }]} availableGlobalActions={['openCommandPalette', 'openSettings']} t={t} onSave={onSave} />)
      expect((screen.getByRole('button', { name: 'editor.save' }) as HTMLButtonElement).disabled).toBe(true)
      cleanup()
    }
  })

  it('blocks a visible browser-reserved Meta binding', () => {
    const onSave = vi.fn()
    render(<ShortcutBindingEditor platform="linux" bindings={[{ ...bindings[0]!, key: { key: 'n', modifiers: ['Meta'] as const }}]} t={t} onSave={onSave} />)
    expect(screen.getByRole('alert')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'editor.save' }) as HTMLButtonElement).disabled).toBe(true)
    expect(onSave).not.toHaveBeenCalled()
  })

  it('validates hidden platform bindings while preserving them in the draft', () => {
    const onSave = vi.fn()
    render(<ShortcutBindingEditor platform="linux" bindings={[bindings[0]!, { command: 'openSettings', scope: 'global', key: { key: 's', modifiers: ['Meta'] }, sequence: [] } as never]} availableGlobalActions={['openCommandPalette', 'openSettings']} t={t} onSave={onSave} />)
    expect(screen.getByRole('alert')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'editor.save' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('preserves hidden sequence payloads when a visible binding changes', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    const hidden = { command: 'openSettings' as const, scope: 'global' as const, key: { key: 's', modifiers: ['Meta'] as const }, sequence: [{ key: 'x', modifiers: ['Ctrl'] as const }] }
    render(<ShortcutBindingEditor platform="linux" bindings={[bindings[0]!, hidden as never]} availableGlobalActions={['openCommandPalette', 'openSettings']} t={t} onSave={onSave} />)
    const record = screen.getAllByRole('button')[0]!
    fireEvent.click(record)
    expect((screen.getByText('editor.save').closest('button') as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByText('editor.save').closest('button')!)
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(onSave).not.toHaveBeenCalled()
    expect(hidden).toEqual({ command: 'openSettings', scope: 'global', key: { key: 's', modifiers: ['Meta'] }, sequence: [{ key: 'x', modifiers: ['Ctrl'] }] })
  })
  it('edits the first sequence stroke without dropping later strokes or alternatives', () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    const sequenceBinding = {
      command: 'openCommandPalette' as const,
      scope: 'global' as const,
      sequences: [
        [{ key: 'g', modifiers: ['Meta'] as const }, { key: 's', modifiers: ['Shift'] as const }],
        [{ key: 'p', modifiers: ['Meta'] as const }, { key: 'x', modifiers: ['Alt'] as const }],
      ],
    }
    render(<ShortcutBindingEditor platform="linux" bindings={[sequenceBinding]} availableGlobalActions={['openCommandPalette']} t={t} onSave={onSave} />)
    const record = screen.getAllByRole('button')[0]!
    fireEvent.click(record)
    fireEvent.keyDown(record, { key: 'b', ctrlKey: true })
    fireEvent.click(screen.getByRole('button', { name: 'editor.save' }))
    expect(onSave).toHaveBeenCalledWith([{
      command: 'openCommandPalette',
      scope: 'global',
      sequences: [
        [{ key: 'b', modifiers: ['Ctrl'] }, { key: 's', modifiers: ['Shift'] }],
        [{ key: 'p', modifiers: ['Meta'] }, { key: 'x', modifiers: ['Alt'] }],
      ],
    }])
  })

  it('keeps malformed and ambiguous sequence bindings unsaveable', () => {
    for (const binding of [
      { command: 'openCommandPalette', scope: 'global', sequence: [] },
      { command: 'openCommandPalette', scope: 'global', key: { key: 'p', modifiers: ['Meta'] }, sequence: [{ key: 'x', modifiers: [] }] },
    ] as never[]) {
      const onSave = vi.fn()
      render(<ShortcutBindingEditor platform="linux" bindings={[binding]} availableGlobalActions={['openCommandPalette']} t={t} onSave={onSave} />)
      expect(screen.getByRole('alert')).toBeTruthy()
      expect((screen.getByRole('button', { name: 'editor.save' }) as HTMLButtonElement).disabled).toBe(true)
      cleanup()
    }
  })

  it('captures modifiers and cancels recording with Escape', () => {
    render(<ShortcutBindingEditor platform="linux" bindings={bindings} t={t} onSave={vi.fn()} />)
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
    render(<ShortcutBindingEditor platform="linux" bindings={[
      bindings[0]!,
      { command: 'openSettings', scope: 'global', key: { key: 'p', modifiers: ['Meta'] } },
    ]} t={t} onSave={onSave} />)
    expect(screen.getByRole('alert')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'editor.save' }) as HTMLButtonElement).disabled).toBe(true)
    expect(onSave).not.toHaveBeenCalled()
  })
  it('saves a captured binding and retains draft after failed save', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('nope'))
    render(<ShortcutBindingEditor platform="linux" bindings={[{ ...bindings[0]!, key: { key: 'p', modifiers: ['Meta'] as const } }, { command: 'openSettings' as const, scope: 'global' as const, key: { key: ',', modifiers: ['Meta'] as const } }]} t={t} onSave={onSave} />)
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
