import type { ShortcutCommand, ShortcutCommandId } from '@deepseek-ai/dsh-client-shortcuts/client'
import { resolveService } from './service-source.js'
import type { ServiceSource } from './service-source.js'
import { recordDiag } from './diag.js'

/** Defensive views over the sessions/workspaces/uiWorkspace services; every field optional. */
export interface SessionRowShape {
  id?: string
  sessionId?: string
  blank?: boolean
  updatedAt?: number
  /** Retention counts per owner; the official current session is the row retained by `mainView`. */
  retainedBy?: { mainView?: number }
}

export interface SessionListSnapshotShape {
  current?: string
  currentId?: string
  ids?: string[]
  ordered?: string[]
  items?: Array<{ id?: string; sessionId?: string; blank?: boolean; updatedAt?: number }>
  byId?: Record<string, SessionRowShape>
}

export interface SessionsNavFace {
  list?: { getSnapshot?: () => SessionListSnapshotShape }
  /** Legacy fallback only: the current official Session Controller exposes no service-level `open`. */
  open?: (id: string) => void
}

export interface WorkspacesNavFace {
  list?: { getSnapshot?: () => { items?: Array<{ sessionIds?: string[] }>; archivedSessionIds?: string[] } }
}

/**
 * Official UI Workspace service (cordis name `uiWorkspace`): the sanctioned
 * entry point for replacing the main-view session.
 * Verified against the shipped implementation: `openSession(target)` →
 * `replaceMain(target, lifetime, "reveal")`, and the target accepts a known
 * Session id (the same call the official sidebar makes).
 */
export interface UiWorkspaceNavFace {
  openSession?: (target: string) => unknown
}

const asStrings = (arr: unknown): string[] =>
  Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : []

/**
 * Official current-session derivation: the list snapshot carries no `current`
 * field; the main view is whatever row `sessions.list` reports as retained by
 * `mainView` (`(row.retainedBy.mainView ?? 0) > 0`). Reads `id` first — the
 * same field the official code reads — then `sessionId`.
 */
export function mainViewSessionId(snap: SessionListSnapshotShape | undefined): string | undefined {
  const rows = Object.values(snap?.byId ?? {})
  const row = rows.find((value) => (value?.retainedBy?.mainView ?? 0) > 0)
  return row?.id ?? row?.sessionId
}

/** Read the ordered session ids + current id from the list snapshot, defensively. */
export function readSessionOrder(sessions: SessionsNavFace | undefined): { ids: string[]; current: string | undefined } {
  let snap: SessionListSnapshotShape | undefined
  try { snap = sessions?.list?.getSnapshot?.() } catch { snap = undefined }
  const current = snap?.current ?? snap?.currentId ?? mainViewSessionId(snap)
  const itemIds = asStrings(snap?.items?.map(i => i?.sessionId ?? i?.id))
  const ids = asStrings(snap?.ids).length > 0
    ? asStrings(snap?.ids)
    : asStrings(snap?.ordered).length > 0
      ? asStrings(snap?.ordered)
      : itemIds
  return { ids, current }
}

/** Open a session through the official UI Workspace path, falling back defensively. */
export function openSessionTarget(
  uiWorkspaceSource: ServiceSource<UiWorkspaceNavFace>,
  sessionsSource: ServiceSource<SessionsNavFace>,
  target: string,
): void {
  const uiWorkspace = resolveService(uiWorkspaceSource)
  const sessions = resolveService(sessionsSource)
  const open = uiWorkspace?.openSession
  if (typeof open === 'function') {
    try {
      void open.call(uiWorkspace, target)
      recordDiag('open', { via: 'uiWorkspace.openSession', target })
      return
    } catch (error) {
      recordDiag('open.error', { via: 'uiWorkspace.openSession', target, error: String(error) })
    }
  }
  const legacy = (sessions as { open?: (id: string) => unknown } | undefined)?.open
  if (typeof legacy === 'function') {
    legacy.call(sessions, target)
    recordDiag('open', { via: 'sessions.open', target })
    return
  }
  recordDiag('open', { via: 'none', target })
}

/**
 * Move to the session at offset +delta from the current one, mirroring the
 * sidebar's full display order: workspaces in registry order, each group's
 * sessions by recency (updatedAt descending, id tiebreak), the ungrouped
 * bucket appended last — blank ("new session") and archived rows skipped,
 * exactly like the sidebar's grouping. The walk wraps around at both ends;
 * a blank/unlisted current sits "before the head".
 */
export function navigateSession(
  sessionsSource: ServiceSource<SessionsNavFace>,
  workspacesSource: ServiceSource<WorkspacesNavFace>,
  uiWorkspaceSource: ServiceSource<UiWorkspaceNavFace>,
  delta: number,
): void {
  // Resolved at invoke time: these services may be provided after this plugin activates.
  const sessions = resolveService(sessionsSource)
  const workspaces = resolveService(workspacesSource)
  const { ids: flatIds, current } = readSessionOrder(sessions)
  recordDiag('nav.enter', {
    delta,
    services: { uiWorkspace: resolveService(uiWorkspaceSource) !== undefined, sessions: sessions !== undefined, workspaces: workspaces !== undefined },
    current,
    flatIds: flatIds.length,
  })
  if (current === undefined) {
    recordDiag('nav.stop', { reason: 'no current session (no retainedBy.mainView row)' })
    return
  }
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
  recordDiag('nav.plan', {
    delta,
    groups: wsSnap?.items?.map(w => w?.sessionIds?.length ?? 0) ?? null,
    ordered: ordered.length,
    orderedHead: ordered.slice(0, 6),
    archived: archived.size,
  })
  if (ordered.length === 0) {
    recordDiag('nav.stop', { reason: 'empty display order' })
    return
  }
  const len = ordered.length
  const idx = ordered.indexOf(current)
  const next = idx === -1
    ? (delta > 0 ? 0 : len - 1)
    : (((idx + delta) % len) + len) % len
  const target = ordered[next]
  recordDiag('nav.decide', { idx, next, target, same: target === current })
  if (target !== undefined) openSessionTarget(uiWorkspaceSource, sessionsSource, target)
}

export const PREV_SESSION_COMMAND = 'dsh-shortcuts.prevSession' as ShortcutCommandId
export const NEXT_SESSION_COMMAND = 'dsh-shortcuts.nextSession' as ShortcutCommandId

/** Walk to the previous/next session in sidebar display order (wraps around).
 *  Defaults mirror the task-navigation chords common in AI IDEs (Qoder-style
 *  Ctrl+Shift+[ / Ctrl+Shift+]); the official `primary` modifier expands to
 *  Cmd on macOS and Ctrl elsewhere, so one declaration covers both. The
 *  web-binding rules admit primary+shift on Windows and macOS; Linux Web keeps
 *  no default (narrower allowed set). */
export function createSessionStepCommand(
  id: ShortcutCommandId,
  label: () => string,
  sessionsSource: ServiceSource<SessionsNavFace>,
  workspacesSource: ServiceSource<WorkspacesNavFace>,
  uiWorkspaceSource: ServiceSource<UiWorkspaceNavFace>,
  delta: number,
): ShortcutCommand {
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
    resolve: () => ({ status: 'handled', run: () => { navigateSession(sessionsSource, workspacesSource, uiWorkspaceSource, delta) } }),
  }
}

export function createPrevSessionCommand(
  label: () => string,
  sessionsSource: ServiceSource<SessionsNavFace>,
  workspacesSource: ServiceSource<WorkspacesNavFace>,
  uiWorkspaceSource: ServiceSource<UiWorkspaceNavFace>,
): ShortcutCommand {
  return createSessionStepCommand(PREV_SESSION_COMMAND, label, sessionsSource, workspacesSource, uiWorkspaceSource, -1)
}

export function createNextSessionCommand(
  label: () => string,
  sessionsSource: ServiceSource<SessionsNavFace>,
  workspacesSource: ServiceSource<WorkspacesNavFace>,
  uiWorkspaceSource: ServiceSource<UiWorkspaceNavFace>,
): ShortcutCommand {
  return createSessionStepCommand(NEXT_SESSION_COMMAND, label, sessionsSource, workspacesSource, uiWorkspaceSource, +1)
}