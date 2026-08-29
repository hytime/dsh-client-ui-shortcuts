/** Type-only boundary between shortcut code and DSH slot carriers. */
import type { PendingWait } from '@deepseek-ai/dsh-client-runtime/client'
import type { ComposerChainProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { SettingsPluginItemOwnerProps } from '@deepseek-ai/dsh-client-ui-settings-plugins/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings-plugins/client'
import type { ShortcutProfile } from './profile.js'
import type { ShortcutPlatform } from './keyboard-visual.js'
import type { ShortcutSettingsFace } from './settings.js'

/** DSH question carrier narrowed for shortcut consumers. */
type LegacyQuestionWait = PendingWait<'question'>
type LegacyApprovalWait = PendingWait<'approval'>

type CurrentQuestionWait = {
  readonly kind: 'question' | 'plan-review'
  readonly key: string
  readonly sessionId: LegacyQuestionWait['sessionId']
  readonly questions: readonly LegacyQuestionWait['payload']['questions'][number][]
  readonly answer: (value: unknown) => Promise<void>
}

type CurrentApprovalWait = {
  readonly kind: 'approval'
  readonly key: string
  readonly sessionId: LegacyApprovalWait['sessionId']
  readonly toolName: string
  readonly reason?: string
  readonly answer: (outcome: 'allowed-once' | 'rejected') => Promise<void>
}

export type QuestionWait = LegacyQuestionWait | CurrentQuestionWait
export type QuestionItem = LegacyQuestionWait['payload']['questions'][number]

/** DSH approval carrier narrowed for shortcut consumers. */
export type ApprovalWait = LegacyApprovalWait | CurrentApprovalWait

/** Pending interaction kinds handled by the shortcut composer. */
export type ShortcutWait = QuestionWait | ApprovalWait

/** Props supplied by the composer slot injector and consumed by ShortcutComposer. */
export type ShortcutComposerProps = {
  readonly matched: ShortcutWait
  readonly activeProfile: ShortcutProfile
  readonly t: (key: string) => string
  readonly cancelTask: () => Promise<void>
  readonly platform: ShortcutPlatform
}

/** Props consumed by the keyed settings plugin card. */
export type ShortcutProfileCardProps = SettingsPluginItemOwnerProps & {
  readonly settings: ShortcutSettingsFace
  readonly t: (key: string) => string
  readonly availableGlobalActions: readonly string[]
  readonly platform: ShortcutPlatform
}

/** Select the highest-priority shortcut interaction from the owner currency. */
type LegacyComposerChainProps = {
  readonly interactions?: readonly unknown[]
}

type CurrentComposerChainProps = ComposerChainProps & {
  readonly pendingInteraction?: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isQuestionWait(value: unknown): value is QuestionWait {
  return isRecord(value) && (value.kind === 'question' || value.kind === 'plan-review')
}

export function isApprovalWait(value: unknown): value is ApprovalWait {
  return isRecord(value) && value.kind === 'approval'
}

function hasCurrentAnswer(value: object): value is { readonly answer: (...args: never[]) => Promise<void> } {
  return typeof Reflect.get(value, 'answer') === 'function'
}

/** Read question items from either the current or legacy DSH carrier. */
export function questionItems(matched: QuestionWait): readonly LegacyQuestionWait['payload']['questions'][number][] {
  if (isRecord(matched) && Array.isArray(matched.questions)) return matched.questions as LegacyQuestionWait['payload']['questions'][number][]
  const legacy = matched as LegacyQuestionWait
  return legacy.payload.questions
}

/** Answer a question through the current or legacy DSH carrier contract. */
export async function answerQuestion(matched: QuestionWait, answer: unknown): Promise<void> {
  if (hasCurrentAnswer(matched)) {
    await matched.answer(answer as never)
    return
  }
  const receipt = await matched.respond({
    ok: true,
    value: { sessionId: matched.sessionId, answer },
  })
  if (!receipt.accepted) throw new Error(receipt.reason)
}

/** Renderable approval detail from either the current or legacy DSH carrier. */
export function approvalDetail(matched: ApprovalWait): { readonly reason?: string; readonly toolName: string } {
  const payload = Reflect.get(matched, 'payload')
  if (isRecord(payload)) {
    return {
      reason: typeof payload.reason === 'string' ? payload.reason : undefined,
      toolName: typeof payload.toolName === 'string' ? payload.toolName : '',
    }
  }
  const current = matched as CurrentApprovalWait
  return { reason: current.reason, toolName: current.toolName }
}

/** Answer an approval through the current or legacy DSH carrier contract. */
export async function answerApproval(matched: ApprovalWait, outcome: 'allowed-once' | 'rejected'): Promise<void> {
  if (hasCurrentAnswer(matched)) {
    await matched.answer(outcome)
    return
  }
  const legacy = matched as LegacyApprovalWait
  const receipt = await legacy.respond({
    ok: true,
    value: { sessionId: legacy.sessionId, approvalId: legacy.payload.approvalId, outcome },
  })
  if (!receipt.accepted) throw new Error(receipt.reason)
}

export function selectShortcut(owner: ComposerChainProps): ShortcutWait | null {
  const currentOwner = owner as CurrentComposerChainProps
  if (Object.hasOwn(currentOwner, 'pendingInteraction')) {
    const pending = currentOwner.pendingInteraction
    if (isQuestionWait(pending)) return pending
    if (isApprovalWait(pending)) return pending
    return null
  }

  const interactions = (owner as ComposerChainProps & LegacyComposerChainProps).interactions
  if (!Array.isArray(interactions)) return null
  const question = interactions.find(isQuestionWait)
  if (question !== undefined) return question
  return interactions.find(isApprovalWait) ?? null
}
