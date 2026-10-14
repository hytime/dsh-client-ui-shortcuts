import type { ShortcutBinding } from '@deepseek-ai/dsh-client-shortcuts/client'
import type { ShortcutSettings } from '../../settings.js'

/** One candidate the official service normalized, with its official rejection detail. */
export interface ShortcutCandidate {
  readonly binding: ShortcutBinding | null
  readonly keys: readonly string[]
  readonly issue: string | null
  readonly conflicts: readonly string[]
}

/** One editable official command as the official catalog presents it. */
export interface QuickPanelCommand {
  readonly id: string
  readonly label: string
  /** Officially presented keycaps; empty means the command is unbound. */
  readonly keys: readonly string[]
  /** True when the accepted configuration overrides this command's official default. */
  readonly modified: boolean
  readonly issue: string | null
  readonly conflicts: readonly string[]
}

/** Localized outcome of one official describe or edit call. */
export interface QuickPanelMessage {
  readonly code:
    | 'conflict' | 'unsupported' | 'stale' | 'write-failed' | 'not-ready' | 'read-failed' | 'native-failed'
    | 'imported' | 'exported'
    | 'import-invalid' | 'import-future' | 'import-too-large' | 'import-read-failed' | 'import-partial'
  /** Conflicting command labels the official service reported. */
  readonly detail?: readonly string[]
}

export interface QuickPanelSnapshot {
  readonly open: boolean
  readonly questionEnabled: boolean
  readonly approvalEnabled: boolean
  readonly writable: boolean
  /** Whether the official shortcut configuration is readable and writable. */
  readonly officialWritable: boolean
  readonly saving: boolean
  /**
   * Every command the official service exposes, with this plugin's own summon command first.
   * Both this panel and the official keyboard settings read and write these same entries.
   */
  readonly commands: readonly QuickPanelCommand[]
  /** Command currently armed for recording, or null when not recording. */
  readonly recordingCommand: string | null
  /** Reasons the last candidate or write was refused; cleared on success or reset. */
  readonly message: QuickPanelMessage | null
}

/** Plain observable values and callbacks; no Cordis context or business service reaches React. */
export interface QuickPanelModel {
  getSnapshot(): QuickPanelSnapshot
  subscribe(listener: () => void): () => void
  open(): void
  close(): void
  toggle(): void
  setEnabled(field: keyof ShortcutSettings, enabled: boolean): Promise<void>
  /**
   * Arm official native interception for one command's binding; failure is reported,
   * never silently ignored. Recording another command while armed switches the target.
   */
  startRecording(commandId: string): Promise<void>
  /** Release official native interception and leave recording mode. */
  stopRecording(): void
  /**
   * Release recording because the last panel surface unmounted. Desktop keeps native
   * interception window-wide, so leaving this armed would suppress the user's own shortcuts.
   */
  releaseSurface(): void
  /** Normalize one candidate (or `null` for unbound) through the official service without persisting it. */
  describe(candidate: ShortcutBinding | null): ShortcutCandidate
  /**
   * Judge one recorded candidate for the armed command: report the official rejection and keep
   * recording for a retry, or leave recording and save it. Never persists an unusable combination.
   */
  finishRecording(candidate: ShortcutBinding): Promise<void>
  /** Save one command's binding through the official revision-checked edit. */
  saveBinding(commandId: string, candidate: ShortcutBinding): Promise<void>
  /** Remove one command's override so it re-inherits its official default. */
  resetCommand(commandId: string): Promise<void>
  /** Clear one command's binding so it has no key at all. */
  clearCommand(commandId: string): Promise<void>
  /**
   * Export this plugin's configuration as one portable JSON document. The official binding is
   * projected read-only: this plugin still stores no keybinding of its own.
   */
  exportConfig(): string
  /**
   * Apply one document. The plugin's own switches and the official binding are written through
   * their own owners, and a refused official edit leaves the plugin switches untouched.
   * Pass `null` when the chosen file could not be read at all.
   */
  importConfig(raw: string | null): Promise<void>
  /** Drop a pending message without writing. */
  dismiss(): void
}

export interface QuickPanelProps {
  readonly model: QuickPanelModel
  readonly t: (key: string) => string
}
