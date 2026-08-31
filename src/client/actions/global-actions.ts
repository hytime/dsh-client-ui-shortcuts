import type { SessionId, WorkspaceId } from '@deepseek-ai/dsh-client-runtime/client'

export type GlobalActionId = 'startSession' | 'previousSession' | 'nextSession' | 'previousWorkspace' | 'nextWorkspace' | 'forkSession' | 'toggleTheme'
export type GlobalAction = () => void
export type GlobalActions = Partial<Record<GlobalActionId, GlobalAction>>

type SessionSummaryFace = { readonly id: SessionId; readonly blank: boolean; readonly origin?: string }
type SessionListSnapshot = { readonly ids: readonly SessionId[]; readonly byId: Readonly<Record<SessionId, SessionSummaryFace>>; readonly current: SessionId | undefined }
type WorkspaceListItem = { readonly workspaceId: WorkspaceId; readonly title: string; readonly sessionIds: readonly SessionId[] }
type WorkspaceListSnapshot = { readonly items: readonly WorkspaceListItem[]; readonly archivedSessionIds: readonly SessionId[] }

export interface SessionActionFace { readonly list: { getSnapshot(): SessionListSnapshot }; open(id: SessionId): void; fork(opts: { sessionId: SessionId; increaseTitle?: boolean }): Promise<SessionId> }
export interface WorkspaceActionFace { readonly list: { getSnapshot(): WorkspaceListSnapshot } }
export interface ThemeActionFace { getTheme(): { preference: string; active?: { colorScheme: 'light' | 'dark' } }; setTheme(id: string): void }
export interface WorkspaceViewActionFace { expandCollapsedWorkspace(workspaceTitle: string): void }
export interface GlobalActionCapabilities { readonly sessions?: SessionActionFace; readonly workspaces?: WorkspaceActionFace; readonly startSession?: GlobalAction; readonly workspaceView?: WorkspaceViewActionFace; readonly theme?: ThemeActionFace }

function adjacent<T>(items: readonly T[], current: T | undefined, delta: number): T | undefined {
  if (current === undefined) return undefined
  const index = items.indexOf(current)
  return index < 0 || items.length < 2 ? undefined : items[(index + delta + items.length) % items.length]
}

function navigableSessionIds(
  ids: readonly SessionId[],
  sessions: SessionListSnapshot,
  archivedSessionIds: readonly SessionId[],
): SessionId[] {
  const archived = new Set(archivedSessionIds)
  return ids.filter(id => {
    const summary = sessions.byId[id]
    return summary !== undefined && !summary.blank && summary.origin !== 'subagent' && !archived.has(id)
  })
}

export function createGlobalActions({ sessions, workspaces, startSession, workspaceView, theme }: GlobalActionCapabilities): GlobalActions {
  const actions: GlobalActions = {}
  if (startSession !== undefined) actions.startSession = startSession
  if (sessions !== undefined && sessions.open !== undefined && workspaces?.list !== undefined) {
    const navigateSession = (delta: number) => {
      const sessionSnapshot = sessions.list.getSnapshot()
      const workspaceSnapshot = workspaces.list.getSnapshot()
      const currentWorkspace = workspaceSnapshot.items.find(item => item.sessionIds.includes(sessionSnapshot.current as SessionId))
      const ids = currentWorkspace === undefined
        ? []
        : navigableSessionIds(currentWorkspace.sessionIds, sessionSnapshot, workspaceSnapshot.archivedSessionIds)
      const target = adjacent(ids, sessionSnapshot.current, delta)
      if (target !== undefined) sessions.open(target)
    }
    actions.previousSession = () => { navigateSession(-1) }
    actions.nextSession = () => { navigateSession(1) }

    const navigateWorkspace = (delta: number) => {
      const sessionSnapshot = sessions.list.getSnapshot()
      const workspaceSnapshot = workspaces.list.getSnapshot()
      const currentWorkspace = workspaceSnapshot.items.find(item => item.sessionIds.includes(sessionSnapshot.current as SessionId))
      const targetWorkspace = adjacent(workspaceSnapshot.items, currentWorkspace, delta)
      const target = targetWorkspace === undefined
        ? undefined
        : navigableSessionIds(targetWorkspace.sessionIds, sessionSnapshot, workspaceSnapshot.archivedSessionIds)[0]
      if (target !== undefined && targetWorkspace !== undefined) {
        workspaceView?.expandCollapsedWorkspace(targetWorkspace.title)
        sessions.open(target)
      }
    }
    actions.previousWorkspace = () => { navigateWorkspace(-1) }
    actions.nextWorkspace = () => { navigateWorkspace(1) }
  }
  if (sessions !== undefined && sessions.open !== undefined && sessions.fork !== undefined) actions.forkSession = () => { const current = sessions.list.getSnapshot().current; if (current !== undefined) void sessions.fork({ sessionId: current, increaseTitle: true }).then(id => { sessions.open(id) }, () => {}) }
  if (theme !== undefined) actions.toggleTheme = () => { const snapshot = theme.getTheme(); const scheme = snapshot.preference === 'system' ? snapshot.active?.colorScheme : snapshot.preference; theme.setTheme(scheme === 'dark' ? 'light' : 'dark') }
  return actions
}
