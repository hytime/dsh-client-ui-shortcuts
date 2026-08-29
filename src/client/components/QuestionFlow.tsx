import React, { useEffect, useRef, useState } from 'react'
import type { QuestionItem, QuestionWait } from '../contract/slots.js'
import { answerQuestion, questionItems } from '../contract/slots.js'
import type { ShortcutProfile } from '../contract/profile.js'
import { resolveKey } from '../keyboard/resolve.js'
import type { KeyInput } from '../contract/keyboard.js'
import surfaceStyles from '../styles/InteractionSurface.module.css'
import clsx from 'clsx'
import { InteractionSurface } from './InteractionSurface.js'
import { ShortcutIcon } from './ShortcutIcon.js'

export interface QuestionFlowProps {
  readonly matched: QuestionWait
  readonly activeProfile: ShortcutProfile
  readonly t: (key: string) => string
  readonly cancelTask: () => Promise<void>
  readonly platform: 'mac' | 'windows' | 'linux'
}
type Question = QuestionItem
type Answer = { id: string; selected: string[]; custom?: string }
type Draft = { selected: string[]; custom: string; skipped: boolean }
type FocusItem =
  | { readonly kind: 'option'; readonly label: string }
  | { readonly kind: 'custom' }
  | { readonly kind: 'skip' }
  | { readonly kind: 'previous' }
  | { readonly kind: 'advance' }

const composing = (event: React.KeyboardEvent<HTMLElement>): boolean => event.nativeEvent.isComposing || (event.nativeEvent as KeyboardEvent).isComposing
function initialDraft(): Draft { return { selected: [], custom: '', skipped: false } }

export function QuestionFlow({ matched, activeProfile, t, cancelTask, platform }: QuestionFlowProps): React.ReactElement {
  const questions = questionItems(matched)
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
  const previousOffset = index > 0 ? 1 : 0
  const skipIndex = options.length + previousOffset + 1
  const advanceIndex = skipIndex + 1
  const focusList: FocusItem[] = [
    ...options.map(option => ({ kind: 'option' as const, label: option.label })),
    { kind: 'custom' },
    ...(index > 0 ? [{ kind: 'previous' as const }] : []),
    { kind: 'skip' },
    { kind: 'advance' as const },
  ]
  const moveFocus = (delta: number) => setFocusIndex(current => focusList.length === 0 ? 0 : (current + delta + focusList.length) % focusList.length)

  useEffect(() => { focusItems.current[focusIndex]?.focus() }, [focusIndex, index, matched.key])
  useEffect(() => {
    if (document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement) return
    const first = focusItems.current.find(element => element !== null && !(element as HTMLButtonElement | HTMLInputElement | HTMLTextAreaElement).disabled)
    first?.focus()
  }, [matched.key])
  const updateDraft = (patch: Partial<Draft>) => setDrafts(current => current.map((item, i) => i === index ? { ...item, ...patch } : item))
  const updateCustom = (value: string) => updateDraft({
    custom: value,
    skipped: false,
    ...(multi ? {} : { selected: [] }),
  })
  const answerFor = (items: Draft[]): Answer[] => questions.map((item, i) => {
    const value = items[i]
    const selected = value.skipped ? [] : [...value.selected]
    return { id: item.id, selected, ...(value.skipped || !value.custom.trim() ? {} : { custom: value.custom }) }
  })
  const submit = async (items = drafts) => {
    if (submitting) return
    setSubmitting(true); setError(undefined)
    try {
      await answerQuestion(matched, { answers: answerFor(items) })
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); setSubmitting(false) }
  }
  const advance = () => {
    if (index < questions.length - 1) setIndex(index + 1)
    else void submit()
  }
  const skipQuestion = () => {
    if (submitting) return
    const nextDrafts = drafts.map((item, i) => i === index ? { ...item, selected: [], custom: '', skipped: true } : item)
    setDrafts(nextDrafts)
    if (index < questions.length - 1) setIndex(index + 1)
    else void submit(nextDrafts)
  }
  const choose = (label: string) => {
    if (submitting) return
    if (multi) updateDraft({ selected: draft.selected.includes(label) ? draft.selected.filter(x => x !== label) : [...draft.selected, label], skipped: false })
    else {
      const next = drafts.map((item, i) => i === index ? { ...item, selected: [label], custom: '', skipped: false } : item)
      setDrafts(next)
      if (index < questions.length - 1) setIndex(index + 1)
    }
  }
  const onKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    const input: KeyInput = { key: event.key, alt: event.altKey, ctrl: event.ctrlKey, meta: event.metaKey, shift: event.shiftKey, composing: composing(event), keyCode: event.keyCode, repeat: event.repeat, disabled: submitting }
    const decision = resolveKey(activeProfile, 'question', input, platform)
    if (event.target !== event.currentTarget && event.key === 'Enter') {
      const target = event.target as HTMLElement
      if (target.getAttribute('role') === 'radio' && !multi && draft.selected.length > 0) {
        event.preventDefault()
        advance()
      }
      return
    }
    if (decision.kind === 'pass') {
      if (event.key === 'Enter' && event.currentTarget === event.target && !composing(event) && event.keyCode !== 229 && !event.repeat && !submitting && multi) { event.preventDefault(); advance() }
      return
    }
    event.preventDefault()
    if (decision.command === 'cancelTask') { void cancelTask().catch(cause => { setError(cause instanceof Error ? cause.message : String(cause)); setSubmitting(false) }); return }
    if (decision.command === 'focusPrevious' || decision.command === 'focusNext') moveFocus(decision.command === 'focusPrevious' ? -1 : 1)
    if (decision.command === 'activate') {
      const item = focusList[focusIndex]
      if (item?.kind === 'option') choose(item.label)
      else if (item?.kind === 'custom' || item?.kind === 'advance') advance()
      else if (item?.kind === 'previous') { setIndex(current => current - 1); setError(undefined); setFocusIndex(0) }
      else if (item?.kind === 'skip') skipQuestion()
    }
  }
  if (!question || !draft) return React.createElement('div')
  return <InteractionSurface kind="question" data-question-key={matched.key} onKeyDown={onKeyDown} aria-busy={submitting} tabIndex={-1}>
    <div className={surfaceStyles.card}>
      <div className={surfaceStyles.header}>
        <h2>{question.question}</h2>
        {question.detail ? <p className={surfaceStyles.detail}>{question.detail}</p> : null}
      </div>
      <div className={surfaceStyles.body} data-testid="question-scroll">
        <div className={surfaceStyles.optionGroup} role="group" aria-label={question.question}>
          {options.map((option, optionIndex) => <button
            key={option.label}
            ref={node => { focusItems.current[optionIndex] = node }}
            className={clsx(surfaceStyles.option, draft.selected.includes(option.label) && surfaceStyles.optionSelected)}
            tabIndex={focusIndex === optionIndex ? 0 : -1}
            type="button"
            role={multi ? 'checkbox' : 'radio'}
            aria-checked={draft.selected.includes(option.label)}
            disabled={submitting}
            onClick={() => { setFocusIndex(optionIndex); choose(option.label) }}
          >{multi ? <span className={clsx(surfaceStyles.optionMark, draft.selected.includes(option.label) && surfaceStyles.optionMarkSelected)}>{draft.selected.includes(option.label) ? <ShortcutIcon name="check" size={14} /> : null}</span> : null}<span className={surfaceStyles.optionContent}><span className={surfaceStyles.optionLabel}>{option.label}</span>{option.description ? <span className={surfaceStyles.optionDescription}>{option.description}</span> : null}</span></button>)}
          {options.length > 0 ? <input
            ref={node => { focusItems.current[options.length] = node }}
            className={surfaceStyles.customInput}
            tabIndex={focusIndex === options.length ? 0 : -1}
            type="text"
            aria-label={t('question.custom')}
            placeholder={t('question.custom')}
            value={draft.custom}
            disabled={submitting}
            onChange={event => updateCustom(event.target.value)}
            onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !composing(event) && event.keyCode !== 229 && !event.repeat && !submitting) { event.preventDefault(); event.stopPropagation(); advance() } }}
          /> : <textarea
            ref={node => { focusItems.current[options.length] = node }}
            className={surfaceStyles.customInput}
            tabIndex={focusIndex === options.length ? 0 : -1}
            aria-label={t('question.custom')}
            placeholder={t('question.custom')}
            rows={2}
            value={draft.custom}
            disabled={submitting}
            onChange={event => updateCustom(event.target.value)}
            onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !composing(event) && event.keyCode !== 229 && !event.repeat && !submitting) { event.preventDefault(); event.stopPropagation(); advance() } }}
          />}
        </div>
      </div>
      <div className={surfaceStyles.actions} data-testid="question-actions">
        {index > 0 ? <button
          ref={node => { focusItems.current[options.length + 1] = node }}
          className={surfaceStyles.action}
          tabIndex={focusIndex === options.length + 1 ? 0 : -1}
          type="button"
          disabled={submitting}
          onClick={() => { setIndex(current => current - 1); setError(undefined); setFocusIndex(0) }}
        >{t('question.previous')}</button> : null}
        <button
          ref={node => { focusItems.current[skipIndex] = node }}
          className={clsx(surfaceStyles.action, draft.skipped && surfaceStyles.actionSelected)}
          tabIndex={focusIndex === skipIndex ? 0 : -1}
          type="button"
          disabled={submitting}
          onClick={() => { setFocusIndex(skipIndex); skipQuestion() }}
        >{t('question.skip')}</button>
        <button
          ref={node => { focusItems.current[advanceIndex] = node }}
          className={clsx(surfaceStyles.action, surfaceStyles.actionPrimary)}
          tabIndex={focusIndex === advanceIndex ? 0 : -1}
          type="button"
          disabled={submitting}
          onClick={advance}
        >{index === questions.length - 1 ? t('question.submit') : t('question.next')}</button>
      </div>
      {error ? <p role="alert" className={surfaceStyles.error}>{error}</p> : null}
    </div>
  </InteractionSurface>
}
