/** Type-only boundary between shortcut code and DSH slot carriers. */
import type { PendingInteraction, PendingWait } from '@deepseek-ai/dsh-client-runtime/client'
import type { ComposerChainProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { SettingsPluginItemOwnerProps } from '@deepseek-ai/dsh-client-ui-settings-plugins/client'
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

/** Existing DSH interaction union retained without a runtime import. */
export type ShortcutInteraction = PendingInteraction
