import { describe, expect, it } from 'vitest'
import { en, ja, ko, zh } from '../src/client/locales.js'

const LOCALES = { zh, en, ja, ko } as const

/** `{name}`-style placeholders a template carries, sorted for stable comparison. */
function placeholders(template: string): string[] {
  return [...template.matchAll(/\{(\w+)\}/g)].map(match => match[1]!).sort()
}

describe('shortcut locale dictionaries', () => {
  it('localizes task cancellation and approval scope in Chinese and English', () => {
    expect(zh['keyboard.cancelTask']).toBe('取消任务')
    expect(en['keyboard.cancelTask']).toBe('Cancel task')
    expect(zh['legend.scope.approval']).toBe('审批操作')
    expect(en['legend.scope.approval']).toBe('Approval actions')
  })

  it('localizes Vim profile descriptions in Chinese and English', () => {
    expect(zh['profile.vim.description']).toBe('使用 j 和 k、Enter 操作问题与审批。')
    expect(en['profile.vim.description']).toBe('Use J and K with Enter for questions and approvals.')
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
    const keys = Object.keys(zh) as (keyof typeof zh)[]
    // Modifier glyphs, the Vim product name, and the numeric counter are the same
    // in every language, so they are excluded from the "must differ" rule.
    const neutral = new Set(['editor.nameCount', 'profile.vim.label'])
    const translated = keys.filter(key => !key.startsWith('modifier.') && !neutral.has(key))
    for (const key of translated) {
      expect(ja[key], `ja ${key}`).not.toBe(en[key])
      expect(ko[key], `ko ${key}`).not.toBe(en[key])
    }
    expect(ja['legend.scope.question']).toBe('質問の操作')
    expect(ko['legend.scope.question']).toBe('질문 작업')
  })

  it('keeps Chinese characters out of the Korean dictionary', () => {
    const cjk = /[\u4e00-\u9fff]/
    for (const [key, value] of Object.entries(ko)) {
      expect(cjk.test(value), `ko ${key} = ${value}`).toBe(false)
    }
  })
})
