import { describe, expect, it, vi } from 'vitest'
import { createGlobalActions } from '../src/client/actions/global-actions.js'

function services(overrides: Record<string, unknown> = {}) {
  const sessions = {
    list: { getSnapshot: () => ({ ids: ['s1', 's2'], byId: { s1: { id: 's1' }, s2: { id: 's2' } }, current: 's1' }) },
    open: vi.fn(), fork: vi.fn().mockResolvedValue('child'),
  }
  const workspaces = {
    list: { getSnapshot: () => ({ items: [{ workspaceId: 'w1', sessionIds: ['s1'] }, { workspaceId: 'w2', sessionIds: ['s2'] }] }) },
    startSession: vi.fn(), connectWorkspace: vi.fn().mockResolvedValue('s2'),
  }
  const theme = { getTheme: () => ({ preference: 'light' }), setTheme: vi.fn() }
  return { sessions, workspaces, theme, ...overrides }
}

describe('capability-aware global actions', () => {
  it('derives navigation and invokes exact service contracts', async () => {
    const d = services()
    const actions = createGlobalActions(d)
    actions.nextSession?.()
    actions.previousWorkspace?.()
    actions.startSession?.()
    actions.forkSession?.()
    actions.toggleTheme?.()
    await Promise.resolve()
    expect(d.sessions.open).toHaveBeenCalledWith('s2')
    expect(d.sessions.open).toHaveBeenCalledWith('child')
    expect(d.workspaces.startSession).toHaveBeenCalled()
    expect(d.sessions.fork).toHaveBeenCalledWith({ sessionId: 's1', increaseTitle: true })
    expect(d.theme.setTheme).toHaveBeenCalledWith('dark')
  })

  it('omits actions without optional capabilities or list state', () => {
    expect(createGlobalActions({}).startSession).toBeUndefined()
    expect(createGlobalActions({ sessions: { list: services().sessions.list, open: undefined, fork: undefined } as never }).forkSession).toBeUndefined()
  })

  it('does not change selection when fork fails', async () => {
    const d = services()
    d.sessions.fork.mockRejectedValue(new Error('no'))
    const actions = createGlobalActions(d)
    actions.forkSession?.()
    await Promise.resolve()
    expect(d.sessions.open).not.toHaveBeenCalled()
  })

  it('uses workspace connection in both directions and preserves selection on rejection', async () => {
    let currentSession = 's1'
    let workspaceItems = [{ workspaceId: 'w1', sessionIds: ['s1'] }, { workspaceId: 'w2', sessionIds: ['s2'] }]
    const d = services()
    d.sessions.list.getSnapshot = () => ({ ids: ['s1', 's2'], current: currentSession })
    d.workspaces.list.getSnapshot = () => ({ items: workspaceItems })
    d.workspaces.connectWorkspace
      .mockResolvedValueOnce('connected-prev')
      .mockResolvedValueOnce('connected-next')
      .mockRejectedValueOnce(new Error('offline'))
    const actions = createGlobalActions(d)

    actions.previousWorkspace?.()
    await Promise.resolve()
    expect(d.workspaces.connectWorkspace).toHaveBeenNthCalledWith(1, 'w2')
    expect(d.sessions.open).toHaveBeenCalledWith('connected-prev')

    currentSession = 'connected-prev'
    workspaceItems = [{ workspaceId: 'w1', sessionIds: ['connected-prev'] }, { workspaceId: 'w2', sessionIds: ['s2'] }]
    d.sessions.open.mockClear()
    actions.nextWorkspace?.()
    await Promise.resolve()
    expect(d.workspaces.connectWorkspace).toHaveBeenNthCalledWith(2, 'w2')
    expect(d.sessions.open).toHaveBeenCalledWith('connected-next')

    currentSession = 'connected-next'
    workspaceItems = [{ workspaceId: 'w1', sessionIds: ['s1'] }, { workspaceId: 'w2', sessionIds: ['connected-next'] }]
    d.sessions.open.mockClear()
    actions.previousWorkspace?.()
    await Promise.resolve()
    expect(d.workspaces.connectWorkspace).toHaveBeenNthCalledWith(3, 'w1')
    expect(d.sessions.open).not.toHaveBeenCalled()
  })

  it('allows start session without a sessions list', () => {
    const d = services()
    const actions = createGlobalActions({ workspaces: d.workspaces })
    actions.startSession?.()
    expect(d.workspaces.startSession).toHaveBeenCalledTimes(1)
  })

  it('uses dynamic session snapshots and resolves system theme from active scheme', () => {
    const d = services()
    let current = 's1'
    d.sessions.list.getSnapshot = () => ({ ids: current === 's1' ? ['s1', 's2'] : ['s2', 's3'], current })
    const actions = createGlobalActions(d)
    current = 's2'
    actions.nextSession?.()
    expect(d.sessions.open).toHaveBeenCalledWith('s3')
    d.theme.getTheme = () => ({ preference: 'system', active: { colorScheme: 'dark' } })
    actions.toggleTheme?.()
    expect(d.theme.setTheme).toHaveBeenCalledWith('light')
  })

  it('omits workspace actions when any required face is missing and invocation is safe', () => {
    const d = services()
    const actions = createGlobalActions({ sessions: d.sessions as never, workspaces: { list: d.workspaces.list, connectWorkspace: undefined } as never })
    expect(actions.previousWorkspace).toBeUndefined()
    expect(actions.nextWorkspace).toBeUndefined()
  })

  it('does not expose settings or unavailable actions', () => {
    const actions = createGlobalActions({})
    expect(actions.openSettings).toBeUndefined()
    expect(actions.previousWorkspace).toBeUndefined()
  })

})
