// @vitest-environment jsdom
import React from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ApprovalWait, QuestionWait } from '../src/client/contract/slots.js'
import { ApprovalFlow } from '../src/client/components/ApprovalFlow.js'
import { QuestionFlow } from '../src/client/components/QuestionFlow.js'
import { standardProfile, vimProfile } from '../src/client/profiles/builtins.js'

const t = (key: string) => ({
  'question.custom': 'Additional details',
  'question.skip': 'Skip',
  'question.next': 'Next',
  'question.submit': 'Submit',
}[key] ?? key)
type Receipt = { accepted: true } | { accepted: false; reason: string }
type Response = (result: unknown) => Promise<Receipt>

const receipt = (accepted = true): Promise<Receipt> => Promise.resolve(
  accepted ? { accepted: true } : { accepted: false, reason: 'rejected' },
)

function question(
  respond: Response = vi.fn(() => receipt()),
  options: readonly { label: string }[] = [{ label: 'A' }, { label: 'B' }],
  multiSelect = false,
  questions: readonly { id: string; question: string; options: readonly { label: string }[]; multiSelect?: boolean }[] = [{ id: 'q', question: 'Pick', options: [...options], multiSelect }],
): QuestionWait {
  return {
    kind: 'question',
    key: 'q:q1',
    sessionId: 's1' as never,
    payload: {
      questions: questions.map(item => ({ ...item, options: [...item.options] })),
    },
    respond,
  } as unknown as QuestionWait
}

function approval(respond: Response = vi.fn(() => receipt())): ApprovalWait {
  return {
    kind: 'approval',
    key: 'a:a1',
    sessionId: 's1' as never,
    payload: { approvalId: 'ap1' as never, toolName: 'bash', reason: 'Run command' },
    respond,
  } as unknown as ApprovalWait
}

function questionSurface(): HTMLElement {
  return document.querySelector('[data-question-key]') as HTMLElement
}

function approvalSurface(): HTMLElement {
  return document.querySelector('[data-approval-key]') as HTMLElement
}

afterEach(cleanup)

describe('shortcut composer flows', () => {
  it('focuses the first option and keeps keyboard focus roving after open', async () => {
    const respond = vi.fn<Response>(() => receipt())
    render(<QuestionFlow matched={question(respond)} activeProfile={standardProfile} t={t} cancelTask={vi.fn(async () => {})} />)
    const first = screen.getByRole('radio', { name: 'A' })
    expect(screen.getByTestId('interaction-surface').getAttribute('data-interaction-kind')).toBe('question')
    expect(screen.getByTestId('question-scroll').contains(first)).toBe(true)
    expect(screen.getByTestId('question-actions').contains(screen.getByRole('button', { name: 'Skip' }))).toBe(true)
    expect(screen.getByTestId('question-scroll').contains(screen.getByTestId('question-actions'))).toBe(false)
    const second = screen.getByRole('radio', { name: 'B' })
    await waitFor(() => expect(document.activeElement).toBe(first))
    expect(first.getAttribute('tabindex')).toBe('0')
    expect(second.getAttribute('tabindex')).toBe('-1')
    expect(first.className).toContain('option')
    fireEvent.keyDown(questionSurface(), { key: 'ArrowDown' })
    expect(document.activeElement).toBe(second)
    expect(first.getAttribute('tabindex')).toBe('-1')
    expect(second.getAttribute('tabindex')).toBe('0')
  })

  it('submits the DSH question selected/custom envelope', async () => {
    const respond = vi.fn<Response>(() => receipt())
    render(<QuestionFlow matched={question(respond)} activeProfile={standardProfile} t={t} cancelTask={vi.fn(async () => {})} />)

    fireEvent.click(screen.getByRole('radio', { name: 'A' }))
    await waitFor(() => expect(respond).toHaveBeenCalled())
    expect(respond.mock.calls[0]?.[0]).toEqual({
      ok: true,
      value: { sessionId: 's1', answer: { answers: [{ id: 'q', selected: ['A'] }] } },
    })
  })

  it('submits a skipped final question from click with an empty selection', async () => {
    const respond = vi.fn<Response>(() => receipt())
    render(<QuestionFlow matched={question(respond, [], false)} activeProfile={standardProfile} t={t} cancelTask={vi.fn(async () => {})} />)

    fireEvent.click(screen.getByRole('button', { name: 'Skip' }))
    await waitFor(() => expect(respond).toHaveBeenCalledTimes(1))
    expect(respond.mock.calls[0]?.[0]).toMatchObject({ value: { answer: { answers: [{ id: 'q', selected: [] }] } } })
  })

  it('advances skipped questions and submits the final answer', async () => {
    const respond = vi.fn<Response>(() => receipt())
    render(<QuestionFlow
      matched={question(respond, [], false, [
        { id: 'q1', question: 'First', options: [] },
        { id: 'q2', question: 'Second', options: [] },
      ])}
      activeProfile={standardProfile}
      t={t}
      cancelTask={vi.fn(async () => {})}
    />)

    fireEvent.click(screen.getByRole('button', { name: 'Skip' }))
    expect(screen.getByRole('heading', { name: 'Second' })).toBeTruthy()
    expect(respond).not.toHaveBeenCalled()
    fireEvent.keyDown(questionSurface(), { key: 'ArrowDown' })
    fireEvent.keyDown(questionSurface(), { key: 'Enter' })
    await waitFor(() => expect(respond).toHaveBeenCalledTimes(1))
    expect(respond.mock.calls[0]?.[0]).toMatchObject({ value: { answer: { answers: [{ id: 'q1', selected: [] }, { id: 'q2', selected: [] }] } } })
  })

  it('submits a single non-multi custom textarea Enter only once', async () => {
    const respond = vi.fn<Response>(() => receipt())
    render(<QuestionFlow matched={question(respond, [], false)} activeProfile={standardProfile} t={t} cancelTask={vi.fn(async () => {})} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'custom answer' } })
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' })
    await waitFor(() => expect(respond).toHaveBeenCalledTimes(1))
  })

  it('handles zero options with custom, skip, and submit controls', async () => {
    const respond = vi.fn<Response>(() => receipt())
    render(<QuestionFlow matched={question(respond, [], false)} activeProfile={standardProfile} t={t} cancelTask={vi.fn(async () => {})} />)
    expect(screen.queryAllByRole('radio')).toHaveLength(0)
    expect(screen.getByRole('textbox')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Skip' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }))
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))
    await waitFor(() => expect(respond).toHaveBeenCalledTimes(1))
    expect(respond.mock.calls[0]?.[0]).toMatchObject({ value: { answer: { answers: [{ id: 'q', selected: [] }] } } })
  })

  it('uses Arrow focus and activate for option, custom, skip, and advance kinds', async () => {
    const respond = vi.fn<Response>(() => receipt())
    render(<QuestionFlow matched={question(respond, [{ label: 'A' }], true)} activeProfile={standardProfile} t={t} cancelTask={vi.fn(async () => {})} />)
    const surface = questionSurface()
    fireEvent.keyDown(surface, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(screen.getByRole('textbox'))
    fireEvent.keyDown(surface, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Skip' }))
    fireEvent.keyDown(surface, { key: 'Enter' })
    await waitFor(() => expect(respond).toHaveBeenCalledTimes(1))
  })

  it('submits a skipped question from keyboard activation', async () => {
    const respond = vi.fn<Response>(() => receipt())
    render(<QuestionFlow matched={question(respond, [], true)} activeProfile={standardProfile} t={t} cancelTask={vi.fn(async () => {})} />)
    const surface = questionSurface()
    fireEvent.keyDown(surface, { key: 'ArrowDown' })
    fireEvent.keyDown(surface, { key: 'Enter' })
    await waitFor(() => expect(respond).toHaveBeenCalledTimes(1))
    expect(respond.mock.calls[0]?.[0]).toMatchObject({ value: { answer: { answers: [{ id: 'q', selected: [] }] } } })
  })
  it('supports multi-select, custom text, and profile navigation', async () => {
    const respond = vi.fn<Response>(() => receipt())
    render(<QuestionFlow matched={question(respond, [{ label: 'A' }, { label: 'B' }], true)} activeProfile={vimProfile} t={t} cancelTask={vi.fn(async () => {})} />)
    const surface = questionSurface()
    const options = screen.getAllByRole('checkbox')
    fireEvent.click(options[0]!)
    fireEvent.click(options[1]!)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'custom text' } })
    fireEvent.keyDown(surface, { key: 'j' })
    fireEvent.keyDown(surface, { key: 'Enter' })
    await waitFor(() => expect(respond).toHaveBeenCalled())
    expect(respond.mock.calls[0]?.[0]).toEqual({
      ok: true,
      value: {
        sessionId: 's1',
        answer: { answers: [{ id: 'q', selected: ['A', 'B'], custom: 'custom text' }] },
      },
    })
  })


  it('passes IME/repeat Enter and cancels without answering', async () => {
    const respond = vi.fn<Response>(() => receipt())
    const cancel = vi.fn(async () => {})
    render(<QuestionFlow matched={question(respond)} activeProfile={standardProfile} t={t} cancelTask={cancel} />)
    const surface = questionSurface()
    fireEvent.keyDown(surface, { key: 'Enter', repeat: true })
    fireEvent.keyDown(surface, { key: 'Enter', keyCode: 229 })
    fireEvent.keyDown(surface, { key: 'Escape' })
    expect(cancel).toHaveBeenCalledOnce()
    expect(respond).not.toHaveBeenCalled()
  })

  it('recovers from question cancel failure', async () => {
    const cancel = vi.fn(async () => { throw new Error('cancel failed') })
    render(<QuestionFlow matched={question()} activeProfile={standardProfile} t={t} cancelTask={cancel} />)
    fireEvent.keyDown(questionSurface(), { key: 'Escape' })
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('cancel failed'))
    expect(screen.getByRole('radio', { name: 'A' }).disabled).toBe(false)
  })

  it('focuses allow-once by default and recovers from rejected approval receipt', async () => {
    const respond = vi.fn<Response>(() => receipt(false))
    render(<ApprovalFlow matched={approval(respond)} activeProfile={standardProfile} t={t} cancelTask={vi.fn(async () => {})} />)
    const allow = screen.getByRole('button', { name: 'Allow once' })
    expect(document.activeElement).toBe(allow)
    expect(screen.getByTestId('interaction-surface').getAttribute('data-interaction-kind')).toBe('approval')
    expect(screen.getByTestId('approval-scroll').textContent).toContain('Run command')
    expect(screen.getByTestId('approval-actions').contains(screen.getByRole('button', { name: 'Allow once' }))).toBe(true)
    expect(screen.getByTestId('approval-scroll').contains(screen.getByTestId('approval-actions'))).toBe(false)
    fireEvent.keyDown(approvalSurface(), { key: 'Enter' })
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('rejected'))
    expect(allow.disabled).toBe(false)
    expect(respond.mock.calls[0]?.[0]).toMatchObject({
      ok: true,
      value: { sessionId: 's1', approvalId: 'ap1', outcome: 'allowed-once' },
    })
  })

  it('supports vim approval focus and Escape cancel without rejected response', () => {
    const respond = vi.fn<Response>(() => receipt())
    const cancel = vi.fn(async () => {})
    render(<ApprovalFlow matched={approval(respond)} activeProfile={vimProfile} t={t} cancelTask={cancel} />)
    fireEvent.keyDown(approvalSurface(), { key: 'j' })
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Reject' }))
    fireEvent.keyDown(approvalSurface(), { key: 'Escape' })
    expect(cancel).toHaveBeenCalledOnce()
    expect(respond).not.toHaveBeenCalled()
  })

  it('recovers from approval cancel failure', async () => {
    const cancel = vi.fn(async () => { throw new Error('cancel failed') })
    render(<ApprovalFlow matched={approval()} activeProfile={standardProfile} t={t} cancelTask={cancel} />)
    fireEvent.keyDown(approvalSurface(), { key: 'Escape' })
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('cancel failed'))
    expect((screen.getByRole('button', { name: 'Allow once' }) as HTMLButtonElement).disabled).toBe(false)
  })
})
