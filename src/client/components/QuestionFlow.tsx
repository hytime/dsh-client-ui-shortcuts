import React, { useEffect, useRef, useState } from 'react'
import type { QuestionWait } from '../contract/slots.js'
import type { ShortcutProfile } from '../contract/profile.js'
import { resolveKey } from '../keyboard/resolve.js'
import type { KeyInput } from '../contract/keyboard.js'

export interface QuestionFlowProps {
  readonly matched: QuestionWait
  readonly activeProfile: ShortcutProfile
  readonly t: (key: string) => string
  readonly cancelTask: () => Promise<void>
}

type Question = QuestionWait['payload']['questions'][number]
type Answer = { id: string; selected: string[]; custom?: string }
type Draft = { selected: string[]; custom: string; skipped: boolean }

const composing = (event: React.KeyboardEvent<HTMLElement>): boolean => event.nativeEvent.isComposing || (event.nativeEvent as KeyboardEvent).isComposing
function initialDraft(): Draft { return { selected: [], custom: '', skipped: false } }

export function QuestionFlow({ matched, activeProfile, t, cancelTask }: QuestionFlowProps): React.ReactElement {
  const questions = matched.payload.questions
  const [drafts, setDrafts] = useState<Draft[]>(() => questions.map(() => initialDraft()))
  const [index, setIndex] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string>()
  const focusItems = useRef<Array<HTMLElement | null>>([])
  const [focusIndex, setFocusIndex] = useState(0)
  const question = questions[index]
  const draft = drafts[index]
  const options = question?.options ?? []
  const multi = question?.multiSelect === true
  const focusCount = options.length + 3
  const moveFocus = (delta: number) => setFocusIndex(current => (current + delta + focusCount) % focusCount)

  useEffect(() => { focusItems.current[focusIndex]?.focus() }, [focusIndex, index])
  const updateDraft = (patch: Partial<Draft>) => setDrafts(current => current.map((item, i) => i === index ? { ...item, ...patch } : item))
  const answerFor = (items: Draft[]): Answer[] => questions.map((item, i) => {
    const value = items[i]
    const selected = value.skipped ? [] : [...value.selected]
    return { id: item.id, selected, ...(value.skipped || !value.custom.trim() ? {} : { custom: value.custom }) }
  })
  const submit = async (items = drafts) => {
    if (submitting) return
    setSubmitting(true); setError(undefined)
    try {
      const receipt = await matched.respond({
        ok: true,
        value: { sessionId: matched.sessionId, answer: { answers: answerFor(items) } },
      })
      if (!receipt.accepted) throw new Error(receipt.reason)
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); setSubmitting(false) }
  }
  const advance = () => {
    if (index < questions.length - 1) setIndex(index + 1)
    else void submit()
  }
  const choose = (label: string) => {
    if (submitting) return
    if (multi) updateDraft({ selected: draft.selected.includes(label) ? draft.selected.filter(x => x !== label) : [...draft.selected, label] })
    else {
      const next = drafts.map((item, i) => i === index ? { ...item, selected: [label], skipped: false } : item)
      setDrafts(next)
      if (index < questions.length - 1) setIndex(index + 1); else void submit(next)
    }
  }
  const onKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    const input: KeyInput = { key: event.key, alt: event.altKey, ctrl: event.ctrlKey, meta: event.metaKey, shift: event.shiftKey, composing: composing(event), keyCode: event.keyCode, repeat: event.repeat, disabled: submitting }
    const decision = resolveKey(activeProfile, 'question', input)
    if (decision.kind === 'pass') {
      if (event.key === 'Enter' && event.currentTarget === event.target && !composing(event) && event.keyCode !== 229 && !event.repeat && !submitting && multi) { event.preventDefault(); advance() }
      return
    }
    event.preventDefault()
    if (decision.command === 'cancelTask') { void cancelTask().catch(cause => { setError(cause instanceof Error ? cause.message : String(cause)); setSubmitting(false) }); return }
    if (decision.command === 'focusPrevious' || decision.command === 'focusNext') moveFocus(decision.command === 'focusPrevious' ? -1 : 1)
    if (decision.command === 'activate') {
      if (focusIndex < options.length) choose(options[focusIndex].label)
      else if (focusIndex === options.length) advance()
      else if (focusIndex === options.length + 1) updateDraft({ skipped: !draft.skipped })
      else advance()
    }
  }
  if (!question || !draft) return React.createElement('div')
  return <section data-question-key={matched.key} onKeyDown={onKeyDown} aria-busy={submitting}>
    <h2>{question.question}</h2>
    {question.detail ? <p>{question.detail}</p> : null}
    <div role="group" aria-label={question.question}>
      {options.map((option, optionIndex) => <button key={option.label} ref={node => { focusItems.current[optionIndex] = node; if (focusIndex === optionIndex) node?.focus() }} type="button" role={multi ? 'checkbox' : 'radio'} aria-checked={draft.selected.includes(option.label)} disabled={submitting} onClick={() => { setFocusIndex(optionIndex); choose(option.label) }}>{option.label}</button>)}
    </div>
    <textarea ref={node => { focusItems.current[options.length] = node }} aria-label={t('question.custom')} value={draft.custom} disabled={submitting} onChange={event => updateDraft({ custom: event.target.value })} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !composing(event) && event.keyCode !== 229 && !event.repeat && !submitting) { event.preventDefault(); advance() } }} />
    <button ref={node => { focusItems.current[options.length + 1] = node }} type="button" disabled={submitting} onClick={() => updateDraft({ skipped: !draft.skipped })}>{draft.skipped ? t('question.unskip') : t('question.skip')}</button>
    {multi || questions.length > 1 ? <button ref={node => { focusItems.current[options.length + 2] = node }} type="button" disabled={submitting} onClick={advance}>{index === questions.length - 1 ? t('question.submit') : t('question.next')}</button> : null}
    {error ? <p role="alert">{error}</p> : null}
  </section>
}
