// @vitest-environment jsdom
import React from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { QuestionWait } from '../src/client/contract/slots.js'
import { selectShortcut } from '../src/client/contract/slots.js'
import { QuestionFlow } from '../src/client/components/QuestionFlow.js'
import { standardProfile } from '../src/client/profiles/builtins.js'

const t = (key: string) => ({ 'question.custom': 'Other', 'question.skip': 'Skip', 'question.next': 'Next',
  'question.submit': 'Submit', 'question.previous': 'Previous' }[key] ?? key)
const noCancel = async (): Promise<void> => {}
afterEach(cleanup)

/** Minimal stand-in for the carrier shape the composer chain hands to a selector. */
function owner(pending: unknown) {
  return { pendingInteraction: pending } as never
}

describe('official question carrier selection', () => {
  it('declines a read-only review card so the official presentation keeps it', () => {
    // The published carrier marks a settled call's record with `review`; it has no answer
    // channel and no countdown, so taking it over would offer a submit that cannot succeed.
    const review = { kind: 'question', key: 'review:1', questions: [{ id: 'q', question: 'Pick', options: [] }],
      answer: vi.fn(), review: [{ id: 'q', selected: ['A'] }], dismissal: 'hide', dismiss: vi.fn() }
    expect(selectShortcut(owner(review), 'question')).toBeNull()
  })

  it('still elects a live question carrier that has no review record', () => {
    const live = { kind: 'question', key: 'q:1', questions: [{ id: 'q', question: 'Pick', options: [] }], answer: vi.fn() }
    expect(selectShortcut(owner(live), 'question')).toBe(live)
  })
})

describe('limited-time question lifecycle', () => {
  function limited(answer = vi.fn(async () => {}), overrides: Record<string, unknown> = {}): QuestionWait {
    return { kind: 'question', key: 'q:timed', sessionId: 's1' as never,
      questions: [{ id: 'q', question: 'Pick', options: [{ label: 'A' }] }], answer, ...overrides } as QuestionWait
  }

  it('freezes the countdown while the answer surface holds focus and resumes on blur', async () => {
    const holdFocus = vi.fn()
    const releaseFocus = vi.fn()
    render(<QuestionFlow matched={limited(vi.fn(async () => {}), { holdFocus, releaseFocus })}
      interactionProfile={standardProfile} t={t} cancelTask={noCancel} />)
    const surface = screen.getByTestId('interaction-surface')

    surface.focus()
    await waitFor(() => expect(holdFocus).toHaveBeenCalled())
    surface.blur()
    await waitFor(() => expect(releaseFocus).toHaveBeenCalled())
  })

  it('engages the carrier on the first edited answer so a draft is not timed out', async () => {
    const engage = vi.fn()
    render(<QuestionFlow matched={limited(vi.fn(async () => {}), { engage })}
      interactionProfile={standardProfile} t={t} cancelTask={noCancel} />)

    fireEvent.click(screen.getByRole('radio', { name: 'A' }))

    await waitFor(() => expect(engage).toHaveBeenCalled())
  })

  it('does not require lifecycle methods from an older carrier', () => {
    // The verified baseline exposes none of these; the card must still render and answer.
    render(<QuestionFlow matched={limited()} interactionProfile={standardProfile} t={t} cancelTask={noCancel} />)
    expect(screen.getByRole('radio', { name: 'A' })).toBeTruthy()
  })
})
