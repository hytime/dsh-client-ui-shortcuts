// @vitest-environment jsdom
import React from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ApprovalWait, QuestionWait } from '../src/client/contract/slots.js'
import { ApprovalFlow } from '../src/client/components/ApprovalFlow.js'
import { QuestionFlow } from '../src/client/components/QuestionFlow.js'
import { standardProfile } from '../src/client/profiles/builtins.js'

const t = (key: string) => ({
  'question.custom': 'Additional details',
  'question.skip': 'Skip',
  'question.next': 'Next',
  'question.submit': 'Submit',
  'question.previous': 'Previous question',
  'approval.reject': '拒绝',
  'approval.allowOnce': '允许一次',
  'approval.title': '需要授权才能继续',
  'approval.details': '审批详情',
  'approval.actions': '审批操作',
}[key] ?? key)

interface QuestionOption { readonly label: string; readonly description?: string }
interface QuestionSpec {
  readonly id: string
  readonly question: string
  readonly detail?: string
  readonly options: readonly QuestionOption[]
  readonly multiSelect?: boolean
}

function question(answer = vi.fn(async () => {}), specs: readonly QuestionSpec[] = [
  { id: 'q', question: 'Pick', options: [{ label: 'A' }, { label: 'B' }] },
]): QuestionWait {
  return { kind: 'question', key: 'q:q1', sessionId: 's1' as never, questions: specs, answer }
}

function approval(answer = vi.fn(async () => {}), overrides: Partial<ApprovalWait> = {}): ApprovalWait {
  return { kind: 'approval', key: 'a:a1', sessionId: 's1' as never, toolName: 'bash', reason: 'Run command', answer, ...overrides }
}

const surface = (attr: string): HTMLElement => document.querySelector(`[data-${attr}]`) as HTMLElement
const noCancel = async (): Promise<void> => {}

afterEach(cleanup)

describe('optional interaction cards', () => {
  it('focuses the first option and keeps roving keyboard focus', async () => {
    render(<QuestionFlow matched={question()} interactionProfile={standardProfile} t={t} cancelTask={noCancel} />)
    const first = screen.getByRole('radio', { name: 'A' })
    const second = screen.getByRole('radio', { name: 'B' })
    await waitFor(() => expect(document.activeElement).toBe(first))
    expect(first.getAttribute('tabindex')).toBe('0')
    expect(second.getAttribute('tabindex')).toBe('-1')

    fireEvent.keyDown(surface('question-key'), { key: 'ArrowDown' })

    expect(document.activeElement).toBe(second)
    expect(first.getAttribute('tabindex')).toBe('-1')
    expect(second.getAttribute('tabindex')).toBe('0')
  })

  it('submits the selected answer batch through the current carrier', async () => {
    const answer = vi.fn(async () => {})
    render(<QuestionFlow matched={question(answer)} interactionProfile={standardProfile} t={t} cancelTask={noCancel} />)

    fireEvent.click(screen.getByRole('radio', { name: 'A' }))
    expect(answer).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => expect(answer).toHaveBeenCalledWith({ answers: [{ id: 'q', selected: ['A'] }] }))
  })

  it('preserves custom input focus and text while editing', () => {
    render(<QuestionFlow matched={question()} interactionProfile={standardProfile} t={t} cancelTask={noCancel} />)
    const input = screen.getByRole('textbox')

    input.focus()
    fireEvent.change(input, { target: { value: 'a' } })
    expect(document.activeElement).toBe(input)
    expect(input.value).toBe('a')
    fireEvent.change(input, { target: { value: 'ab' } })
    expect(document.activeElement).toBe(input)
    expect(input.value).toBe('ab')
  })

  it('skips without submitting a batch', async () => {
    const answer = vi.fn(async () => {})
    const twoQuestions: QuestionSpec[] = [
      { id: 'q1', question: 'First', options: [{ label: 'A' }] },
      { id: 'q2', question: 'Second', options: [{ label: 'B' }] },
    ]
    render(<QuestionFlow matched={question(answer, twoQuestions)} interactionProfile={standardProfile} t={t} cancelTask={noCancel} />)

    fireEvent.click(screen.getByRole('button', { name: 'Skip' }))

    expect(answer).not.toHaveBeenCalled()
    expect(screen.getByRole('radio', { name: 'B' })).toBeTruthy()
  })

  it('renders question detail and option descriptions', () => {
    render(<QuestionFlow matched={question(vi.fn(async () => {}), [{
      id: 'q', question: 'Pick', detail: 'Question context',
      options: [{ label: 'A', description: 'Option A details' }],
    }])} interactionProfile={standardProfile} t={t} cancelTask={noCancel} />)

    expect(screen.getByText('Question context')).toBeTruthy()
    expect(screen.getByText('Option A details')).toBeTruthy()
    expect(screen.getByTestId('interaction-surface').getAttribute('data-interaction-kind')).toBe('question')
  })

  it('cancels the task from Escape and reports a rejected answer', async () => {
    const cancelTask = vi.fn(async () => {})
    const answer = vi.fn(async () => { throw new Error('denied by host') })
    const { rerender } = render(<QuestionFlow matched={question(vi.fn(async () => {}))} interactionProfile={standardProfile} t={t} cancelTask={cancelTask} />)

    fireEvent.keyDown(surface('question-key'), { key: 'Escape' })
    await waitFor(() => expect(cancelTask).toHaveBeenCalledOnce())

    rerender(<ApprovalFlow matched={approval(answer)} interactionProfile={standardProfile} t={t} cancelTask={noCancel} />)
    fireEvent.keyDown(surface('approval-key'), { key: 'Enter' })
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('denied by host'))
    expect(answer).toHaveBeenCalledWith('allowed-once')
  })

  it('answers approvals with the selected outcome and does not answer on focus alone', async () => {
    const answer = vi.fn(async () => {})
    render(<ApprovalFlow matched={approval(answer)} interactionProfile={standardProfile} t={t} cancelTask={noCancel} />)

    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: '允许一次' })))
    expect(answer).not.toHaveBeenCalled()

    fireEvent.keyDown(surface('approval-key'), { key: 'ArrowUp' })
    fireEvent.keyDown(surface('approval-key'), { key: 'Enter' })

    // Focus moved to reject, so Enter must reject rather than reuse the earlier default.
    await waitFor(() => expect(answer).toHaveBeenCalledWith('rejected'))
  })

  it('uses the actually focused approval action when Enter follows Tab navigation', async () => {
    const answer = vi.fn(async () => {})
    render(<ApprovalFlow matched={approval(answer)} interactionProfile={standardProfile} t={t} cancelTask={noCancel} />)
    const reject = screen.getByRole('button', { name: '拒绝' })
    reject.focus()
    expect(document.activeElement).toBe(reject)

    fireEvent.keyDown(reject, { key: 'Enter' })

    await waitFor(() => expect(answer).toHaveBeenCalledOnce())
    expect(answer).toHaveBeenCalledWith('rejected')
  })

  it('does not focus a background interaction while a modal owns the keyboard', () => {
    render(<div role="dialog" aria-modal="true" aria-label="Settings">
      <input aria-label="Settings search" />
    </div>)
    const search = screen.getByRole('textbox', { name: 'Settings search' })
    search.focus()

    const background = render(<ApprovalFlow matched={approval()} interactionProfile={standardProfile} t={t} cancelTask={noCancel} />)
    expect(document.activeElement).toBe(search)

    background.unmount()
    search.focus()
    render(<QuestionFlow matched={question()} interactionProfile={standardProfile} t={t} cancelTask={noCancel} />)
    expect(document.activeElement).toBe(search)
  })

  it('keeps one Tab entry when a many-option question advances to a shorter question', async () => {
    const first: QuestionSpec = { id: 'first', question: 'First',
      options: ['A', 'B', 'C', 'D', 'E', 'F'].map(label => ({ label })) }
    const second: QuestionSpec = { id: 'second', question: 'Second', options: [{ label: 'G' }] }
    render(<QuestionFlow matched={question(vi.fn(async () => {}), [first, second])}
      interactionProfile={standardProfile} t={t} cancelTask={noCancel} />)

    fireEvent.click(screen.getByRole('radio', { name: 'F' }))
    await waitFor(() => expect(screen.getByRole('radio', { name: 'G' })).toBeTruthy())

    const controls = screen.getByTestId('interaction-surface').querySelectorAll('button,input,textarea')
    expect([...controls].some(control => control.getAttribute('tabindex') === '0')).toBe(true)
  })

  it('re-enters focus after the pending interaction is replaced', async () => {
    const pending = question()
    const { rerender } = render(<QuestionFlow matched={pending} interactionProfile={standardProfile} t={t} cancelTask={noCancel} />)
    const option = screen.getByRole('radio', { name: 'A' })
    option.focus()

    rerender(<div />)
    expect(document.activeElement).not.toBe(option)
    rerender(<QuestionFlow matched={{ ...pending, key: 'q:q3' }} interactionProfile={standardProfile} t={t} cancelTask={noCancel} />)

    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('radio', { name: 'A' })))
  })
})
