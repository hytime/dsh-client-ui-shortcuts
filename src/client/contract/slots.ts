/** Type-only boundary between shortcut code and DSH slot carriers. */
import type { PendingWait } from '@deepseek-ai/dsh-client-runtime/client'
import type { ComposerChainProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { SettingsPluginItemOwnerProps } from '@deepseek-ai/dsh-client-ui-settings-plugins/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings-plugins/client'
import type { ShortcutProfile } from './profile.js'
import type { ShortcutSettingsFace } from '../settings/controller.js'

/** DSH question carrier narrowed for shortcut consumers. */
export type QuestionWait = PendingWait<'question'>

/** DSH approval carrier narrowed for shortcut consumers. */
export type ApprovalWait = PendingWait<'approval'>

/** Pending interaction kinds handled by the shortcut composer. */
export type ShortcutWait = QuestionWait | ApprovalWait

/** Props supplied by the composer slot injector and consumed by ShortcutComposer. */
export type ShortcutComposerProps = {
  readonly matched: ShortcutWait
  readonly activeProfile: ShortcutProfile
  readonly t: (key: string) => string
  readonly cancelTask: () => Promise<void>
}

/** Props consumed by the keyed settings plugin card. */
export type ShortcutProfileCardProps = SettingsPluginItemOwnerProps & {
  readonly settings: ShortcutSettingsFace
  readonly profiles: readonly ShortcutProfile[]
  readonly t: (key: string) => string
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
