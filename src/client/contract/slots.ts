import type { ComposerChainProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { ShortcutProfile } from './profile.js'

export type SessionId = NonNullable<ComposerChainProps['sessionId']>

export interface QuestionItem {
  readonly id: string
  readonly question: string
  readonly detail?: string
  readonly multiSelect?: boolean
  readonly options?: readonly { readonly label: string; readonly description?: string }[]
}

export interface QuestionWait {
  readonly kind: 'question' | 'plan-review'
  readonly key: string
  readonly sessionId: SessionId
  readonly questions: readonly QuestionItem[]
  answer(value: unknown): Promise<void>
  /**
   * Recorded answers of an already-settled call. Present means this card is a read-only
   * review with no answer channel and no countdown, so the official presentation must keep it.
   */
  readonly review?: readonly unknown[]
  /**
   * Countdown lifetime of a limited-time question, when the running DSH exposes it.
   * Freezing and resuming the carrier's own timer is what keeps a draft from timing out.
   */
  readonly holdFocus?: () => void
  readonly releaseFocus?: () => void
  readonly engage?: () => void
}

export interface ApprovalWait {
  readonly kind: 'approval'
  readonly key: string
  readonly sessionId: SessionId
  readonly toolName: string
  readonly reason?: string
  answer(outcome: 'allowed-once' | 'rejected'): Promise<void>
}

export type ShortcutWait = QuestionWait | ApprovalWait

/** Props supplied by the composer slot injector; no Cordis context or platform detection. */
export interface ShortcutComposerProps {
  readonly matched: ShortcutWait
  readonly interactionProfile: ShortcutProfile
  readonly t: (key: string) => string
  readonly cancelTask: () => Promise<void>
}

export function isApprovalWait(value: ShortcutWait): value is ApprovalWait { return value.kind === 'approval' }
/** Whether a question carrier is the read-only record of an already-settled call. */
export function isReviewCard(matched: QuestionWait): boolean { return matched.review !== undefined }
/** Freeze the carrier's own countdown while the answer surface holds focus. */
export function holdQuestionFocus(matched: QuestionWait): void { matched.holdFocus?.() }
/** Resume the carrier's countdown once focus leaves the answer surface. */
export function releaseQuestionFocus(matched: QuestionWait): void { matched.releaseFocus?.() }
/** Keep an edited draft answerable by stopping the carrier's countdown. */
export function engageQuestion(matched: QuestionWait): void { matched.engage?.() }
export function questionItems(matched: QuestionWait): readonly QuestionItem[] { return matched.questions }
export async function answerQuestion(matched: QuestionWait, answer: unknown): Promise<void> { await matched.answer(answer) }
export function approvalDetail(matched: ApprovalWait): { readonly reason?: string; readonly toolName: string } {
  return { reason: matched.reason, toolName: matched.toolName }
}
export async function answerApproval(matched: ApprovalWait, outcome: 'allowed-once' | 'rejected'): Promise<void> {
  await matched.answer(outcome)
}

/** Only elect the explicitly enabled current carrier; legacy payload carriers are not supported. */
export function selectShortcut(owner: ComposerChainProps, kind: 'question' | 'approval'): ShortcutWait | null {
  const pending = owner.pendingInteraction
  if (pending === undefined || typeof pending !== 'object' || pending === null) return null
  if (!('answer' in pending) || typeof pending.answer !== 'function') return null
  if (kind === 'question' && (pending.kind === 'question' || pending.kind === 'plan-review')
    && 'questions' in pending && Array.isArray(pending.questions)) {
    // A review card renders a settled call's record: it has no answer channel, so electing it
    // would replace the official read-only presentation with a submit that cannot succeed.
    if ('review' in pending && (pending as QuestionWait).review !== undefined) return null
    return pending as QuestionWait
  }
  if (kind === 'approval' && pending.kind === 'approval' && 'toolName' in pending) return pending as ApprovalWait
  return null
}
