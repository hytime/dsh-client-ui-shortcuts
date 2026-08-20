/** Type-only boundary between shortcut code and DSH slot carriers. */
import type { PendingInteraction, PendingWait } from '@deepseek-ai/dsh-client-runtime/client'
import type { ComposerChainProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { SettingsPluginItemOwnerProps } from '@deepseek-ai/dsh-client-ui-settings-plugins/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings-plugins/client'
import type { ShortcutProfile } from './profile.js'

/** DSH question carrier narrowed for shortcut consumers. */
export type QuestionWait = PendingWait<'question'>

/** DSH approval carrier narrowed for shortcut consumers. */
export type ApprovalWait = PendingWait<'approval'>

/** Pending interaction kinds handled by the shortcut composer. */
export type ShortcutWait = QuestionWait | ApprovalWait

/** Composer owner currency passed through the DSH chain slot. */
export type ShortcutComposerOwnerProps = ComposerChainProps

/** Props consumed by the question/approval composer takeover. */
export type ShortcutComposerProps = ShortcutComposerOwnerProps & {
  readonly matched: ShortcutWait
  readonly activeProfile: ShortcutProfile
  readonly cancelTask: () => Promise<void>
}

/** Props consumed by the keyed settings plugin card. */
export type ShortcutProfileCardProps = SettingsPluginItemOwnerProps & {
  readonly profiles: readonly ShortcutProfile[]
  readonly activeProfileId: string
  readonly onSelectProfile: (id: string) => Promise<void>
}

/** Select the highest-priority shortcut interaction from the owner currency. */
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
