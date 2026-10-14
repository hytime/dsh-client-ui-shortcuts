import { describe, expect, it } from 'vitest'
import {
  CONFIG_FILE_FORMAT, CONFIG_FILE_VERSION, MAX_CONFIG_FILE_BYTES,
} from '../src/client/contract/config-file.js'
import { decodeConfigFile, encodeConfigFile } from '../src/client/settings/config-file.js'

const valid = {
  format: CONFIG_FILE_FORMAT,
  version: CONFIG_FILE_VERSION,
  configuration: { questionEnabled: true, approvalEnabled: false, shortcuts: {} },
}

const json = (value: unknown): string => JSON.stringify(value)

describe('configuration file codec', () => {
  it('round-trips switches with an empty shortcut snapshot', () => {
    const encoded = encodeConfigFile({ questionEnabled: true, approvalEnabled: false, shortcuts: {}, profile: 'web:macos' })
    expect(encoded.endsWith('\n')).toBe(true)
    expect(JSON.parse(encoded).version).toBe(CONFIG_FILE_VERSION)
    expect(decodeConfigFile(encoded)).toEqual({
      ok: true,
      document: { questionEnabled: true, approvalEnabled: false, shortcuts: {}, profile: 'web:macos' },
    })
  })

  it('round-trips every official command, including unmodified defaults and explicit clears', () => {
    const encoded = encodeConfigFile({
      questionEnabled: false, approvalEnabled: true, profile: 'web:macos',
      shortcuts: {
        // Unmodified default: exported so the file is a complete snapshot.
        'session.new': { modified: false, binding: { code: 'KeyN', modifiers: ['meta'] }, label: 'New session', keys: ['⌘', 'N'] },
        // Customized by the user.
        'session.search': { modified: true, binding: { code: 'KeyU', modifiers: ['shift', 'meta'] } },
        // Cleared by the user: an explicit unbound command.
        'session.fork': { modified: true, binding: null },
      },
    })
    const decoded = decodeConfigFile(encoded)
    expect(decoded.ok).toBe(true)
    if (!decoded.ok) return
    expect(decoded.document.shortcuts).toEqual({
      'session.new': { modified: false, binding: { code: 'KeyN', modifiers: ['meta'] } },
      'session.search': { modified: true, binding: { code: 'KeyU', modifiers: ['shift', 'meta'] } },
      'session.fork': { modified: true, binding: null },
    })
    // `label`/`keys` are display-only: they are accepted on read but never carried into the
    // runtime value, so a re-export of the decoded document drops them. The binding data and a
    // stable command order are what a round trip must preserve.
    const reExported = decodeConfigFile(encodeConfigFile(decoded.document))
    expect(reExported).toEqual(decoded)
    expect(encodeConfigFile(decoded.document)).toBe(encodeConfigFile(decoded.document))
  })

  it('keeps reading a version 1 file as the summon binding only', () => {
    const legacy = JSON.stringify({ format: CONFIG_FILE_FORMAT, version: 1,
      configuration: { questionEnabled: true, approvalEnabled: true, shortcut: { code: 'KeyG', modifiers: ['meta'] } } })
    expect(decodeConfigFile(legacy)).toEqual({ ok: true, document: {
      questionEnabled: true, approvalEnabled: true,
      shortcuts: { 'hytime.shortcuts.open': { modified: true, binding: { code: 'KeyG', modifiers: ['meta'] } } },
    } })
    const omitted = JSON.stringify({ format: CONFIG_FILE_FORMAT, version: 1,
      configuration: { questionEnabled: false, approvalEnabled: false } })
    expect(decodeConfigFile(omitted)).toEqual({ ok: true, document: {
      questionEnabled: false, approvalEnabled: false, shortcuts: {},
    } })
  })

  it('refuses a foreign command id, too many commands, and a malformed profile', () => {
    const base = { format: CONFIG_FILE_FORMAT, version: 2, configuration: { questionEnabled: true, approvalEnabled: true } }
    const entry = (binding: unknown) => ({ modified: true, binding })
    expect(decodeConfigFile(JSON.stringify({ ...base, configuration: { ...base.configuration,
      shortcuts: { NoDot: entry({ code: 'KeyJ', modifiers: ['meta'] }) } } })))
      .toEqual({ ok: false, reason: 'invalid' })
    const many = Object.fromEntries(Array.from({ length: 1200 }, (_, i) =>
      [`a.b${String(i)}`, entry({ code: 'KeyJ', modifiers: ['meta'] })]))
    expect(decodeConfigFile(JSON.stringify({ ...base, configuration: { ...base.configuration, shortcuts: many } })))
      .toEqual({ ok: false, reason: 'invalid' })
    expect(decodeConfigFile(JSON.stringify({ ...base, configuration: { ...base.configuration,
      shortcuts: {}, profile: 'solaris' } }))).toEqual({ ok: false, reason: 'invalid' })
  })

  it('round-trips an explicit binding and an explicit clear independently', () => {
    const withBinding = decodeConfigFile(encodeConfigFile({ questionEnabled: false, approvalEnabled: true,
      shortcuts: { 'session.new': { modified: true, binding: { code: 'KeyN', modifiers: ['meta'] } } } }))
    expect(withBinding).toEqual({ ok: true, document: {
      questionEnabled: false, approvalEnabled: true,
      shortcuts: { 'session.new': { modified: true, binding: { code: 'KeyN', modifiers: ['meta'] } } },
    } })
    const cleared = decodeConfigFile(encodeConfigFile({ questionEnabled: false, approvalEnabled: true,
      shortcuts: { 'session.new': { modified: true, binding: null } } }))
    expect(cleared).toEqual({ ok: true, document: {
      questionEnabled: false, approvalEnabled: true,
      shortcuts: { 'session.new': { modified: true, binding: null } },
    } })
  })

  it('normalizes modifier order and keeps a two-key chord', () => {
    const encoded = encodeConfigFile({ questionEnabled: false, approvalEnabled: false,
      shortcuts: { 'session.new': { modified: true,
        binding: { code: 'KeyA', secondCode: 'KeyB', modifiers: ['meta', 'control', 'alt'] } } } })
    const decoded = decodeConfigFile(encoded)
    expect(decoded.ok && decoded.document.shortcuts['session.new']?.binding).toEqual({
      code: 'KeyA', secondCode: 'KeyB', modifiers: ['control', 'alt', 'meta'],
    })
  })

  it.each([
    ['not JSON', '{'],
    ['array root', json([])],
    ['wrong format', json({ ...valid, format: 'other/tool' })],
    ['missing version', json({ format: CONFIG_FILE_FORMAT, configuration: valid.configuration })],
    ['zero version', json({ ...valid, version: 0 })],
    ['non-integer version', json({ ...valid, version: 1.5 })],
    ['missing configuration', json({ format: CONFIG_FILE_FORMAT, version: 1 })],
    ['non-boolean switch', json({ ...valid, configuration: { ...valid.configuration, questionEnabled: 'yes' } })],
    ['missing switch', json({ ...valid, configuration: { questionEnabled: true } })],
    ['unknown root field', json({ ...valid, extra: 1 })],
    ['unknown configuration field', json({ ...valid, configuration: { ...valid.configuration, extra: 1 } })],
    ['unknown override field', json({ ...valid, configuration: { ...valid.configuration, shortcuts: { 'a.b': { modified: true, binding: { code: 'KeyS', modifiers: [], extra: 1 } } } } })],
    ['unsupported physical code', json({ ...valid, configuration: { ...valid.configuration, shortcuts: { 'a.b': { modified: true, binding: { code: 'PageUp', modifiers: ['meta'] } } } } })],
    ['unknown modifier', json({ ...valid, configuration: { ...valid.configuration, shortcuts: { 'a.b': { modified: true, binding: { code: 'KeyS', modifiers: ['primary'] } } } } })],
    ['non-string modifier', json({ ...valid, configuration: { ...valid.configuration, shortcuts: { 'a.b': { modified: true, binding: { code: 'KeyS', modifiers: [1] } } } } })],
    ['duplicate chord keys', json({ ...valid, configuration: { ...valid.configuration, shortcuts: { 'a.b': { modified: true, binding: { code: 'KeyS', secondCode: 'KeyS', modifiers: ['meta'] } } } } })],
    ['non-string secondCode', json({ ...valid, configuration: { ...valid.configuration, shortcuts: { 'a.b': { modified: true, binding: { code: 'KeyS', secondCode: 2, modifiers: ['meta'] } } } } })],
    ['array shortcuts', json({ ...valid, configuration: { ...valid.configuration, shortcuts: [] } })],
    ['entry without modified', json({ ...valid, configuration: { ...valid.configuration,
      shortcuts: { 'a.b': { binding: { code: 'KeyS', modifiers: ['meta'] } } } } })],
    ['entry with non-boolean modified', json({ ...valid, configuration: { ...valid.configuration,
      shortcuts: { 'a.b': { modified: 'yes', binding: null } } } })],
  ])('refuses %s', (_label, raw) => {
    expect(decodeConfigFile(raw)).toEqual({ ok: false, reason: 'invalid' })
  })

  it('classifies a future version separately from an invalid document', () => {
    expect(decodeConfigFile(json({ ...valid, version: CONFIG_FILE_VERSION + 1 })))
      .toEqual({ ok: false, reason: 'future' })
  })

  it('refuses an oversized document before parsing it', () => {
    const oversized = 'x'.repeat(MAX_CONFIG_FILE_BYTES + 1)
    expect(decodeConfigFile(oversized)).toEqual({ ok: false, reason: 'too-large' })
  })

  it('accepts every official named and functional code', () => {
    for (const code of ['Slash', 'Comma', 'Backquote', 'Enter', 'Escape', 'Space', 'ArrowUp', 'F24', 'Digit7', 'KeyZ']) {
      const decoded = decodeConfigFile(json({ ...valid,
        configuration: { ...valid.configuration,
          shortcuts: { 'a.b': { modified: true, binding: { code, modifiers: ['meta'] } } } } }))
      expect(decoded.ok, code).toBe(true)
    }
  })

  it('keeps a command absent from the file out of the snapshot instead of clearing it', () => {
    const decoded = decodeConfigFile(json(valid))
    expect(decoded.ok && decoded.document.shortcuts).toEqual({})
    const explicit = decodeConfigFile(json({ ...valid, configuration: { ...valid.configuration,
      shortcuts: { 'a.b': { modified: true, binding: null } } } }))
    expect(explicit.ok && Object.hasOwn(explicit.document.shortcuts, 'a.b')).toBe(true)
  })
})
