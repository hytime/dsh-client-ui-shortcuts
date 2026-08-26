import { describe, expect, it, vi } from 'vitest'
import {
  ONBOARDING_COMPLETED_VALUE,
  ONBOARDING_STORAGE_KEY,
  hasCompletedOnboarding,
  markOnboardingCompleted,
} from '../src/client/onboarding.js'

function memoryStorage(initial: string | null = null) {
  let value = initial
  return {
    getItem: vi.fn(() => value),
    setItem: vi.fn((_key: string, next: string) => { value = next }),
  }
}

describe('onboarding marker', () => {
  it('recognizes only the current completed marker', () => {
    expect(hasCompletedOnboarding(memoryStorage())).toBe(false)
    expect(hasCompletedOnboarding(memoryStorage(ONBOARDING_COMPLETED_VALUE))).toBe(true)
    expect(hasCompletedOnboarding(memoryStorage('completed-v0'))).toBe(false)
  })

  it('writes the versioned marker', () => {
    const storage = memoryStorage()
    markOnboardingCompleted(storage)
    expect(storage.setItem).toHaveBeenCalledWith(ONBOARDING_STORAGE_KEY, ONBOARDING_COMPLETED_VALUE)
  })

  it('does not throw when storage is missing or rejects access', () => {
    const broken = {
      getItem: vi.fn(() => { throw new Error('storage blocked') }),
      setItem: vi.fn(() => { throw new Error('storage blocked') }),
    }
    expect(hasCompletedOnboarding(undefined)).toBe(false)
    expect(hasCompletedOnboarding(broken)).toBe(false)
    expect(() => markOnboardingCompleted(broken)).not.toThrow()
  })
})
