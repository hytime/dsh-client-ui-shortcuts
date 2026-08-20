// @vitest-environment jsdom
import React from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ApprovalWait, QuestionWait } from '../src/client/contract/slots.js'
import { ApprovalFlow } from '../src/client/components/ApprovalFlow.js'
import { QuestionFlow } from '../src/client/components/QuestionFlow.js'
import { standardProfile, vimProfile } from '../src/client/profiles/builtins.js'

const t = (key: string) => key
type Receipt = { accepted: true } | { accepted: false; reason: string }
type Response = (result: unknown) => Promise<Receipt>

const receipt = (accepted = true): Promise<Receipt> => Promise.resolve(
  accepted ? { accepted: true } : { accepted: false, reason: 'rejected' },
)

function question(
  respond: Response = vi.fn(() => receipt()),
  options: readonly { label: string }[] = [{ label: 'A' }, { label: 'B' }],
  multiSelect = false,
): QuestionWait {
  return {
    kind: 'question',
    key: 'q:q1',
    sessionId: 's1' as never,
    payload: {
      questions: [{ id: 'q', question: 'Pick', options: [...options], multiSelect }],
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
