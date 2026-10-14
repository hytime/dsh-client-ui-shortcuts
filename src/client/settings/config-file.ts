/** Strict JSON codec for the portable quick-panel configuration document. Pure: no DOM, no service. */
import {
  CONFIG_FILE_FORMAT, CONFIG_FILE_MIN_VERSION, CONFIG_FILE_VERSION,
  MAX_CONFIG_FILE_BYTES, MAX_CONFIG_FILE_SHORTCUTS,
} from '../contract/config-file.js'
import type {
  ConfigFileDecodeResult, ConfigFileDocument, ConfigFileModifier, ConfigFileShortcut, ConfigFileShortcuts,
} from '../contract/config-file.js'

const MODIFIERS: readonly ConfigFileModifier[] = ['control', 'alt', 'shift', 'meta']
const MODIFIER_SET = new Set<string>(MODIFIERS)
const DOCUMENT_FIELDS = new Set(['format', 'version', 'configuration'])
const CONFIGURATION_V1_FIELDS = new Set(['questionEnabled', 'approvalEnabled', 'shortcut'])
const CONFIGURATION_FIELDS = new Set(['questionEnabled', 'approvalEnabled', 'shortcuts', 'profile'])
const SHORTCUT_FIELDS = new Set(['code', 'secondCode', 'modifiers'])
const ENTRY_FIELDS = new Set(['modified', 'binding', 'label', 'keys'])
/** The same physical-code contract the official service normalizes; a foreign code is refused here. */
const CODE_PATTERN = /^(Key[A-Z]|Digit[0-9]|F([1-9]|1[0-9]|2[0-4]))$/u
/** The official service's own command-id rule; a foreign id is refused before any write. */
const COMMAND_PATTERN = /^[a-z][a-zA-Z0-9-]*(?:\.[a-zA-Z][a-zA-Z0-9-]*)+$/u
const PROFILE_PATTERN = /^(desktop|web):(macos|windows|linux)$/u
const NAMED_CODES = new Set([
  'Slash', 'Comma', 'Period', 'Backslash', 'Backquote', 'Minus', 'Equal',
  'BracketLeft', 'BracketRight', 'Semicolon', 'Quote', 'Enter', 'Escape', 'Space',
  'Tab', 'Backspace', 'Delete', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasOnlyFields(value: Record<string, unknown>, allowed: ReadonlySet<string>): boolean {
  return Object.keys(value).every(key => allowed.has(key))
}

function isCode(value: unknown): value is string {
  return typeof value === 'string' && (CODE_PATTERN.test(value) || NAMED_CODES.has(value))
}

function parseShortcut(value: unknown): ConfigFileShortcut | 'invalid' {
  if (!isRecord(value) || !hasOnlyFields(value, SHORTCUT_FIELDS)) return 'invalid'
  if (!isCode(value.code)) return 'invalid'
  if (!Array.isArray(value.modifiers) || !value.modifiers.every(modifier => typeof modifier === 'string' && MODIFIER_SET.has(modifier))) {
    return 'invalid'
  }
  if (Object.hasOwn(value, 'secondCode') && !isCode(value.secondCode)) return 'invalid'
  if (value.secondCode === value.code) return 'invalid'
  const modifiers = MODIFIERS.filter(modifier => (value.modifiers as readonly string[]).includes(modifier))
  return {
    code: value.code,
    ...(typeof value.secondCode === 'string' ? { secondCode: value.secondCode } : {}),
    modifiers,
  }
}

/** Parse one command entry: a required `modified` flag plus the effective binding. */
function parseEntry(value: unknown): ConfigFileShortcuts[string] | 'invalid' {
  if (!isRecord(value) || !hasOnlyFields(value, ENTRY_FIELDS)) return 'invalid'
  if (typeof value.modified !== 'boolean') return 'invalid'
  let binding: ConfigFileShortcut | null
  if (value.binding === null) binding = null
  else {
    const parsed = parseShortcut(value.binding)
    if (parsed === 'invalid') return 'invalid'
    binding = parsed
  }
  if (Object.hasOwn(value, 'label') && typeof value.label !== 'string') return 'invalid'
  if (Object.hasOwn(value, 'keys')
    && (!Array.isArray(value.keys) || !value.keys.every(key => typeof key === 'string'))) return 'invalid'
  // Human-readable fields are display-only and intentionally not carried into the runtime value.
  return { modified: value.modified, binding }
}

/** Parse the complete keyboard snapshot: every id must be a real official command id. */
function parseShortcuts(value: unknown): ConfigFileShortcuts | 'invalid' {
  if (!isRecord(value)) return 'invalid'
  const entries = Object.entries(value)
  if (entries.length > MAX_CONFIG_FILE_SHORTCUTS) return 'invalid'
  const shortcuts: Record<string, ConfigFileShortcuts[string]> = {}
  for (const [id, raw] of entries) {
    if (!COMMAND_PATTERN.test(id)) return 'invalid'
    const parsed = parseEntry(raw)
    if (parsed === 'invalid') return 'invalid'
    shortcuts[id] = parsed
  }
  return shortcuts
}

/**
 * Parse one exported document. Unknown fields, wrong types, and future versions are refused
 * outright so an import can never partially apply a document it did not fully understand.
 * Version 1 files carry a single optional summon binding and are read as a one-command snapshot.
 * @param raw - file contents as text.
 * @returns the validated document, or a classified refusal.
 */
export function decodeConfigFile(raw: string): ConfigFileDecodeResult {
  if (raw.length > MAX_CONFIG_FILE_BYTES) return { ok: false, reason: 'too-large' }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { ok: false, reason: 'invalid' }
  }
  if (!isRecord(parsed) || !hasOnlyFields(parsed, DOCUMENT_FIELDS)) return { ok: false, reason: 'invalid' }
  if (parsed.format !== CONFIG_FILE_FORMAT) return { ok: false, reason: 'invalid' }
  if (typeof parsed.version !== 'number' || !Number.isInteger(parsed.version) || parsed.version < CONFIG_FILE_MIN_VERSION) {
    return { ok: false, reason: 'invalid' }
  }
  if (parsed.version > CONFIG_FILE_VERSION) return { ok: false, reason: 'future' }
  const configuration = parsed.configuration
  if (!isRecord(configuration)) return { ok: false, reason: 'invalid' }
  const legacy = parsed.version === 1
  if (!hasOnlyFields(configuration, legacy ? CONFIGURATION_V1_FIELDS : CONFIGURATION_FIELDS)) {
    return { ok: false, reason: 'invalid' }
  }
  if (typeof configuration.questionEnabled !== 'boolean' || typeof configuration.approvalEnabled !== 'boolean') {
    return { ok: false, reason: 'invalid' }
  }
  const base = {
    questionEnabled: configuration.questionEnabled,
    approvalEnabled: configuration.approvalEnabled,
  }
  if (legacy) {
    // A v1 file names one binding for this plugin's summon command, or omits the field entirely.
    if (!Object.hasOwn(configuration, 'shortcut')) return { ok: true, document: { ...base, shortcuts: {} } }
    if (configuration.shortcut === null) {
      return { ok: true, document: { ...base, shortcuts: { 'hytime.shortcuts.open': { modified: true, binding: null } } } }
    }
    const parsedShortcut = parseShortcut(configuration.shortcut)
    if (parsedShortcut === 'invalid') return { ok: false, reason: 'invalid' }
    return { ok: true, document: { ...base, shortcuts: { 'hytime.shortcuts.open': { modified: true, binding: parsedShortcut } } } }
  }
  const shortcuts = parseShortcuts(configuration.shortcuts)
  if (shortcuts === 'invalid') return { ok: false, reason: 'invalid' }
  if (Object.hasOwn(configuration, 'profile')
    && (typeof configuration.profile !== 'string' || !PROFILE_PATTERN.test(configuration.profile))) {
    return { ok: false, reason: 'invalid' }
  }
  return {
    ok: true,
    document: {
      ...base,
      shortcuts,
      ...(typeof configuration.profile === 'string' ? { profile: configuration.profile } : {}),
    },
  }
}

function encodeShortcut(shortcut: ConfigFileShortcut): Record<string, unknown> {
  return {
    code: shortcut.code,
    ...(shortcut.secondCode === undefined ? {} : { secondCode: shortcut.secondCode }),
    modifiers: MODIFIERS.filter(modifier => shortcut.modifiers.includes(modifier)),
  }
}

/**
 * Serialize one document with every official command in a stable id order, so two exports of
 * one configuration are byte-identical. Each entry keeps `modified` because an import must
 * reproduce the source state: a modified command is written back, an unmodified one that still
 * matches its default is left alone, and an unmodified command the user had cleared is re-cleared.
 * @param document - preferences plus the complete official keyboard snapshot.
 * @returns pretty-printed JSON with a trailing newline.
 */
export function encodeConfigFile(document: ConfigFileDocument): string {
  const shortcuts: Record<string, unknown> = {}
  for (const id of Object.keys(document.shortcuts).sort()) {
    const entry = document.shortcuts[id]!
    shortcuts[id] = {
      modified: entry.modified,
      binding: entry.binding === null ? null : encodeShortcut(entry.binding),
      ...(entry.label === undefined ? {} : { label: entry.label }),
      ...(entry.keys === undefined ? {} : { keys: [...entry.keys] }),
    }
  }
  const configuration: Record<string, unknown> = {
    questionEnabled: document.questionEnabled,
    approvalEnabled: document.approvalEnabled,
    shortcuts,
    ...(document.profile === undefined ? {} : { profile: document.profile }),
  }
  return `${JSON.stringify({ format: CONFIG_FILE_FORMAT, version: CONFIG_FILE_VERSION, configuration }, null, 2)}\n`
}
