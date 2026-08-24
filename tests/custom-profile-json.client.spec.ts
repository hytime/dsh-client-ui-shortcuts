import { describe, expect, it } from 'vitest'
import {
  CUSTOM_PROFILE_JSON_FORMAT,
  CUSTOM_PROFILE_JSON_MAX_BYTES,
  decodeCustomProfileJson,
  encodeCustomProfileJson,
} from '../src/client/settings/custom-profile-json.js'

const validCustomBinding = {
  command: 'openSettings',
  scope: 'global',
  key: { key: 's', modifiers: ['Meta'] },
}

function jsonText(value: unknown): string {
  return JSON.stringify(value)
}

function validEnvelope(profile: Record<string, unknown> = {
  name: 'Work',
  bindings: [validCustomBinding],
}): Record<string, unknown> {
  return {
    format: CUSTOM_PROFILE_JSON_FORMAT,
    version: 1,
    profile,
  }
}

describe('custom profile JSON codec', () => {
  it('round-trips one profile without an internal id', () => {
    const text = encodeCustomProfileJson({ name: 'Work', bindings: [validCustomBinding] })

    expect(text).toBe(`${JSON.stringify({
      format: CUSTOM_PROFILE_JSON_FORMAT,
      version: 1,
      profile: { name: 'Work', bindings: [validCustomBinding] },
    }, null, 2)}\n`)
    expect(decodeCustomProfileJson(text, new TextEncoder().encode(text).byteLength)).toEqual({
      name: 'Work',
      bindings: [validCustomBinding],
    })
    expect(JSON.parse(text).profile).not.toHaveProperty('id')
  })

  it.each([
    ['wrong format', { format: 'other', version: 1, profile: { name: 'A', bindings: [validCustomBinding] } }],
    ['future version', { format: CUSTOM_PROFILE_JSON_FORMAT, version: 2, profile: { name: 'A', bindings: [validCustomBinding] } }],
    ['unknown envelope field', { ...validEnvelope(), extra: true }],
  ])('rejects %s', (_label, value) => {
    const text = jsonText(value)
    expect(() => decodeCustomProfileJson(text, text.length)).toThrow()
  })

  it('rejects invalid JSON', () => {
    expect(() => decodeCustomProfileJson('{', 1)).toThrow()
  })

  it.each([
    ['null', null],
    ['array', []],
    ['string', 'profile'],
  ])('rejects a non-object %s envelope', (_label, value) => {
    const text = jsonText(value)
    expect(() => decodeCustomProfileJson(text, text.length)).toThrow()
  })

  it('rejects unknown profile fields', () => {
    const text = jsonText(validEnvelope({
      name: 'Work',
      bindings: [validCustomBinding],
      id: 'custom-work',
    }))

    expect(() => decodeCustomProfileJson(text, text.length)).toThrow()
  })

  it.each([
    ['empty', '   '],
    ['too long', '😀'.repeat(65)],
  ])('rejects an %s profile name', (_label, name) => {
    const text = jsonText(validEnvelope({ name, bindings: [validCustomBinding] }))
    expect(() => decodeCustomProfileJson(text, new TextEncoder().encode(text).byteLength)).toThrow()
  })

  it('normalizes a valid profile name', () => {
    const text = jsonText(validEnvelope({ name: ' Work ', bindings: [validCustomBinding] }))
    expect(decodeCustomProfileJson(text, text.length).name).toBe('Work')
  })

  it('rejects empty and conflicting bindings', () => {
    const empty = jsonText(validEnvelope({ name: 'Work', bindings: [] }))
    const conflicting = jsonText(validEnvelope({
      name: 'Work',
      bindings: [
        validCustomBinding,
        { ...validCustomBinding, command: 'toggleTheme' },
      ],
    }))

    expect(() => decodeCustomProfileJson(empty, empty.length)).toThrow('non-empty')
    expect(() => decodeCustomProfileJson(conflicting, conflicting.length)).toThrow('conflict')
  })

  it('rejects an invalid binding', () => {
    const text = jsonText(validEnvelope({
      name: 'Work',
      bindings: [{ ...validCustomBinding, command: 'missing' }],
    }))

    expect(() => decodeCustomProfileJson(text, text.length)).toThrow('command')
  })

  it('preserves JSON-safe binding and stroke extension fields while normalizing bindings', () => {
    const text = jsonText(validEnvelope({
      name: 'Work',
      bindings: [{
        command: 'openSettings',
        scope: 'global',
        key: {
          key: 'S',
          modifiers: ['Mod'],
          display: { mac: ['⌘', 'S'] },
        },
        metadata: { source: ['imported'], enabled: true },
      }],
    }))

    const expected = {
      name: 'Work',
      bindings: [{
        command: 'openSettings',
        scope: 'global',
        key: {
          key: 's',
          modifiers: ['Meta'],
          display: { mac: ['⌘', 'S'] },
        },
        metadata: { source: ['imported'], enabled: true },
      }],
    }
    const decoded = decodeCustomProfileJson(text, new TextEncoder().encode(text).byteLength)

    expect(decoded).toEqual(expected)
    expect(JSON.parse(encodeCustomProfileJson(decoded)).profile).toEqual(expected)
  })

  it('uses the provided UTF-8 byte count and rejects 1 MiB plus one byte', () => {
    const text = jsonText(validEnvelope())

    expect(() => decodeCustomProfileJson(text, CUSTOM_PROFILE_JSON_MAX_BYTES)).not.toThrow()
    expect(() => decodeCustomProfileJson(text, CUSTOM_PROFILE_JSON_MAX_BYTES + 1)).toThrow('1 MiB')
  })
})
