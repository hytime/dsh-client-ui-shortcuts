import { describe, expect, it } from 'vitest'
import { en, ja, ko, zh } from '../src/client/locales.js'

const LOCALES = { zh, en, ja, ko } as const

/** `{name}`-style placeholders a template carries, sorted for stable comparison. */
function placeholders(template: string): string[] {
  return [...template.matchAll(/\{(\w+)\}/g)].map(match => match[1]!).sort()
}

describe('shortcut locale dictionaries', () => {
  it('documents that DSH owns configurable keybindings', () => {
    expect(zh['quick.binding']).toBe('呼出面板快捷键')
    expect(en['quick.binding']).toBe('Open-panel shortcut')
    expect(zh['quick.officialHint']).toContain('DSH')
    expect(en['quick.officialHint']).toContain('DSH Settings')
  })
  it('localizes the two opt-in enhancements and their default-off intent', () => {
    expect(zh['quick.question']).toBe('增强 Question 交互')
    expect(en['quick.question']).toBe('Enhanced question interaction')
    expect(zh['quick.approvalHint']).toContain('默认关闭')
    expect(en['quick.approvalHint']).toContain('Off by default')
  })
  it('localizes official rejection and recovery copy', () => {
    expect(zh['quick.conflict']).toContain('{commands}')
    expect(en['quick.conflict']).toContain('{commands}')
    for (const key of ['quick.stale', 'quick.write-failed', 'quick.read-failed', 'quick.native-failed'] as const) {
      expect(zh[key].length).toBeGreaterThan(0)
      expect(en[key].length).toBeGreaterThan(0)
    }
  })
  it('carries the same key set in every locale', () => {
    const reference = Object.keys(zh).sort()
    for (const [locale, dictionary] of Object.entries(LOCALES)) {
      expect(Object.keys(dictionary).sort(), `${locale} key set`).toEqual(reference)
    }
  })
  it('keeps every placeholder of the Chinese source in the other locales', () => {
    for (const key of Object.keys(zh) as (keyof typeof zh)[]) {
      for (const [locale, dictionary] of Object.entries(LOCALES)) {
        expect(placeholders(dictionary[key]), `${locale} ${key}`).toEqual(placeholders(zh[key]))
      }
    }
  })
  it('translates the Japanese and Korean entries rather than copying English', () => {
    for (const key of Object.keys(zh) as (keyof typeof zh)[]) {
      expect(ja[key], `ja ${key}`).not.toBe(en[key])
      expect(ko[key], `ko ${key}`).not.toBe(en[key])
    }
  })
  it('keeps Chinese characters out of the Korean dictionary', () => {
    const cjk = /[\u4e00-\u9fff]/
    for (const [key, value] of Object.entries(ko)) {
      expect(cjk.test(value), `ko ${key} = ${value}`).toBe(false)
    }
  })
})
