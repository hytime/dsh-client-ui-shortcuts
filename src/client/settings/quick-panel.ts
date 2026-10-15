import type { ConfigForm } from '@deepseek-ai/dsh-client-ui-settings/client'
import type { ShortcutBinding, ShortcutCommandId, Shortcuts } from '@deepseek-ai/dsh-client-shortcuts/client'
import type { ShortcutProfile } from '@deepseek-ai/dsh-client-shortcuts/protocol'
import type { ConfigFileShortcutEntry } from '../contract/config-file.js'
import type { ShortcutSettings } from '../../settings.js'
import type {
  QuickPanelCommand, QuickPanelMessage, QuickPanelModel, QuickPanelSnapshot, ShortcutCandidate,
} from '../contract/quick-panel.js'
import { decodeConfigFile, encodeConfigFile } from './config-file.js'
import { OPEN_PANEL_COMMAND } from '../keyboard/open-panel.js'

function messageFor(status: string): QuickPanelMessage {
  if (status === 'stale') return { code: 'stale' }
  if (status === 'not-ready') return { code: 'not-ready' }
  if (status === 'unreadable') return { code: 'read-failed' }
  return { code: 'write-failed' }
}

/** Commands this panel always lists first: its own summon command. */
const PINNED_FIRST: readonly string[] = [OPEN_PANEL_COMMAND]

/**
 * Drive the official shortcut service. This panel is a second editor of the *official*
 * command catalog, so a change here and a change in DSH's own keyboard settings are the
 * same write to the same configuration — there is no second store to reconcile.
 */
export function createQuickPanelModel(
  form: ConfigForm<ShortcutSettings>,
  shortcuts: Pick<Shortcuts, 'catalog' | 'config' | 'describeBinding' | 'edit' | 'recording' | 'runtime' | 'platform'>,
): QuickPanelModel & { dispose(): void } {
  const listeners = new Set<() => void>()
  let open = false
  let saving = false
  let recordingCommand: string | null = null
  /**
   * Increments whenever recording is armed, released, or the panel closes. A native
   * acknowledgement that returns afterwards belongs to a superseded request and must not
   * re-arm a panel the user already left.
   */
  let recordingGeneration = 0
  let message: QuickPanelMessage | null = null
  let disposed = false
  const catalogRows = () => shortcuts.catalog.getSnapshot()
  const rowFor = (id: string) => catalogRows().find(row => row.id === id)
  const project = (): QuickPanelSnapshot => {
    const config = form.getSnapshot()
    const ready = config.status === 'ready'
    const official = shortcuts.config.getSnapshot()
    const rank = (id: string): number => {
      const index = PINNED_FIRST.indexOf(id)
      return index < 0 ? PINNED_FIRST.length : index
    }
    const commands: QuickPanelCommand[] = [...catalogRows()]
      .sort((left, right) => rank(left.id) - rank(right.id) || left.label.localeCompare(right.label))
      .map(row => ({ id: row.id, label: row.label, keys: row.keys, modified: row.modified,
        issue: row.issue, conflicts: [...row.conflicts] }))
    return {
      open, saving, recordingCommand, message, commands,
      questionEnabled: ready && config.value?.questionEnabled === true,
      approvalEnabled: ready && config.value?.approvalEnabled === true,
      writable: ready && config.writable,
      // Binding edits are gated by the official configuration, not by this plugin's switches.
      officialWritable: official.status === 'ready',
    }
  }
  let snapshot = project()
  const publish = (): void => {
    if (disposed) return
    snapshot = project()
    for (const listener of [...listeners]) listener()
  }
  const offForm = form.subscribe(publish)
  const offCatalog = shortcuts.catalog.subscribe(publish)
  const offConfig = shortcuts.config.subscribe(publish)
  /** Resolve official command ids to their labels for one localized conflict report. */
  const conflictMessage = (ids: readonly string[], self: string | null): QuickPanelMessage => ({
    code: 'conflict',
    detail: ids.filter(id => id !== self).map(id => rowFor(id)?.label ?? id),
  })
  const describeCandidate = (candidate: ShortcutBinding | null, self: string | null = null): ShortcutCandidate => {
    try {
      const described = shortcuts.describeBinding(candidate)
      return { binding: described.binding, keys: described.keys, issue: described.issue,
        // A command never conflicts with its own current binding.
        conflicts: self === null ? described.conflicts : described.conflicts.filter(id => id !== self) }
    } catch {
      // Unsupported physical codes throw; report them as an unsupported candidate.
      return { binding: null, keys: [], issue: 'unsupported-key', conflicts: [] }
    }
  }
  const applyEdit = async (edit: Parameters<Shortcuts['edit']>[0], self: string | null): Promise<void> => {
    if (disposed || saving) return
    saving = true
    message = null
    publish()
    try {
      const result = await shortcuts.edit(edit, shortcuts.config.getSnapshot().revision)
      if (disposed) return
      if (result.status !== 'saved') {
        const issue = result.issue
        const conflicts = result.conflicts
        message = issue !== undefined && issue !== null ? { code: 'unsupported' }
          : (conflicts?.length ?? 0) > 0 ? conflictMessage(conflicts!, self)
            : messageFor(result.status)
      }
    } catch {
      if (!disposed) message = { code: 'write-failed' }
    } finally {
      if (!disposed) { saving = false; publish() }
    }
  }
  /** Whether two normalized bindings denote the same physical combination. */
  const sameBinding = (left: ShortcutBinding | null, right: ShortcutBinding | null): boolean => {
    if (left === null || right === null) return left === right
    const key = (binding: ShortcutBinding): string => {
      const codes = [binding.code, ...(binding.secondCode === undefined ? [] : [binding.secondCode])].sort()
      return `${codes.join('+')}|${[...binding.modifiers].sort().join(',')}`
    }
    return key(left) === key(right)
  }
  /** Normalize one stored binding, or undefined when the official service rejects it. */
  const safeDescribe = (binding: ShortcutBinding): NonNullable<ReturnType<Shortcuts['describeBinding']>['binding']> | undefined => {
    try {
      return shortcuts.describeBinding(binding).binding ?? undefined
    } catch {
      // An unsupported stored code is skipped rather than failing the whole export.
      return undefined
    }
  }
  const releaseRecording = (): void => {
    recordingGeneration += 1
    recordingCommand = null
    void shortcuts.recording(false).catch(() => {})
  }
  return {
    getSnapshot: () => snapshot,
    subscribe: listener => { listeners.add(listener); return () => { listeners.delete(listener) } },
    open: () => { if (!open) { open = true; publish() } },
    close: () => {
      if (!open && recordingCommand === null) return
      open = false
      message = null
      releaseRecording()
      publish()
    },
    toggle: () => {
      open = !open
      if (!open) { message = null; releaseRecording() }
      publish()
    },
    async setEnabled(field, enabled) {
      if (disposed || saving || !snapshot.writable) return
      saving = true
      message = null
      publish()
      try {
        if (!await form.set(field, enabled)) message = { code: 'write-failed' }
      } catch {
        message = { code: 'write-failed' }
      } finally {
        if (!disposed) { saving = false; publish() }
      }
    },
    async startRecording(commandId) {
      if (disposed || !snapshot.officialWritable) return
      if (recordingCommand === commandId) return
      message = null
      const generation = ++recordingGeneration
      if (recordingCommand === null) {
        try {
          // Desktop rejects until its native interception acknowledges the request.
          await shortcuts.recording(true)
          // The panel may have closed, or another target may have been armed, while waiting.
          if (disposed || generation !== recordingGeneration) return
        } catch {
          if (!disposed && generation === recordingGeneration) { message = { code: 'native-failed' }; publish() }
          return
        }
      }
      recordingCommand = commandId
      publish()
    },
    stopRecording() {
      if (disposed || recordingCommand === null) return
      releaseRecording()
      publish()
    },
    releaseSurface() {
      if (disposed || recordingCommand === null) return
      releaseRecording()
      publish()
    },
    describe: candidate => describeCandidate(candidate),
    async finishRecording(candidate) {
      if (disposed || recordingCommand === null) return
      const target = recordingCommand
      const described = describeCandidate(candidate, target)
      if (described.issue !== null) {
        // Keep recording so the user can release another combination.
        message = { code: 'unsupported' }
        publish()
        return
      }
      if (described.conflicts.length > 0) {
        message = conflictMessage(described.conflicts, target)
        publish()
        return
      }
      releaseRecording()
      publish()
      await applyEdit({ type: 'set', id: target as ShortcutCommandId, binding: candidate }, target)
    },
    async saveBinding(commandId, candidate) {
      await applyEdit({ type: 'set', id: commandId as ShortcutCommandId, binding: candidate }, commandId)
    },
    async resetCommand(commandId) {
      await applyEdit({ type: 'reset', id: commandId as ShortcutCommandId }, commandId)
    },
    async clearCommand(commandId) {
      await applyEdit({ type: 'set', id: commandId as ShortcutCommandId, binding: null }, commandId)
    },
    exportConfig() {
      const config = form.getSnapshot()
      const profile: ShortcutProfile = `${shortcuts.runtime}:${shortcuts.platform}`
      // Export the complete keyboard configuration: every command the official catalog exposes,
      // not just the customized ones. `modified` preserves which commands were overridden so an
      // import can reproduce this exact state instead of shifting the unmodified set.
      const shortcutsSnapshot: Record<string, ConfigFileShortcutEntry> = {}
      for (const row of catalogRows()) {
        const described = row.binding === null ? undefined : safeDescribe(row.binding)
        shortcutsSnapshot[row.id] = {
          modified: row.modified,
          binding: described === undefined
            ? null
            : {
              code: described.code,
              ...(described.secondCode === undefined ? {} : { secondCode: described.secondCode }),
              modifiers: [...described.modifiers],
            },
          label: row.label,
          keys: [...row.keys],
        }
      }
      const raw = encodeConfigFile({
        questionEnabled: config.value?.questionEnabled === true,
        approvalEnabled: config.value?.approvalEnabled === true,
        shortcuts: shortcutsSnapshot,
        profile,
      })
      message = { code: 'exported' }
      publish()
      return raw
    },
    async importConfig(raw) {
      if (disposed || saving) return
      if (raw === null) { message = { code: 'import-read-failed' }; publish(); return }
      const decoded = decodeConfigFile(raw)
      if (!decoded.ok) {
        message = { code: decoded.reason === 'future' ? 'import-future'
          : decoded.reason === 'too-large' ? 'import-too-large' : 'import-invalid' }
        publish()
        return
      }
      const document = decoded.document
      const accepted = shortcuts.config.getSnapshot()
      const profile: ShortcutProfile = `${shortcuts.runtime}:${shortcuts.platform}`
      const overrides = accepted.document.profiles[profile] ?? {}

      // Plan against the whole file first. The official service validates each edit against the
      // document *after* it applies, so a command whose key another entry is about to release
      // must not be judged against the current occupancy — that is what made swapping two
      // bindings, or moving a key in the same file, fail on a perfectly valid snapshot.
      interface Planned {
        readonly id: ShortcutCommandId
        readonly final: { readonly binding: ShortcutBinding | null } | 'reset'
        /** Current accepted override, or undefined when the command inherits its default. */
        readonly previous: ShortcutBinding | null | undefined
        /** Effective keys must be released even when inherited from the official default. */
        readonly release: boolean
      }
      const planned: Planned[] = []
      for (const [id, entry] of Object.entries(document.shortcuts)) {
        const row = rowFor(id)
        // Commands this composition does not mount cannot be written; skip them.
        if (row === undefined) continue
        const previous = Object.hasOwn(overrides, id) ? overrides[id] : undefined
        const currentlyModified = row.modified === true
        if (!entry.modified) {
          // The file recorded the official default, so the override must go away entirely.
          if (!currentlyModified) continue
          planned.push({ id: id as ShortcutCommandId, final: 'reset', previous, release: row.binding !== null })
          continue
        }
        const described = describeCandidate(entry.binding, id)
        if (described.issue !== null) { message = { code: 'unsupported' }; publish(); return }
        if (currentlyModified && sameBinding(row.binding, described.binding)) continue
        planned.push({ id: id as ShortcutCommandId, final: { binding: described.binding ?? null }, previous,
          release: row.binding !== null })
      }

      saving = true
      message = null
      publish()
      const touched: Planned[] = []
      const restore = async (targets: readonly Planned[]): Promise<readonly string[]> => {
        const failed: string[] = []
        for (const item of [...targets].reverse()) {
          const edit = item.previous === undefined
            ? { type: 'reset' as const, id: item.id }
            : { type: 'set' as const, id: item.id, binding: item.previous }
          try {
            const result = await shortcuts.edit(edit, shortcuts.config.getSnapshot().revision)
            if (result.status !== 'saved') failed.push(rowFor(item.id)?.label ?? item.id)
          } catch { failed.push(rowFor(item.id)?.label ?? item.id) }
          if (disposed) return failed
        }
        return failed
      }
      const apply = async (edit: Parameters<Shortcuts['edit']>[0], id: ShortcutCommandId): Promise<QuickPanelMessage | null> => {
        const result = await shortcuts.edit(edit, shortcuts.config.getSnapshot().revision)
        if (result.status === 'saved') { touched.push(planned.find(item => item.id === id)!); return null }
        const conflicts = result.conflicts
        return result.issue !== undefined && result.issue !== null ? { code: 'unsupported' }
          : (conflicts?.length ?? 0) > 0 ? conflictMessage(conflicts!, id)
            : messageFor(result.status)
      }
      try {
        // Release every key the file moves or clears before writing anything back, so the writes
        // never collide with the state they are replacing.
        for (const item of planned) {
          if (!item.release) continue
          const failure = await apply({ type: 'set', id: item.id, binding: null }, item.id)
          if (disposed) return
          if (failure !== null) {
            const unrestored = await restore(touched)
            message = unrestored.length > 0 ? { code: 'import-partial', detail: unrestored } : failure
            return
          }
        }
        // Now write the file's own state. A `set` re-applies an override (including an explicit
        // clear) and `reset` re-inherits the official default.
        for (const item of planned) {
          if (item.final === 'reset') {
            const failure = await apply({ type: 'reset', id: item.id }, item.id)
            if (disposed) return
            if (failure !== null) {
              const unrestored = await restore(touched)
              message = unrestored.length > 0 ? { code: 'import-partial', detail: unrestored } : failure
              return
            }
            continue
          }
          if (item.release && item.final.binding === null) continue
          const failure = await apply({ type: 'set', id: item.id, binding: item.final.binding }, item.id)
          if (disposed) return
          if (failure !== null) {
            const unrestored = await restore(touched)
            message = unrestored.length > 0 ? { code: 'import-partial', detail: unrestored } : failure
            return
          }
        }
        // The shortcuts now stand; write both switches in one accepted mutation.
        const current = form.getSnapshot().value
        const ops: Array<{ op: 'set'; path: string[]; value: boolean }> = []
        if (current?.questionEnabled !== document.questionEnabled) {
          ops.push({ op: 'set', path: ['questionEnabled'], value: document.questionEnabled })
        }
        if (current?.approvalEnabled !== document.approvalEnabled) {
          ops.push({ op: 'set', path: ['approvalEnabled'], value: document.approvalEnabled })
        }
        if (ops.length > 0 && !await form.mutate(ops)) {
          // The keyboard configuration did apply, so say so instead of claiming a clean import.
          message = { code: 'import-partial', detail: ['questionEnabled', 'approvalEnabled'] }
          return
        }
        if (!disposed) message = { code: 'imported' }
      } catch {
        const unrestored = await restore(touched)
        if (!disposed) message = unrestored.length > 0
          ? { code: 'import-partial', detail: unrestored } : { code: 'write-failed' }
      } finally {
        if (!disposed) { saving = false; publish() }
      }
    },
    dismiss() { if (disposed || message === null) return; message = null; publish() },
    dispose() {
      if (disposed) return
      disposed = true
      releaseRecording()
      offForm()
      offCatalog()
      offConfig()
      listeners.clear()
    },
  }
}
