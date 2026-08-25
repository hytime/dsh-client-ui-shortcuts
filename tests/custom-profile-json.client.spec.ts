import { readFileSync } from 'node:fs'

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

function installationJsonExample(path: string): string {
  const markdown = readFileSync(new URL(path, import.meta.url), 'utf8')
  const examples = [...markdown.matchAll(/```json\n([\s\S]*?)\n```/g)]
  expect(examples).toHaveLength(1)
  return examples[0]![1]!
}

describe('custom profile JSON codec', () => {
  it.each([
    ['English', '../docs/installation.md'],
    ['Chinese', '../docs/installation.zh.md'],
  ])('decodes the %s installation guide example', (_label, path) => {
    const text = installationJsonExample(path)

    expect(decodeCustomProfileJson(text, new TextEncoder().encode(text).byteLength)).toEqual({
      name: 'Review',
      bindings: [{
        command: 'focusNext',
        scope: 'question',
        key: { key: 'j', modifiers: [] },
      }],
    })
  })

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

  it.each([
    {
      label: 'key with a declarative stroke',
      binding: {
        command: 'openSettings',
        scope: 'global',
        key: {
          key: 'S',
          modifiers: ['Shift', 'Mod'],
          display: { mac: { glyphs: ['⌘', '⇧', 'S'], accessible: true }, fallback: null },
        },
        metadata: { source: { kind: 'imported', tags: ['work', { priority: 1 }] }, enabled: true },
      },
      expectedBinding: {
        command: 'openSettings',
        scope: 'global',
        key: {
          key: 's',
          modifiers: ['Meta', 'Shift'],
          display: { mac: { glyphs: ['⌘', '⇧', 'S'], accessible: true }, fallback: null },
        },
        metadata: { source: { kind: 'imported', tags: ['work', { priority: 1 }] }, enabled: true },
      },
    },
    {
      label: 'sequence with physical strokes',
      binding: {
        command: 'openSettings',
        scope: 'global',
        sequence: [
          {
            key: 'Esc',
            alt: false,
            ctrl: false,
            meta: true,
            shift: false,
            display: { variants: [{ platform: 'mac', glyph: '⌘ Esc' }] },
          },
          {
            key: 'S',
            alt: true,
            ctrl: false,
            meta: false,
            shift: true,
            display: { variants: [{ platform: 'other', glyph: 'Alt Shift S' }] },
          },
        ],
        metadata: { source: { kind: 'legacy', revision: 2 }, enabled: true },
      },
      expectedBinding: {
        command: 'openSettings',
        scope: 'global',
        sequence: [
          {
            key: 'Escape',
            alt: false,
            ctrl: false,
            meta: true,
            shift: false,
            display: { variants: [{ platform: 'mac', glyph: '⌘ Esc' }] },
          },
          {
            key: 's',
            alt: true,
            ctrl: false,
            meta: false,
            shift: true,
            display: { variants: [{ platform: 'other', glyph: 'Alt Shift S' }] },
          },
        ],
        metadata: { source: { kind: 'legacy', revision: 2 }, enabled: true },
      },
    },
    {
      label: 'sequences with mixed declarative and physical strokes',
      binding: {
        command: 'openSettings',
        scope: 'global',
        sequences: [
          [
            {
              key: 'G',
              modifiers: ['Shift', 'Mod'],
              display: { chord: { position: 1, labels: ['Meta', 'Shift', 'G'] } },
            },
            {
              key: 'S',
              alt: false,
              ctrl: true,
              meta: false,
              shift: false,
              display: { chord: { position: 2, labels: ['Ctrl', 'S'] } },
            },
          ],
          [
            {
              key: '/',
              alt: true,
              ctrl: false,
              meta: false,
              shift: false,
              display: { chord: { position: 1, labels: ['Alt', '/'] } },
            },
            {
              key: 'Return',
              modifiers: [],
              display: { chord: { position: 2, labels: ['Enter'] } },
            },
          ],
        ],
        metadata: { source: { kind: 'generated', options: { alternate: true } }, enabled: true },
      },
      expectedBinding: {
        command: 'openSettings',
        scope: 'global',
        sequences: [
          [
            {
              key: 'g',
              modifiers: ['Meta', 'Shift'],
              display: { chord: { position: 1, labels: ['Meta', 'Shift', 'G'] } },
            },
            {
              key: 's',
              alt: false,
              ctrl: true,
              meta: false,
              shift: false,
              display: { chord: { position: 2, labels: ['Ctrl', 'S'] } },
            },
          ],
          [
            {
              key: '/',
              alt: true,
              ctrl: false,
              meta: false,
              shift: false,
              display: { chord: { position: 1, labels: ['Alt', '/'] } },
            },
            {
              key: 'Enter',
              modifiers: [],
              display: { chord: { position: 2, labels: ['Enter'] } },
            },
          ],
        ],
        metadata: { source: { kind: 'generated', options: { alternate: true } }, enabled: true },
      },
    },
  ])('round-trips nested extension fields for $label while normalized known fields win', ({ binding, expectedBinding }) => {
    const text = jsonText(validEnvelope({ name: 'Work', bindings: [binding] }))
    const expected = { name: 'Work', bindings: [expectedBinding] }

    const decoded = decodeCustomProfileJson(text, new TextEncoder().encode(text).byteLength)

    expect(decoded).toEqual(expected)
    expect(JSON.parse(encodeCustomProfileJson(decoded)).profile).toEqual(expected)
  })

  it.each([
    [
      'declarative modifiers combined with physical flags',
      { key: 's', modifiers: ['Meta'], alt: false, ctrl: false, meta: false, shift: false },
    ],
    [
      'physical Ctrl and Meta flags enabled together',
      { key: 's', alt: false, ctrl: true, meta: true, shift: false },
    ],
  ])('rejects invalid known stroke fields: %s', (_label, key) => {
    const text = jsonText(validEnvelope({
      name: 'Work',
      bindings: [{ command: 'openSettings', scope: 'global', key }],
    }))

    expect(() => decodeCustomProfileJson(text, text.length)).toThrow('modifier')
  })

  it('uses the provided UTF-8 byte count and rejects 1 MiB plus one byte', () => {
    const text = jsonText(validEnvelope())

    expect(() => decodeCustomProfileJson(text, CUSTOM_PROFILE_JSON_MAX_BYTES)).not.toThrow()
    expect(() => decodeCustomProfileJson(text, CUSTOM_PROFILE_JSON_MAX_BYTES + 1)).toThrow('1 MiB')
  })
})
