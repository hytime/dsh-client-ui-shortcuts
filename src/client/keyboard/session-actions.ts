import type { ShortcutCommand, ShortcutCommandId } from '@deepseek-ai/dsh-client-shortcuts/client'

/** Defensive views over the sessions/workspaces services; every field optional. */
export interface SessionListSnapshotShape {
  current?: string
  currentId?: string
  ids?: string[]
  ordered?: string[]
  byId?: Record<string, { blank?: boolean; updatedAt?: number }>
  items?: Array<{ id?: string; sessionId?: string; blank?: boolean; updatedAt?: number }>
}

export interface SessionsNavFace {
  list?: { getSnapshot?: () => SessionListSnapshotShape }
  open?: (id: string) => void
  fork?: (opts: { sessionId: string }) => Promise<unknown>
}

export interface WorkspacesNavFace {
  startSession?: () => void
  list?: { getSnapshot?: () => { items?: Array<{ sessionIds?: string[] }>; archivedSessionIds?: string[] } }
}

const asStrings = (arr: unknown): string[] =>
  Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : []

/** Read the ordered session ids + current id from the list snapshot, defensively. */
export function readSessionOrder(sessions: SessionsNavFace | undefined): { ids: string[]; current: string | undefined } {
  let snap: SessionListSnapshotShape | undefined
  try { snap = sessions?.list?.getSnapshot?.() } catch { snap = undefined }
  const current = snap?.current ?? snap?.currentId
  const itemIds = asStrings(snap?.items?.map(i => i?.sessionId ?? i?.id))
  const ids = asStrings(snap?.ids).length > 0
    ? asStrings(snap?.ids)
    : asStrings(snap?.ordered).length > 0
      ? asStrings(snap?.ordered)
      : itemIds
  return { ids, current }
}

/**
 * Move to the session at offset +delta from the current one, mirroring the
 * sidebar's full display order: workspaces in registry order, each group's
 * sessions by recency (updatedAt descending, id tiebreak), the ungrouped
 * bucket appended last — blank ("new session") and archived rows skipped,
 * exactly like the sidebar's grouping. The walk wraps around at both ends;
 * a blank/unlisted current sits "before the head".
 */
export function navigateSession(sessions: SessionsNavFace | undefined, workspaces: WorkspacesNavFace | undefined, delta: number): void {
  const { ids: flatIds, current } = readSessionOrder(sessions)
  if (current === undefined) return
  const snap = (() => { try { return sessions?.list?.getSnapshot?.() } catch { return undefined } })()
  const summaryOf = (id: string) => snap?.byId?.[id]
  const itemOf = (id: string) => snap?.items?.find(i => (i?.sessionId ?? i?.id) === id)
  let wsSnap: { items?: Array<{ sessionIds?: string[] }>; archivedSessionIds?: string[] } | undefined
  try { wsSnap = workspaces?.list?.getSnapshot?.() } catch { wsSnap = undefined }
  const archived = new Set(Array.isArray(wsSnap?.archivedSessionIds) ? wsSnap.archivedSessionIds : [])
  const hidden = (id: string): boolean => summaryOf(id)?.blank === true || itemOf(id)?.blank === true || archived.has(id)
  const recencyOf = (id: string): number => summaryOf(id)?.updatedAt ?? itemOf(id)?.updatedAt ?? 0
  const byRecency = (a: string, b: string): number => {
    const at = recencyOf(a); const bt = recencyOf(b)
    if (bt !== at) return bt - at
    return a < b ? -1 : 1
  }
  const ordered: string[] = []
  const accounted = new Set<string>()
  for (const w of wsSnap?.items ?? []) {
    if (!Array.isArray(w?.sessionIds)) continue
    const members = w.sessionIds.filter(id => !hidden(id))
    members.sort(byRecency)
    ordered.push(...members)
    for (const id of w.sessionIds) accounted.add(id)
  }
  const stray = flatIds.filter(id => !accounted.has(id) && !hidden(id))
  stray.sort(byRecency)
  ordered.push(...stray)
  if (ordered.length === 0) return
  const len = ordered.length
  const idx = ordered.indexOf(current)
  const next = idx === -1
    ? (delta > 0 ? 0 : len - 1)
    : (((idx + delta) % len) + len) % len
  const target = ordered[next]
  if (target !== undefined) sessions?.open?.(target)
}

export const NEW_SESSION_COMMAND = 'dsh-shortcuts.newSession' as ShortcutCommandId
export const PREV_SESSION_COMMAND = 'dsh-shortcuts.prevSession' as ShortcutCommandId
export const NEXT_SESSION_COMMAND = 'dsh-shortcuts.nextSession' as ShortcutCommandId
export const FORK_SESSION_COMMAND = 'dsh-shortcuts.forkSession' as ShortcutCommandId

/** Start a brand-new session through the workspaces service. */
export function createNewSessionCommand(label: () => string, workspaces: WorkspacesNavFace | undefined): ShortcutCommand {
  return {
    id: NEW_SESSION_COMMAND,
    label,
    aliases: ['new session', 'new chat'],
    defaults: {},
    regions: ['page', 'editable'],
    modals: [],
    resolve: () => ({ status: 'handled', run: () => { workspaces?.startSession?.() } }),
  }
}

/** Walk to the previous/next session in sidebar display order (wraps around).
 *  Defaults mirror the task-navigation chords common in AI IDEs (Qoder-style
 *  Ctrl+Shift+[ / Ctrl+Shift+]); the official `primary` modifier expands to
 *  Cmd on macOS and Ctrl elsewhere, so one declaration covers both. The
 *  web-binding rules admit primary+shift on Windows and macOS; Linux Web keeps
 *  no default (narrower allowed set). */
export function createSessionStepCommand(id: ShortcutCommandId, label: () => string, sessions: SessionsNavFace | undefined, workspaces: WorkspacesNavFace | undefined, delta: number): ShortcutCommand {
  const binding = { code: delta < 0 ? 'BracketLeft' : 'BracketRight', modifiers: ['primary', 'shift'] as const }
  return {
    id,
    label,
    aliases: [delta < 0 ? 'previous session' : 'next session'],
    defaults: {
      'desktop:macos': binding,
      'desktop:windows': binding,
      'desktop:linux': binding,
      'web:macos': binding,
      'web:windows': binding,
      // Linux Web deliberately has no default: the official allowed set is narrower.
    },
    regions: ['page', 'editable'],
    modals: [],
    resolve: () => ({ status: 'handled', run: () => { navigateSession(sessions, workspaces, delta) } }),
  }
}

export function createPrevSessionCommand(label: () => string, sessions: SessionsNavFace | undefined, workspaces: WorkspacesNavFace | undefined): ShortcutCommand {
  return createSessionStepCommand(PREV_SESSION_COMMAND, label, sessions, workspaces, -1)
}

export function createNextSessionCommand(label: () => string, sessions: SessionsNavFace | undefined, workspaces: WorkspacesNavFace | undefined): ShortcutCommand {
  return createSessionStepCommand(NEXT_SESSION_COMMAND, label, sessions, workspaces, +1)
}

/** Fork the current session from its completed-turn prefix; the child opens from the sidebar. */
export function createForkSessionCommand(label: () => string, sessions: SessionsNavFace | undefined): ShortcutCommand {
  return {
    id: FORK_SESSION_COMMAND,
    label,
    aliases: ['fork session'],
    defaults: {},
    regions: ['page', 'editable'],
    modals: [],
    resolve: () => ({
      status: 'handled',
      run: () => {
        const { current } = readSessionOrder(sessions)
        if (current === undefined) return
        const fork = (sessions as { fork?: (o: { sessionId: string }) => Promise<unknown> } | undefined)?.fork
        if (fork) void fork({ sessionId: current }).catch(() => {})
      },
    }),
  }
}
