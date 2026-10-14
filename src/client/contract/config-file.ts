/** Portable configuration document for this plugin, shared by the codec and the panel model. */

/** Envelope discriminator written into every exported file. */
export const CONFIG_FILE_FORMAT = 'dsh-client-ui-shortcuts/quick-panel'
/** Version this build writes: the plugin switches plus *every* official command's binding. */
export const CONFIG_FILE_VERSION = 2
/** Version 1 files (switches plus one optional summon binding) remain importable. */
export const CONFIG_FILE_MIN_VERSION = 1
/** Refuse oversized documents before parsing them. */
export const MAX_CONFIG_FILE_BYTES = 1 << 20
/** Bound the shortcut map so a malformed file cannot request unbounded sequential writes. */
export const MAX_CONFIG_FILE_SHORTCUTS = 1024

/** Device-explicit modifiers only: `primary` is resolved to `meta` or `control` on export. */
export type ConfigFileModifier = 'control' | 'alt' | 'shift' | 'meta'

/** One official physical binding, in the shape the official service accepts. */
export interface ConfigFileShortcut {
  readonly code: string
  readonly secondCode?: string
  readonly modifiers: readonly ConfigFileModifier[]
}

/**
 * One command's entry. Every command the official catalog exposes is exported, not only the
 * customized ones, so the file is a complete snapshot of the keyboard configuration.
 * `modified` records whether the accepted configuration overrode that command's official
 * default, which is what lets an import reproduce the source state exactly.
 */
export interface ConfigFileShortcutEntry {
  readonly modified: boolean
  /** Effective binding, or `null` when the command currently has no key at all. */
  readonly binding: ConfigFileShortcut | null
  /** Display-only command label for human readers; ignored on import. */
  readonly label?: string
  /** Display-only keycaps for human readers; ignored on import. */
  readonly keys?: readonly string[]
}

/** Every official command keyed by its official command id. */
export type ConfigFileShortcuts = Readonly<Record<string, ConfigFileShortcutEntry>>

/** The plugin's own preferences plus the complete official keyboard snapshot. */
export interface ConfigFileDocument {
  readonly questionEnabled: boolean
  readonly approvalEnabled: boolean
  /** Complete official keyboard snapshot, applied through the official service on import. */
  readonly shortcuts: ConfigFileShortcuts
  /** Device profile the snapshot was read from, for diagnostics only. */
  readonly profile?: string
}

export type ConfigFileDecodeResult =
  | { readonly ok: true; readonly document: ConfigFileDocument }
  | { readonly ok: false; readonly reason: 'invalid' | 'future' | 'too-large' }
