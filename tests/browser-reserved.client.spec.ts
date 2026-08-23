import { describe, expect, it } from 'vitest'
import { browserReservedDiagnostics } from '../src/client/keyboard/browser-reserved.js'
import type { ShortcutBinding, ShortcutStroke } from '../src/client/contract/profile.js'

const binding = (key: string, modifiers: ShortcutStroke['modifiers']): ShortcutBinding => ({ command: 'openSettings', scope: 'global', key: { key, modifiers } })
const cases = [
  ['n', ['Mod'], 'chrome'], ['t', ['Mod'], 'chrome'], ['w', ['Mod'], 'chrome'], ['p', ['Mod'], 'chrome'],
  ['l', ['Mod'], 'chrome'], ['s', ['Mod'], 'chrome'], ['f', ['Mod'], 'chrome'], ['r', ['Mod'], 'chrome'],
  ['n', ['Mod', 'Shift'], 'chrome'], ['ArrowLeft', ['Mod', 'Alt'], 'chrome'], ['ArrowRight', ['Mod', 'Alt'], 'chrome'],
] as const

describe('browser-reserved shortcut diagnostics', () => {
  it.each(cases)('identifies %s with %s as a known %s symbolic binding', (key, modifiers, source) => {
    const diagnostics = browserReservedDiagnostics(binding(key, modifiers), 'windows')
    expect(diagnostics).toEqual(expect.arrayContaining([expect.objectContaining({ source, sequence: { key, modifiers } })]))
  })

  it.each(['n', 'j', 'k', 'h', 'l', 'b', 't'])('does not identify Mod+Alt+Shift+%s', key => {
    expect(browserReservedDiagnostics(binding(key, ['Mod', 'Alt', 'Shift']), 'mac')).toEqual([])
    expect(browserReservedDiagnostics(binding(key, ['Mod', 'Alt', 'Shift']), 'windows')).toEqual([])
  })

  it('labels diagnostics as symbolic bindings and does not claim arbitrary system occupancy', () => {
    const diagnostic = browserReservedDiagnostics(binding('n', ['Mod']), 'mac')[0]
    expect(diagnostic).toMatchObject({ bindingKind: 'symbolic', source: 'chrome' })
    expect(diagnostic).not.toHaveProperty('occupied')
  })
})
