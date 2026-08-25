// @vitest-environment jsdom
import React from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ShortcutBindingEditor } from '../src/client/components/ShortcutBindingEditor.js'
import { CustomProfileEditor } from '../src/client/components/CustomProfileEditor.js'

const bindings = [
  { command: 'openCommandPalette' as const, scope: 'global' as const, key: { key: 'q', modifiers: ['Meta'] as const } },
  { command: 'openSettings' as const, scope: 'global' as const, key: { key: ',', modifiers: ['Ctrl'] as const } },
]
const t = (key: string) => ({
  'editor.profileName': 'Profile name', 'editor.nameCount': '{count} / 64', 'editor.save': 'Save', 'editor.cancel': 'Cancel',
  'editor.saveSucceeded': 'Saved', 'editor.saveFailed': 'Failed: {message}', 'editor.externalChange': 'EXTERNAL_CHANGE', 'editor.loadLatest': 'Load latest',
}[key] ?? key)

afterEach(cleanup)

describe('ShortcutBindingEditor', () => {
  it('labels Alt as Option on macOS and Alt elsewhere', () => {
    const altBinding = { command: 'openCommandPalette' as const, scope: 'global' as const, key: { key: 'q', modifiers: ['Alt'] as const } }
    const props = { bindings: [altBinding], availableGlobalActions: ['openCommandPalette'] as const, t, onChange: vi.fn() }
    render(<ShortcutBindingEditor platform="mac" {...props} />)
    expect(screen.getByText('modifier.Option')).toBeTruthy()
    cleanup()
    render(<ShortcutBindingEditor platform="windows" {...props} />)
    expect(screen.getByText('modifier.Alt')).toBeTruthy()
  })

  it('preserves hidden bindings when a visible binding changes', () => {
    const onChange = vi.fn()
    const hidden = { command: 'openSettings' as const, scope: 'global' as const, key: { key: 's', modifiers: ['Meta'] as const } }
    render(<ShortcutBindingEditor platform="mac" bindings={[bindings[0]!, hidden]} availableGlobalActions={['openCommandPalette']} t={t} onChange={onChange} />)
    expect(screen.queryByText('keyboard.openSettings')).toBeNull()
    fireEvent.click(screen.getAllByRole('checkbox')[1]!)
    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ command: 'openCommandPalette' }), hidden])
  })

  it('preserves later strokes and alternatives when recording a first stroke', () => {
    const onChange = vi.fn()
    const sequenceBinding = { command: 'openCommandPalette' as const, scope: 'global' as const, sequences: [[{ key: 'g', modifiers: ['Meta'] as const }, { key: 's', modifiers: ['Shift'] as const }], [{ key: 'p', modifiers: ['Meta'] as const }, { key: 'x', modifiers: ['Alt'] as const }]] }
    render(<ShortcutBindingEditor platform="linux" bindings={[sequenceBinding]} availableGlobalActions={['openCommandPalette']} t={t} onChange={onChange} />)
    const record = screen.getByRole('button')
    fireEvent.click(record)
    fireEvent.keyDown(record, { key: 'b', ctrlKey: true })
    expect(onChange).toHaveBeenCalledWith([{ command: 'openCommandPalette', scope: 'global', sequences: [[{ key: 'b', modifiers: ['Ctrl'] }, { key: 's', modifiers: ['Shift'] }], [{ key: 'p', modifiers: ['Meta'] }, { key: 'x', modifiers: ['Alt'] }]] }])
  })

  it('keeps conflict, browser-reserved, malformed, and hidden validation behavior', () => {
    const cases = [
      [{ ...bindings[0]!, key: { key: 'n', modifiers: ['Meta'] as const } }],
      [bindings[0]!, { command: 'openSettings', scope: 'global', key: { key: 'q', modifiers: ['Meta'] } }],
      [{ command: 'openCommandPalette', scope: 'global', sequence: [] }],
      [bindings[0]!, { command: 'openSettings', scope: 'global', key: { key: 's', modifiers: ['Meta'] }, sequence: [] }],
    ]
    for (const value of cases) {
      render(<ShortcutBindingEditor platform="linux" bindings={value as never} availableGlobalActions={['openCommandPalette', 'openSettings']} t={t} onChange={vi.fn()} />)
      expect(screen.getByRole('alert')).toBeTruthy()
      cleanup()
    }
  })

  it('captures modifiers and cancels recording with Escape', () => {
    const onChange = vi.fn()
    render(<ShortcutBindingEditor platform="linux" bindings={bindings} availableGlobalActions={['openCommandPalette', 'openSettings']} t={t} onChange={onChange} />)
    const record = screen.getAllByRole('button')[0]!
    fireEvent.click(record)
    fireEvent.keyDown(record, { key: 'b', ctrlKey: true, shiftKey: true })
    expect(onChange).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ key: { key: 'b', modifiers: ['Ctrl', 'Shift'] } })]))
    fireEvent.click(record)
    fireEvent.keyDown(record, { key: 'Escape' })
    expect(onChange).toHaveBeenCalledTimes(1)
  })
})

describe('CustomProfileEditor', () => {
  const profile = { id: 'custom-a', name: 'Work', bindings, fingerprint: 'baseline-a' }
  const props = { availableGlobalActions: ['openCommandPalette', 'openSettings'] as const, platform: 'linux' as const, t }

  it('saves the literal name and bindings in one operation', async () => {
    const onSave = vi.fn(async () => {})
    render(<CustomProfileEditor profile={profile} {...props} onSave={onSave} onStateChange={vi.fn()} />)
    fireEvent.change(screen.getByRole('textbox', { name: 'Profile name' }), { target: { value: 'Review' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(onSave).toHaveBeenCalledWith('custom-a', 'baseline-a', 'Review', expect.any(Array)))
  })

  it('counts Unicode code points and rejects empty or overlong names', () => {
    render(<CustomProfileEditor profile={profile} {...props} onSave={vi.fn()} onStateChange={vi.fn()} />)
    const name = screen.getByRole('textbox', { name: 'Profile name' })
    fireEvent.change(name, { target: { value: '😀' } })
    expect(screen.getByText('1 / 64')).toBeTruthy()
    fireEvent.change(name, { target: { value: '' } })
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(name, { target: { value: '😀'.repeat(65) } })
    expect(screen.getByText('65 / 64')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('cancels both name and binding changes', () => {
    render(<CustomProfileEditor profile={profile} {...props} onSave={vi.fn()} onStateChange={vi.fn()} />)
    fireEvent.change(screen.getByRole('textbox', { name: 'Profile name' }), { target: { value: 'Review' } })
    fireEvent.click(screen.getAllByRole('checkbox')[1]!)
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect((screen.getByRole('textbox', { name: 'Profile name' }) as HTMLInputElement).value).toBe('Work')
    expect((screen.getAllByRole('checkbox')[1] as HTMLInputElement).checked).toBe(false)
  })

  it('reports dirty, saving, and save success', async () => {
    let resolve!: () => void
    const onStateChange = vi.fn()
    render(<CustomProfileEditor profile={profile} {...props} onSave={() => new Promise<void>(done => { resolve = done })} onStateChange={onStateChange} />)
    fireEvent.change(screen.getByRole('textbox', { name: 'Profile name' }), { target: { value: 'Review' } })
    await waitFor(() => expect(onStateChange).toHaveBeenLastCalledWith({ dirty: true, saving: false, externalChange: false }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(onStateChange).toHaveBeenLastCalledWith({ dirty: true, saving: true, externalChange: false }))
    resolve()
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Saved'))
  })

  it('retains a failed draft', async () => {
    render(<CustomProfileEditor profile={profile} {...props} onSave={async () => { throw new Error('denied') }} onStateChange={vi.fn()} />)
    fireEvent.change(screen.getByRole('textbox', { name: 'Profile name' }), { target: { value: 'Review' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Failed: denied'))
    expect((screen.getByRole('textbox', { name: 'Profile name' }) as HTMLInputElement).value).toBe('Review')
  })

  it('adopts the authoritative fingerprint after save and uses it for the next CAS write', async () => {
    const onStateChange = vi.fn()
    const onSave = vi.fn(async () => {})
    const { rerender } = render(<CustomProfileEditor profile={profile} {...props} onSave={onSave} onStateChange={onStateChange} />)
    fireEvent.change(screen.getByRole('textbox', { name: 'Profile name' }), { target: { value: 'First' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    rerender(<CustomProfileEditor profile={{ ...profile, name: 'First', fingerprint: 'baseline-b' }} {...props} onSave={onSave} onStateChange={onStateChange} />)
    await waitFor(() => expect(screen.queryByText('EXTERNAL_CHANGE')).toBeNull())
    fireEvent.change(screen.getByRole('textbox', { name: 'Profile name' }), { target: { value: 'Second' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(onSave).toHaveBeenLastCalledWith('custom-a', 'baseline-b', 'Second', expect.any(Array)))
  })

  it('adopts clean external updates without reporting an external change', async () => {
    const onStateChange = vi.fn()
    const { rerender } = render(<CustomProfileEditor profile={profile} {...props} onSave={vi.fn(async () => {})} onStateChange={onStateChange} />)
    rerender(<CustomProfileEditor profile={{ ...profile, name: 'Remote', fingerprint: 'baseline-b' }} {...props} onSave={vi.fn(async () => {})} onStateChange={onStateChange} />)
    await waitFor(() => expect((screen.getByRole('textbox', { name: 'Profile name' }) as HTMLInputElement).value).toBe('Remote'))
    expect(screen.queryByText('EXTERNAL_CHANGE')).toBeNull()
    expect(onStateChange).not.toHaveBeenCalledWith(expect.objectContaining({ externalChange: true }))
  })

  it('preserves a dirty draft across external fingerprint changes until load latest', async () => {
    const onStateChange = vi.fn()
    const onSave = vi.fn(async () => {})
    const { rerender } = render(<CustomProfileEditor profile={profile} {...props} onSave={onSave} onStateChange={onStateChange} />)
    fireEvent.change(screen.getByRole('textbox', { name: 'Profile name' }), { target: { value: 'Draft' } })
    rerender(<CustomProfileEditor profile={{ ...profile, name: 'Remote', fingerprint: 'baseline-b' }} {...props} onSave={onSave} onStateChange={onStateChange} />)
    expect((screen.getByRole('textbox', { name: 'Profile name' }) as HTMLInputElement).value).toBe('Draft')
    expect(screen.getByText('EXTERNAL_CHANGE')).toBeTruthy()
    await waitFor(() => expect(onStateChange).toHaveBeenLastCalledWith({ dirty: true, saving: false, externalChange: true }))
    fireEvent.click(screen.getByRole('button', { name: 'Load latest' }))
    expect((screen.getByRole('textbox', { name: 'Profile name' }) as HTMLInputElement).value).toBe('Remote')
  })
})
