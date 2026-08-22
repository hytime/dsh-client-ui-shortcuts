import type { SessionId, WorkspaceId } from '@deepseek-ai/dsh-client-runtime/client'

export type GlobalActionId = 'startSession' | 'previousSession' | 'nextSession' | 'previousWorkspace' | 'nextWorkspace' | 'forkSession' | 'toggleTheme'
export type GlobalAction = () => void
export type GlobalActions = Partial<Record<GlobalActionId, GlobalAction>>

export interface SessionActionFace { readonly list: { getSnapshot(): { items: readonly { sessionId: SessionId }[]; current: SessionId | undefined } }; open(id: SessionId): void; fork(opts: { sessionId: SessionId; increaseTitle?: boolean }): Promise<SessionId> }
export interface WorkspaceActionFace { readonly list: { getSnapshot(): { items: readonly { workspaceId: WorkspaceId; sessionIds: readonly SessionId[] }[] } }; startSession(workspaceId?: WorkspaceId): void; connectWorkspace(workspaceId: WorkspaceId): Promise<SessionId> }
export interface ThemeActionFace { getTheme(): { preference: string; active?: { colorScheme: 'light' | 'dark' } }; setTheme(id: string): void }
export interface GlobalActionCapabilities { readonly sessions?: SessionActionFace; readonly workspaces?: WorkspaceActionFace; readonly theme?: ThemeActionFace }

function adjacent<T>(items: readonly T[], current: T | undefined, delta: number): T | undefined {
  if (current === undefined) return undefined
  const index = items.indexOf(current)
  return index < 0 || items.length < 2 ? undefined : items[(index + delta + items.length) % items.length]
}

export function createGlobalActions({ sessions, workspaces, theme }: GlobalActionCapabilities): GlobalActions {
  const actions: GlobalActions = {}
  if (workspaces?.startSession !== undefined) actions.startSession = () => { workspaces.startSession() }
  if (sessions !== undefined && sessions.open !== undefined) {
    const navigate = (delta: number) => { const snapshot = sessions.list.getSnapshot(); const ids = snapshot.items.map(item => item.sessionId); const target = adjacent(ids, snapshot.current, delta); if (target !== undefined) sessions.open(target) }
    actions.previousSession = () => { navigate(-1) }; actions.nextSession = () => { navigate(1) }
  }
  if (sessions !== undefined && sessions.open !== undefined && workspaces?.list !== undefined && workspaces.connectWorkspace !== undefined) {
    const navigate = (delta: number) => {
      const state = sessions.list.getSnapshot(); const items = workspaces.list.getSnapshot().items
      const current = items.find(item => item.sessionIds.includes(state.current as SessionId)); const target = adjacent(items, current, delta)
      if (target !== undefined) void workspaces.connectWorkspace(target.workspaceId).then(id => { sessions.open(id) }, () => {})
    }
    actions.previousWorkspace = () => { navigate(-1) }; actions.nextWorkspace = () => { navigate(1) }
  }
  if (sessions !== undefined && sessions.open !== undefined && sessions.fork !== undefined) actions.forkSession = () => { const current = sessions.list.getSnapshot().current; if (current !== undefined) void sessions.fork({ sessionId: current, increaseTitle: true }).then(id => { sessions.open(id) }, () => {}) }
  if (theme !== undefined) actions.toggleTheme = () => { const snapshot = theme.getTheme(); const scheme = snapshot.preference === 'system' ? snapshot.active?.colorScheme : snapshot.preference; theme.setTheme(scheme === 'dark' ? 'light' : 'dark') }
  return actions
}
