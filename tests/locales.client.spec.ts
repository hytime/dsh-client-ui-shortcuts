import { describe, expect, it } from 'vitest'
import { en, zh } from '../src/client/locales.js'

describe('shortcut locale dictionaries', () => {
  it('localizes task cancellation and approval scope in Chinese and English', () => {
    expect(zh['keyboard.cancelTask']).toBe('取消任务')
    expect(en['keyboard.cancelTask']).toBe('Cancel task')
    expect(zh['legend.scope.approval']).toBe('审批操作')
    expect(en['legend.scope.approval']).toBe('Approval actions')
  })
})
