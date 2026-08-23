import { describe, expect, it } from 'vitest'
import { browserReservedDiagnostics } from '../src/client/keyboard/browser-reserved.js'
import type { ShortcutBinding, ShortcutStroke } from '../src/client/contract/profile.js'

const binding = (key: string, modifiers: ShortcutStroke['modifiers']): ShortcutBinding => ({ command: 'openSettings', scope: 'global', key: { key, modifiers } })
const cases = [
  ['n', ['Meta'], 'chrome'], ['t', ['Meta'], 'chrome'], ['w', ['Meta'], 'chrome'], ['p', ['Meta'], 'chrome'],
  ['l', ['Meta'], 'chrome'], ['s', ['Meta'], 'chrome'], ['f', ['Meta'], 'chrome'], ['r', ['Meta'], 'chrome'],
  ['n', ['Meta', 'Shift'], 'chrome'], ['ArrowLeft', ['Meta', 'Alt'], 'chrome'], ['ArrowRight', ['Meta', 'Alt'], 'chrome'],
] as const

describe('browser-reserved shortcut diagnostics', () => {
  it.each(cases)('identifies %s with %s as a known %s symbolic binding', (key, modifiers, source) => {
    const diagnostics = browserReservedDiagnostics(binding(key, modifiers), 'windows')
    expect(diagnostics).toEqual(expect.arrayContaining([expect.objectContaining({ source, sequence: { key, modifiers } })]))
  })

  it.each(['n', 'j', 'k', 'h', 'l', 'b', 't'])('does not identify Meta+Alt+Shift+%s', key => {
    expect(browserReservedDiagnostics(binding(key, ['Meta', 'Alt', 'Shift']), 'mac')).toEqual([])
    expect(browserReservedDiagnostics(binding(key, ['Meta', 'Alt', 'Shift']), 'windows')).toEqual([])
  })

  it('labels diagnostics as symbolic bindings and does not claim arbitrary system occupancy', () => {
    const diagnostic = browserReservedDiagnostics(binding('n', ['Meta']), 'mac')[0]
    expect(diagnostic).toMatchObject({ bindingKind: 'symbolic', source: 'chrome' })
    expect(diagnostic).not.toHaveProperty('occupied')
  })
})
