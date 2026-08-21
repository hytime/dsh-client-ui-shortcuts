import type { SessionId, WorkspaceId } from '@deepseek-ai/dsh-client-runtime/client'

export type GlobalActionId =
  | 'startSession'
  | 'previousSession'
  | 'nextSession'
  | 'previousWorkspace'
  | 'nextWorkspace'
  | 'forkSession'
  | 'toggleTheme'

export type GlobalAction = () => void
export type GlobalActions = Partial<Record<GlobalActionId, GlobalAction>>

type Snapshot<T> = { getSnapshot(): T }
type Sessions = {
  list: Snapshot<{ ids: readonly SessionId[]; current: SessionId | undefined }>
  open(id: SessionId): void
  fork(opts: { sessionId: SessionId; increaseTitle?: boolean }): Promise<SessionId>
}
type Workspaces = {
  list: Snapshot<{ items: readonly { workspaceId: WorkspaceId; sessionIds: readonly SessionId[] }[] }>
  startSession(workspaceId?: WorkspaceId): void
  connectWorkspace(workspaceId: WorkspaceId): Promise<SessionId>
}
type Theme = {
  getTheme(): { preference: string }
  setTheme(id: string): void
}

export interface GlobalActionServices {
  readonly sessions?: Partial<Sessions>
  readonly workspaces?: Partial<Workspaces>
  readonly theme?: Partial<Theme>
}

function adjacent<T>(items: readonly T[], current: T | undefined, delta: number): T | undefined {
  if (current === undefined) return undefined
  const index = items.indexOf(current)
  if (index < 0 || items.length < 2) return undefined
  return items[(index + delta + items.length) % items.length]
}

export function createGlobalActions(services: GlobalActionServices): GlobalActions {
  const actions: GlobalActions = {}
  const sessions = services.sessions
  const workspaces = services.workspaces
  const theme = services.theme
  const sessionList = sessions?.list
  const sessionOpen = sessions?.open
  const sessionFork = sessions?.fork
  const workspaceList = workspaces?.list
  const workspaceStart = workspaces?.startSession
  const workspaceConnect = workspaces?.connectWorkspace
  const themeGet = theme?.getTheme
  const themeSet = theme?.setTheme

  if (workspaceStart !== undefined && sessionList !== undefined) {
    actions.startSession = () => { workspaceStart.call(workspaces) }
  }
  if (sessionOpen !== undefined && sessionList !== undefined) {
    const navigate = (delta: number) => {
      const snapshot = sessionList.getSnapshot()
      const target = adjacent(snapshot.ids, snapshot.current, delta)
      if (target !== undefined) sessionOpen.call(sessions, target)
    }
    actions.previousSession = () => { navigate(-1) }
    actions.nextSession = () => { navigate(1) }
  }
  if (sessionOpen !== undefined && sessionList !== undefined && workspaceList !== undefined) {
    const navigateWorkspace = (delta: number) => {
      const sessionSnapshot = sessionList.getSnapshot()
      const workspaceSnapshot = workspaceList.getSnapshot()
      const currentWorkspace = workspaceSnapshot.items.find(item => item.sessionIds.includes(sessionSnapshot.current as SessionId))
      const target = adjacent(workspaceSnapshot.items, currentWorkspace, delta)
      const targetSession = target?.sessionIds.find(id => id !== undefined)
      if (targetSession !== undefined) sessionOpen.call(sessions, targetSession)
    }
    actions.previousWorkspace = () => { navigateWorkspace(-1) }
    actions.nextWorkspace = () => { navigateWorkspace(1) }
  }
  if (sessionFork !== undefined && sessionOpen !== undefined && sessionList !== undefined) {
    actions.forkSession = () => {
      const current = sessionList.getSnapshot().current
      if (current === undefined) return
      void sessionFork.call(sessions, { sessionId: current, increaseTitle: true }).then(child => {
        sessionOpen.call(sessions, child)
      }, () => {})
    }
  }
  if (themeGet !== undefined && themeSet !== undefined) {
    actions.toggleTheme = () => {
      const preference = themeGet.call(theme).preference
      themeSet.call(theme, preference === 'dark' ? 'light' : 'dark')
    }
  }
  return actions
}
