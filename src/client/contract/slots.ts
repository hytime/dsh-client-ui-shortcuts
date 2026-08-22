import type { PendingWait } from '@deepseek-ai/dsh-client-runtime/client'
import type { ComposerChainProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { SettingsPluginItemOwnerProps } from '@deepseek-ai/dsh-client-ui-settings-plugins/client'
import type { ShortcutProfile } from './profile.js'
import type { ShortcutSettingsFace } from '../settings/controller.js'

export type QuestionWait = PendingWait<'question'>
export type ApprovalWait = PendingWait<'approval'>
export type ShortcutWait = QuestionWait | ApprovalWait

export type FocusTransition = {
  readonly sessionId: string
  readonly key: string
}

export type PendingFocusRequest = {
  readonly transition: FocusTransition
  readonly kind: ShortcutWait['kind']
  readonly focus: () => void
}

export type FocusCoordinator = {
  readonly begin: (transition: FocusTransition) => void
  readonly requestPendingFocus: (request: PendingFocusRequest) => void
  readonly ownsExternalFocus: () => boolean
}

export type ShortcutComposerProps = {
  readonly matched: ShortcutWait
  readonly activeProfile: ShortcutProfile
  readonly t: (key: string) => string
  readonly cancelTask: () => Promise<void>
  readonly focusCoordinator?: FocusCoordinator
}

export type ShortcutProfileCardProps = SettingsPluginItemOwnerProps & {
  readonly settings: ShortcutSettingsFace
  readonly profiles: readonly ShortcutProfile[]
  readonly t: (key: string) => string
  readonly availableGlobalActions: readonly string[]
}

export function selectShortcut(owner: ComposerChainProps): ShortcutWait | null {
  const question = owner.interactions.find(
    (item): item is QuestionWait => item.kind === 'question',
  )
  if (question !== undefined) return question
  const approval = owner.interactions.find(
    (item): item is ApprovalWait => item.kind === 'approval',
  )
  return approval ?? null
}
