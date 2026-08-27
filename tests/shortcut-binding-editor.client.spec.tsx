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
  'editor.nameRequired': 'Enter a profile name.', 'editor.nameTooLong': 'Profile names are limited to 64 characters.',
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

  it.each(['linux', 'windows'] as const)('keeps hidden Meta distinct from visible Ctrl on %s', platform => {
    const onChange = vi.fn()
    const hidden = { command: 'openSettings' as const, scope: 'global' as const, key: { key: 'x', modifiers: ['Meta'] as const } }
    const visible = { command: 'openCommandPalette' as const, scope: 'global' as const, key: { key: 'x', modifiers: ['Ctrl'] as const } }
    render(<ShortcutBindingEditor platform={platform} bindings={[hidden, visible]} availableGlobalActions={['openCommandPalette']} t={t} onChange={onChange} />)
    expect(screen.queryByRole('alert')).toBeNull()
    fireEvent.click(screen.getAllByRole('checkbox')[2]!)
    expect(onChange).toHaveBeenCalledWith([hidden, expect.objectContaining({ command: 'openCommandPalette' })])
  })

  it('keeps hidden Ctrl distinct from visible Meta on macOS', () => {
    const onChange = vi.fn()
    const hidden = { command: 'openSettings' as const, scope: 'global' as const, key: { key: 'x', modifiers: ['Ctrl'] as const } }
    const visible = { command: 'openCommandPalette' as const, scope: 'global' as const, key: { key: 'x', modifiers: ['Meta'] as const } }
    render(<ShortcutBindingEditor platform="mac" bindings={[hidden, visible]} availableGlobalActions={['openCommandPalette']} t={t} onChange={onChange} />)
    expect(screen.queryByRole('alert')).toBeNull()
    fireEvent.click(screen.getAllByRole('checkbox')[3]!)
    expect(onChange).toHaveBeenCalledWith([hidden, expect.objectContaining({ command: 'openCommandPalette' })])
  })

  it.each(['linux', 'mac'] as const)('does not block a hidden browser-reserved Ctrl binding on %s', platform => {
    const hidden = { command: 'openSettings' as const, scope: 'global' as const, key: { key: 'n', modifiers: ['Ctrl'] as const } }
    render(<ShortcutBindingEditor platform={platform} bindings={[bindings[0]!, hidden]} availableGlobalActions={['openCommandPalette']} t={t} onChange={vi.fn()} />)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('preserves the complete hidden payload in controlled changes', () => {
    const onChange = vi.fn()
    const hidden = { command: 'openSettings' as const, scope: 'global' as const, key: { key: 's', modifiers: ['Meta'] as const }, sequence: [{ key: 'x', modifiers: ['Ctrl'] as const }] }
    render(<ShortcutBindingEditor platform="linux" bindings={[bindings[0]!, hidden as never]} availableGlobalActions={['openCommandPalette']} t={t} onChange={onChange} />)
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

  it('adopts the authoritative reset profile as the new draft baseline', async () => {
    const resetProfile = {
      id: 'custom-a',
      name: 'Default work',
      bindings: [{ command: 'openCommandPalette' as const, scope: 'global' as const, key: { key: 'd', modifiers: ['Ctrl'] as const } }],
      fingerprint: 'reset-fingerprint',
    }
    const onReset = vi.fn(async () => resetProfile)
    const onSave = vi.fn(async (_id, _fingerprint, name, nextBindings) => ({ ...resetProfile, name, bindings: nextBindings }))
    render(<CustomProfileEditor profile={profile} {...props} onReset={onReset} onSave={onSave} onStateChange={vi.fn()} />)

    fireEvent.change(screen.getByRole('textbox', { name: 'Profile name' }), { target: { value: 'Draft' } })
    fireEvent.click(screen.getByRole('button', { name: 'editor.reset' }))
    expect(screen.getByText('editor.resetConfirm')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'editor.resetConfirmAction' }))

    await waitFor(() => expect(onReset).toHaveBeenCalledWith('custom-a', 'baseline-a'))
    await waitFor(() => {
      expect(screen.queryByText('editor.resetConfirm')).toBeNull()
      expect((screen.getByRole('textbox', { name: 'Profile name' }) as HTMLInputElement).value).toBe('Default work')
      expect((screen.getAllByRole('checkbox')[1] as HTMLInputElement).checked).toBe(true)
    })

    fireEvent.change(screen.getByRole('textbox', { name: 'Profile name' }), { target: { value: 'Saved after reset' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(onSave).toHaveBeenCalledWith('custom-a', 'reset-fingerprint', 'Saved after reset', expect.any(Array)))
  })

  it('saves the literal name and bindings in one operation', async () => {
    const saved = { ...profile, name: 'Review', fingerprint: 'baseline-b' }
    const onSave = vi.fn(async () => saved)
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

  it('describes empty and overlong profile names accessibly', () => {
    render(<CustomProfileEditor profile={profile} {...props} onSave={vi.fn()} onStateChange={vi.fn()} />)
    const name = screen.getByRole('textbox', { name: 'Profile name' })
    fireEvent.change(name, { target: { value: '' } })
    expect(name.getAttribute('aria-invalid')).toBe('true')
    const requiredDescription = name.getAttribute('aria-describedby')
    expect(requiredDescription).toBeTruthy()
    expect(document.getElementById(requiredDescription!)?.textContent).toBe('Enter a profile name.')
    fireEvent.change(name, { target: { value: 'x'.repeat(65) } })
    expect(name.getAttribute('aria-invalid')).toBe('true')
    const overlongDescription = name.getAttribute('aria-describedby')
    expect(document.getElementById(overlongDescription!)?.textContent).toBe('Profile names are limited to 64 characters.')
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
    let resolve!: (saved: typeof profile) => void
    const onStateChange = vi.fn()
    render(<CustomProfileEditor profile={profile} {...props} onSave={() => new Promise(done => { resolve = done })} onStateChange={onStateChange} />)
    fireEvent.change(screen.getByRole('textbox', { name: 'Profile name' }), { target: { value: 'Review' } })
    await waitFor(() => expect(onStateChange).toHaveBeenLastCalledWith({ dirty: true, saving: false, externalChange: false }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(onStateChange).toHaveBeenLastCalledWith({ dirty: true, saving: true, externalChange: false }))
    resolve({ ...profile, name: 'Review', fingerprint: 'baseline-b' })
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Saved'))
  })

  it('retains a failed draft', async () => {
    render(<CustomProfileEditor profile={profile} {...props} onSave={async () => { throw new Error('denied') }} onStateChange={vi.fn()} />)
    fireEvent.change(screen.getByRole('textbox', { name: 'Profile name' }), { target: { value: 'Review' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Failed: denied'))
    expect((screen.getByRole('textbox', { name: 'Profile name' }) as HTMLInputElement).value).toBe('Review')
  })

  it('adopts the authoritative save result when the promise resolves before the prop update', async () => {
    const onSave = vi.fn(async (_id, _fingerprint, name, nextBindings) => ({ id: profile.id, name, bindings: nextBindings, fingerprint: 'baseline-b' }))
    render(<CustomProfileEditor profile={profile} {...props} onSave={onSave} onStateChange={vi.fn()} />)
    fireEvent.change(screen.getByRole('textbox', { name: 'Profile name' }), { target: { value: 'First' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Saved'))
    fireEvent.change(screen.getByRole('textbox', { name: 'Profile name' }), { target: { value: 'Second' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(onSave).toHaveBeenLastCalledWith('custom-a', 'baseline-b', 'Second', expect.any(Array)))
  })

  it('adopts a prop update that arrives before the save promise resolves', async () => {
    let resolve!: (saved: typeof profile) => void
    const onSave = vi.fn(() => new Promise<typeof profile>(done => { resolve = done }))
    const { rerender } = render(<CustomProfileEditor profile={profile} {...props} onSave={onSave} onStateChange={vi.fn()} />)
    fireEvent.change(screen.getByRole('textbox', { name: 'Profile name' }), { target: { value: 'First' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    const saved = { ...profile, name: 'First', fingerprint: 'baseline-b' }
    rerender(<CustomProfileEditor profile={saved} {...props} onSave={onSave} onStateChange={vi.fn()} />)
    resolve(saved)
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Saved'))
    expect(screen.queryByText('EXTERNAL_CHANGE')).toBeNull()
    fireEvent.change(screen.getByRole('textbox', { name: 'Profile name' }), { target: { value: 'Second' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(onSave).toHaveBeenLastCalledWith('custom-a', 'baseline-b', 'Second', expect.any(Array)))
  })

  it('resets drafts when profile ids change even with the same fingerprint', () => {
    const { rerender } = render(<CustomProfileEditor profile={profile} {...props} onSave={vi.fn()} onStateChange={vi.fn()} />)
    fireEvent.change(screen.getByRole('textbox', { name: 'Profile name' }), { target: { value: 'Draft A' } })
    rerender(<CustomProfileEditor profile={{ ...profile, id: 'custom-b', name: 'Work B' }} {...props} onSave={vi.fn()} onStateChange={vi.fn()} />)
    expect((screen.getByRole('textbox', { name: 'Profile name' }) as HTMLInputElement).value).toBe('Work B')
    expect(screen.queryByText('EXTERNAL_CHANGE')).toBeNull()
  })

  it('ignores a save result after switching profiles', async () => {
    let resolve!: (saved: typeof profile) => void
    const onSave = vi.fn(() => new Promise<typeof profile>(done => { resolve = done }))
    const { rerender } = render(<CustomProfileEditor profile={profile} {...props} onSave={onSave} onStateChange={vi.fn()} />)
    fireEvent.change(screen.getByRole('textbox', { name: 'Profile name' }), { target: { value: 'Draft A' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    rerender(<CustomProfileEditor profile={{ ...profile, id: 'custom-b', name: 'Work B' }} {...props} onSave={onSave} onStateChange={vi.fn()} />)
    resolve({ ...profile, name: 'Draft A', fingerprint: 'baseline-b' })
    await Promise.resolve()
    expect((screen.getByRole('textbox', { name: 'Profile name' }) as HTMLInputElement).value).toBe('Work B')
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('does not publish state after unmounting during a save', async () => {
    let resolve!: (saved: typeof profile) => void
    const onStateChange = vi.fn()
    const { unmount } = render(<CustomProfileEditor profile={profile} {...props} onSave={() => new Promise(done => { resolve = done })} onStateChange={onStateChange} />)
    fireEvent.change(screen.getByRole('textbox', { name: 'Profile name' }), { target: { value: 'Draft A' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(onStateChange).toHaveBeenLastCalledWith({ dirty: true, saving: true, externalChange: false }))
    unmount()
    onStateChange.mockClear()
    resolve({ ...profile, name: 'Draft A', fingerprint: 'baseline-b' })
    await Promise.resolve()
    expect(onStateChange).not.toHaveBeenCalled()
  })

  it('adopts clean external updates without reporting an external change', async () => {
    const onStateChange = vi.fn()
    const { rerender } = render(<CustomProfileEditor profile={profile} {...props} onSave={async (_id, _fingerprint, _name, nextBindings) => ({ ...profile, name: 'Work', bindings: nextBindings, fingerprint: 'baseline-a' })} onStateChange={onStateChange} />)
    rerender(<CustomProfileEditor profile={{ ...profile, name: 'Remote', fingerprint: 'baseline-b' }} {...props} onSave={vi.fn(async () => {})} onStateChange={onStateChange} />)
    await waitFor(() => expect((screen.getByRole('textbox', { name: 'Profile name' }) as HTMLInputElement).value).toBe('Remote'))
    expect(screen.queryByText('EXTERNAL_CHANGE')).toBeNull()
    expect(onStateChange).not.toHaveBeenCalledWith(expect.objectContaining({ externalChange: true }))
  })

  it('preserves a dirty draft across external fingerprint changes until load latest', async () => {
    const onStateChange = vi.fn()
    const onSave = vi.fn(async (_id, _fingerprint, name, nextBindings) => ({ ...profile, name, bindings: nextBindings, fingerprint: 'baseline-b' }))
    const { rerender } = render(<CustomProfileEditor profile={profile} {...props} onSave={onSave} onStateChange={onStateChange} />)
    fireEvent.change(screen.getByRole('textbox', { name: 'Profile name' }), { target: { value: 'Draft' } })
    rerender(<CustomProfileEditor profile={{ ...profile, name: 'Remote', fingerprint: 'baseline-b' }} {...props} onSave={onSave} onStateChange={onStateChange} />)
    expect((screen.getByRole('textbox', { name: 'Profile name' }) as HTMLInputElement).value).toBe('Draft')
    expect(screen.getByRole('status').textContent).toContain('EXTERNAL_CHANGE')
    await waitFor(() => expect(onStateChange).toHaveBeenLastCalledWith({ dirty: true, saving: false, externalChange: true }))
    fireEvent.click(screen.getByRole('button', { name: 'Load latest' }))
    expect((screen.getByRole('textbox', { name: 'Profile name' }) as HTMLInputElement).value).toBe('Remote')
  })
})
